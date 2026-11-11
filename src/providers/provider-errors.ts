import { ServiceUnavailableException } from '@nestjs/common';

const DEFAULT_RETRY_AFTER_SECONDS = 60;
const MAX_RETRY_AFTER_SECONDS = 300;

// Cota ou limite do provedor de LLM estourou. Responde 503 (e nao 502) com Retry-After para o app
// consumidor saber que basta esperar. Nao e o 429 do rate limit do proprio Selah, que fica no guard.
export class ProviderQuotaExceededException extends ServiceUnavailableException {
  constructor(retryAfterSeconds?: number) {
    const seconds =
      Number.isFinite(retryAfterSeconds) && Number(retryAfterSeconds) > 0
        ? Math.min(
            MAX_RETRY_AFTER_SECONDS,
            Math.ceil(Number(retryAfterSeconds)),
          )
        : DEFAULT_RETRY_AFTER_SECONDS;
    super({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'LLM provider quota exceeded. Retry later.',
      reason: 'PROVIDER_QUOTA_EXCEEDED',
      retryAfterSeconds: seconds,
    });
  }
}
