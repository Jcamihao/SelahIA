import { BadGatewayException, Logger } from '@nestjs/common';
import { readEnvInt } from '../../common/config/validate-env';
import { MetricsService } from '../../common/metrics/metrics.service';
import { RequestContextService } from '../../common/logging/request-context.service';
import {
  GenerateTextResult,
  LlmProvider,
  StructuredGenerationFromContentsInput,
  StructuredGenerationInput,
  StructuredGenerationResult,
} from '../llm-provider.interface';
import {
  ProviderBusyException,
  ProviderQuotaExceededException,
  ProviderUnavailableException,
  ProviderUpstreamException,
  TokenBudgetExceededException,
} from '../provider-errors';
import { CircuitBreaker, CircuitState } from './circuit-breaker';
import { ConcurrencyLimiter } from './concurrency-limiter';
import { TokenBudgetService } from './token-budget.service';
import { extractTokenUsage } from './token-usage';

type Mode = 'structured' | 'text';

const CIRCUIT_STATE_VALUE: Record<CircuitState, number> = {
  closed: 0,
  half_open: 1,
  open: 2,
};

const classify = (error: unknown): string => {
  if (error instanceof ProviderQuotaExceededException) return 'quota';
  if (error instanceof ProviderBusyException) return 'busy';
  if (error instanceof ProviderUnavailableException) return 'circuit_open';
  if (error instanceof TokenBudgetExceededException) return 'budget';
  if (error instanceof ProviderUpstreamException) return 'upstream_error';
  if (error instanceof BadGatewayException) return 'invalid_response';
  return 'error';
};

// Envolve o provider ativo com: teto diario de tokens, circuit breaker, limite de concorrencia com
// fila curta e metricas. Os adapters continuam falando com a interface LlmProvider, sem saber disso.
export class ResilientLlmProvider implements LlmProvider {
  private readonly logger = new Logger(ResilientLlmProvider.name);
  readonly limiter: ConcurrencyLimiter;
  readonly breaker: CircuitBreaker;

  constructor(
    private readonly inner: LlmProvider,
    private readonly deps: {
      budget: TokenBudgetService;
      metrics: MetricsService;
      requestContext: RequestContextService;
    },
    parts?: { limiter?: ConcurrencyLimiter; breaker?: CircuitBreaker },
  ) {
    this.limiter =
      parts?.limiter ??
      new ConcurrencyLimiter(
        readEnvInt('LLM_MAX_CONCURRENCY', 10),
        readEnvInt('LLM_MAX_QUEUE', 20),
        readEnvInt('LLM_QUEUE_TIMEOUT_MS', 20_000),
      );
    this.breaker =
      parts?.breaker ??
      new CircuitBreaker(
        readEnvInt('LLM_CIRCUIT_FAILURE_THRESHOLD', 5),
        readEnvInt('LLM_CIRCUIT_OPEN_MS', 30_000),
        (state) => this.onCircuitChange(state),
      );

    deps.metrics.defineGauge(
      'selah_llm_in_flight',
      'Chamadas ao LLM em andamento agora.',
      () => [{ value: this.limiter.inFlight }],
    );
    deps.metrics.defineGauge(
      'selah_llm_queued',
      'Chamadas ao LLM esperando vaga na fila agora.',
      () => [{ value: this.limiter.queued }],
    );
    deps.metrics.defineGauge(
      'selah_llm_circuit_state',
      'Estado do circuit breaker do LLM (0 fechado, 1 meio aberto, 2 aberto).',
      () => [{ value: CIRCUIT_STATE_VALUE[this.breaker.currentState] }],
    );
  }

  generateStructured<T>(
    input: StructuredGenerationInput<T>,
  ): Promise<StructuredGenerationResult<T>> {
    return this.guarded('structured', () =>
      this.inner.generateStructured(input),
    );
  }

  generateStructuredFromContents<T>(
    input: StructuredGenerationFromContentsInput<T>,
  ): Promise<StructuredGenerationResult<T>> {
    return this.guarded('structured', () =>
      this.inner.generateStructuredFromContents(input),
    );
  }

  generateTextFromContents(
    input: Parameters<LlmProvider['generateTextFromContents']>[0],
  ): Promise<GenerateTextResult> {
    return this.guarded('text', () =>
      this.inner.generateTextFromContents(input),
    );
  }

  private async guarded<T extends { raw: unknown }>(
    mode: Mode,
    call: () => Promise<T>,
  ): Promise<T> {
    const app = this.deps.requestContext.getSourceApp();
    let outcome = 'ok';

    try {
      this.deps.budget.assertAvailable(app);
      // Circuito aberto recusa antes de ocupar fila.
      this.breaker.assertNotOpen();

      const result = await this.limiter.run(() =>
        this.callThroughBreaker(app, mode, call),
      );

      const usage = extractTokenUsage(result.raw);
      this.deps.budget.record(app, usage.total);
      this.deps.metrics.inc(
        'selah_llm_tokens_total',
        { app, type: 'prompt' },
        usage.prompt,
      );
      this.deps.metrics.inc(
        'selah_llm_tokens_total',
        { app, type: 'output' },
        usage.output,
      );
      this.deps.metrics.inc(
        'selah_llm_tokens_total',
        { app, type: 'total' },
        usage.total,
      );
      return result;
    } catch (error) {
      outcome = classify(error);
      throw error;
    } finally {
      this.deps.metrics.inc('selah_llm_calls_total', { app, mode, outcome });
    }
  }

  private async callThroughBreaker<T>(
    app: string,
    mode: Mode,
    call: () => Promise<T>,
  ): Promise<T> {
    this.breaker.beforeCall();
    const startedAt = Date.now();
    try {
      const result = await call();
      this.breaker.onSuccess();
      return result;
    } catch (error) {
      // So falha de transporte ou 5xx do provedor conta. Resposta invalida, 4xx e cota mostram que
      // o provedor respondeu, entao fecham o circuito em vez de abri-lo.
      if (error instanceof ProviderUpstreamException && error.transient) {
        this.breaker.onTransientFailure();
      } else {
        this.breaker.onSuccess();
      }
      throw error;
    } finally {
      this.deps.metrics.observe(
        'selah_llm_call_duration_seconds',
        { app, mode },
        (Date.now() - startedAt) / 1000,
      );
    }
  }

  private onCircuitChange(state: CircuitState) {
    this.deps.metrics.inc('selah_llm_circuit_transitions_total', { to: state });
    this.logger.warn(`Circuit breaker do LLM mudou para ${state}.`);
  }
}
