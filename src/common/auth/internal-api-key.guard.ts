import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestContextService } from '../logging/request-context.service';
import { ApiKeyRegistry, parseList } from './api-key-registry.service';
import { RateLimiterService } from './rate-limiter.service';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiKeyGuard.name);

  constructor(
    private readonly requestContext: RequestContextService,
    private readonly apiKeys: ApiKeyRegistry,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const requestId = this.requestContext.getRequestId();
    const claimedApp =
      String(request.headers['x-source-app'] || '').trim() ||
      this.requestContext.getSourceApp();

    if (!this.apiKeys.hasKeys()) {
      if (String(process.env.NODE_ENV || '').trim() === 'production') {
        this.logger.error(
          `[${requestId}] Internal API keys are missing in production.`,
        );
        throw new ServiceUnavailableException(
          'Selah IA internal API keys are not configured.',
        );
      }
      return true;
    }

    const providedKey = String(request.headers['x-selah-api-key'] || '').trim();
    const caller = this.apiKeys.authenticate(providedKey);
    if (!caller) {
      this.logger.warn(
        `[${requestId}] Invalid internal API key. claimedSource=${claimedApp || 'unknown'}`,
      );
      throw new UnauthorizedException('Invalid Selah IA API key.');
    }

    let app: string;
    if (caller.kind === 'app') {
      // A identidade vem da chave; o header so e informativo e nunca prevalece.
      app = caller.app;
      if (claimedApp && claimedApp !== 'unknown' && claimedApp !== app) {
        this.logger.warn(
          `[${requestId}] X-Source-App diverge da chave. key=${app} header=${claimedApp}`,
        );
      }
    } else {
      const allowedApps = parseList(process.env.SELAH_ALLOWED_SOURCE_APPS);
      if (allowedApps.length && claimedApp && !allowedApps.includes(claimedApp)) {
        this.logger.warn(
          `[${requestId}] Source application not allowed. source=${claimedApp}`,
        );
        throw new UnauthorizedException('Source application not allowed.');
      }
      app = claimedApp || 'unknown';
    }

    this.requestContext.setSourceApp(app);

    const limit = this.rateLimiter.limitFor(
      caller.kind === 'app' ? caller.app : undefined,
    );
    const decision = this.rateLimiter.consume(caller.bucketId, limit);
    if (!decision.allowed) {
      this.logger.warn(
        `[${requestId}] Rate limit exceeded. source=${app} limitPerMinute=${limit} retryAfterSeconds=${decision.retryAfterSeconds}`,
      );
      http
        .getResponse()
        .setHeader('Retry-After', String(decision.retryAfterSeconds));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded for this application.',
          retryAfterSeconds: decision.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
