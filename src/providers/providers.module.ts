import { Module } from '@nestjs/common';
import { MetricsService } from '../common/metrics/metrics.service';
import { RequestContextService } from '../common/logging/request-context.service';
import { GeminiProvider } from './gemini/gemini.provider';
import { LLM_PROVIDER_TOKEN } from './provider.tokens';
import { ResilientLlmProvider } from './resilience/resilient-llm.provider';
import { TokenBudgetService } from './resilience/token-budget.service';

@Module({
  providers: [
    GeminiProvider,
    TokenBudgetService,
    {
      // Os adapters recebem o provider ja envolvido por teto de tokens, circuit breaker,
      // limite de concorrencia e metricas (ver resilience/resilient-llm.provider.ts).
      provide: LLM_PROVIDER_TOKEN,
      useFactory: (
        gemini: GeminiProvider,
        budget: TokenBudgetService,
        metrics: MetricsService,
        requestContext: RequestContextService,
      ) =>
        new ResilientLlmProvider(gemini, { budget, metrics, requestContext }),
      inject: [
        GeminiProvider,
        TokenBudgetService,
        MetricsService,
        RequestContextService,
      ],
    },
  ],
  exports: [GeminiProvider, LLM_PROVIDER_TOKEN],
})
export class ProvidersModule {}
