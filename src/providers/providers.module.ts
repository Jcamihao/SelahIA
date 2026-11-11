import { Module } from '@nestjs/common';
import { MetricsService } from '../common/metrics/metrics.service';
import { RequestContextService } from '../common/logging/request-context.service';
import { GeminiProvider } from './gemini/gemini.provider';
import { OllamaProvider } from './ollama/ollama.provider';
import { LLM_PROVIDER_TOKEN } from './provider.tokens';
import { resolveActiveLlmProvider } from './provider-selection';
import { ResilientLlmProvider } from './resilience/resilient-llm.provider';
import { TokenBudgetService } from './resilience/token-budget.service';

@Module({
  providers: [
    OllamaProvider,
    GeminiProvider,
    TokenBudgetService,
    {
      // Os adapters recebem o provider ativo ja envolvido por teto de tokens, circuit breaker,
      // limite de concorrencia e metricas (ver resilience/resilient-llm.provider.ts).
      provide: LLM_PROVIDER_TOKEN,
      useFactory: (
        ollama: OllamaProvider,
        gemini: GeminiProvider,
        budget: TokenBudgetService,
        metrics: MetricsService,
        requestContext: RequestContextService,
      ) =>
        new ResilientLlmProvider(
          resolveActiveLlmProvider() === 'gemini' ? gemini : ollama,
          { budget, metrics, requestContext },
        ),
      inject: [
        OllamaProvider,
        GeminiProvider,
        TokenBudgetService,
        MetricsService,
        RequestContextService,
      ],
    },
  ],
  exports: [OllamaProvider, GeminiProvider, LLM_PROVIDER_TOKEN],
})
export class ProvidersModule {}
