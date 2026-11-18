import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';

const DEFAULT_RETRY_AFTER_SECONDS = 60;
const MAX_RETRY_AFTER_SECONDS = 300;

const clampRetryAfter = (value: unknown, fallback: number) =>
  Number.isFinite(Number(value)) && Number(value) > 0
    ? Math.min(MAX_RETRY_AFTER_SECONDS, Math.ceil(Number(value)))
    : fallback;

// Cota ou limite do provedor de LLM estourou. Responde 503 (e nao 502) com Retry-After para o app
// consumidor saber que basta esperar. Nao e o 429 do rate limit do proprio Selah, que fica no guard.
export class ProviderQuotaExceededException extends ServiceUnavailableException {
  constructor(retryAfterSeconds?: number) {
    super({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'LLM provider quota exceeded. Retry later.',
      reason: 'PROVIDER_QUOTA_EXCEEDED',
      retryAfterSeconds: clampRetryAfter(
        retryAfterSeconds,
        DEFAULT_RETRY_AFTER_SECONDS,
      ),
    });
  }
}

// Falha de transporte ou do servidor do provedor (rede, timeout, 5xx), depois dos retries do provider.
// Continua sendo 502 para o consumidor. `transient` diz se vale contar para o circuit breaker:
// 4xx (chave errada, requisicao invalida) mostra que o provedor esta no ar e nao conta.
export class ProviderUpstreamException extends BadGatewayException {
  constructor(
    message: string,
    readonly transient: boolean,
  ) {
    super(message);
  }
}

// Muitas chamadas ao LLM em andamento e a fila encheu (ou a espera estourou): nao vale empilhar mais.
export class ProviderBusyException extends ServiceUnavailableException {
  constructor(retryAfterSeconds = 5) {
    super({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'LLM provider is busy. Retry shortly.',
      reason: 'PROVIDER_BUSY',
      retryAfterSeconds: clampRetryAfter(retryAfterSeconds, 5),
    });
  }
}

// Circuit breaker aberto: o provedor falhou varias vezes seguidas, entao o Selah para de chamar por
// um tempo em vez de acumular requisicoes lentas.
export class ProviderUnavailableException extends ServiceUnavailableException {
  constructor(retryAfterSeconds = 30) {
    super({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'LLM provider is temporarily unavailable. Retry later.',
      reason: 'PROVIDER_UNAVAILABLE',
      retryAfterSeconds: clampRetryAfter(retryAfterSeconds, 30),
    });
  }
}

// Teto diario de tokens do app. E um limite do Selah (como o rate limit), por isso 429.
// Sem teto de 300s no Retry-After: o contador zera na virada do dia UTC.
export class TokenBudgetExceededException extends HttpException {
  constructor(retryAfterSeconds: number) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: 'Daily token budget exceeded for this application.',
        reason: 'DAILY_TOKEN_BUDGET_EXCEEDED',
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterSeconds)),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
