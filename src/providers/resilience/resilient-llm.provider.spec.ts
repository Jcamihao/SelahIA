import { BadGatewayException } from '@nestjs/common';
import { MetricsService } from '../../common/metrics/metrics.service';
import {
  ProviderBusyException,
  ProviderQuotaExceededException,
  ProviderUnavailableException,
  ProviderUpstreamException,
  TokenBudgetExceededException,
} from '../provider-errors';
import { ConcurrencyLimiter } from './concurrency-limiter';
import { ResilientLlmProvider } from './resilient-llm.provider';
import { TokenBudgetService } from './token-budget.service';

const okResult = (total = 150) => ({
  data: { ok: true },
  text: '{}',
  model: 'fake',
  raw: {
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 50,
      totalTokenCount: total,
    },
  },
});

const setup = (
  overrides: {
    structured?: jest.Mock;
    threshold?: number;
    max?: number;
    queue?: number;
    app?: string;
  } = {},
) => {
  const structured =
    overrides.structured ?? jest.fn().mockResolvedValue(okResult());
  const inner = {
    generateStructured: structured,
    generateStructuredFromContents: structured,
    generateTextFromContents: jest.fn().mockResolvedValue(okResult()),
  };
  const metrics = new MetricsService();
  const budget = new TokenBudgetService();
  // Breaker real, criado pelo wrapper a partir do env (inclui o callback das metricas).
  process.env.LLM_CIRCUIT_FAILURE_THRESHOLD = String(overrides.threshold ?? 2);
  process.env.LLM_CIRCUIT_OPEN_MS = '60000';
  const provider = new ResilientLlmProvider(
    inner as any,
    {
      budget,
      metrics,
      requestContext: {
        getSourceApp: () => overrides.app ?? 'LumenBack',
      } as any,
    },
    {
      limiter: new ConcurrencyLimiter(
        overrides.max ?? 5,
        overrides.queue ?? 5,
        1000,
      ),
    },
  );
  return { provider, structured, metrics, budget };
};

const call = (provider: ResilientLlmProvider) =>
  provider.generateStructured({
    userPrompt: 'x',
    responseSchema: {},
    validate: (v) => v,
  });

describe('ResilientLlmProvider', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('repassa o resultado e conta chamadas e tokens por app', async () => {
    const { provider, metrics } = setup();
    await expect(call(provider)).resolves.toMatchObject({ model: 'fake' });

    const text = metrics.render();
    expect(text).toContain(
      'selah_llm_calls_total{app="LumenBack",mode="structured",outcome="ok"} 1',
    );
    expect(text).toContain(
      'selah_llm_tokens_total{app="LumenBack",type="prompt"} 100',
    );
    expect(text).toContain(
      'selah_llm_tokens_total{app="LumenBack",type="output"} 50',
    );
    expect(text).toContain(
      'selah_llm_tokens_total{app="LumenBack",type="total"} 150',
    );
    expect(text).toContain(
      'selah_llm_call_duration_seconds_count{app="LumenBack",mode="structured"} 1',
    );
  });

  it('soma os tokens no teto diario e bloqueia o app que o atingiu, sem chamar o provedor', async () => {
    process.env.SELAH_DAILY_TOKEN_BUDGET = '200';
    const { provider, structured, metrics } = setup();

    await call(provider); // 150
    await call(provider); // 300 >= 200
    structured.mockClear();

    await expect(call(provider)).rejects.toBeInstanceOf(
      TokenBudgetExceededException,
    );
    expect(structured).not.toHaveBeenCalled();
    expect(metrics.render()).toContain('outcome="budget"} 1');
  });

  it('abre o circuito depois de falhas transitorias seguidas e para de chamar o provedor', async () => {
    const structured = jest
      .fn()
      .mockRejectedValue(new ProviderUpstreamException('falhou', true));
    const { provider, metrics } = setup({ structured, threshold: 2 });

    await expect(call(provider)).rejects.toBeInstanceOf(
      ProviderUpstreamException,
    );
    await expect(call(provider)).rejects.toBeInstanceOf(
      ProviderUpstreamException,
    );
    expect(provider.breaker.currentState).toBe('open');

    structured.mockClear();
    await expect(call(provider)).rejects.toBeInstanceOf(
      ProviderUnavailableException,
    );
    expect(structured).not.toHaveBeenCalled();

    const text = metrics.render();
    expect(text).toContain('outcome="upstream_error"} 2');
    expect(text).toContain('outcome="circuit_open"} 1');
    expect(text).toContain('selah_llm_circuit_state 2');
    expect(text).toContain('selah_llm_circuit_transitions_total{to="open"} 1');
  });

  it.each([
    [
      'resposta invalida (502 do validate)',
      new BadGatewayException('invalida'),
    ],
    ['4xx do provedor', new ProviderUpstreamException('403', false)],
    ['cota do Gemini', new ProviderQuotaExceededException(10)],
    ['erro de programacao', new TypeError('bug')],
  ])('%s NAO abre o circuito', async (_name, error) => {
    const structured = jest.fn().mockRejectedValue(error);
    const { provider } = setup({ structured, threshold: 2 });

    for (let i = 0; i < 5; i++) {
      await expect(call(provider)).rejects.toBe(error);
    }
    expect(provider.breaker.currentState).toBe('closed');
    expect(structured).toHaveBeenCalledTimes(5);
  });

  it('um sucesso entre as falhas impede o circuito de abrir', async () => {
    const structured = jest
      .fn()
      .mockRejectedValueOnce(new ProviderUpstreamException('x', true))
      .mockResolvedValueOnce(okResult())
      .mockRejectedValueOnce(new ProviderUpstreamException('x', true));
    const { provider } = setup({ structured, threshold: 2 });

    await expect(call(provider)).rejects.toBeInstanceOf(
      ProviderUpstreamException,
    );
    await call(provider);
    await expect(call(provider)).rejects.toBeInstanceOf(
      ProviderUpstreamException,
    );
    expect(provider.breaker.currentState).toBe('closed');
  });

  it('com concorrencia no limite e fila cheia, responde PROVIDER_BUSY', async () => {
    let release!: () => void;
    const structured = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(okResult());
        }),
    );
    const { provider, metrics } = setup({ structured, max: 1, queue: 0 });

    const first = call(provider);
    await Promise.resolve();
    await expect(call(provider)).rejects.toBeInstanceOf(ProviderBusyException);

    release();
    await first;
    const text = metrics.render();
    expect(text).toContain('outcome="busy"} 1');
    expect(text).toContain('selah_llm_in_flight 0');
  });

  it('metodo de texto tambem passa pelo wrapper', async () => {
    const { provider, metrics } = setup();
    await provider.generateTextFromContents({ contents: [] });
    expect(metrics.render()).toContain('mode="text",outcome="ok"} 1');
  });

  it('nenhuma metrica carrega conteudo do prompt ou da resposta', async () => {
    const secret = 'SEGREDO_PII_9d1c';
    const structured = jest.fn().mockResolvedValue({
      ...okResult(),
      data: { rascunho: secret },
      text: secret,
    });
    const { provider, metrics } = setup({ structured });
    await provider.generateStructured({
      userPrompt: secret,
      responseSchema: {},
      validate: (v) => v,
    });
    expect(metrics.render()).not.toContain(secret);
  });
});
