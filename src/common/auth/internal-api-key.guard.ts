import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestContextService } from '../logging/request-context.service';

const parseList = (raw: string | undefined) =>
  String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiKeyGuard.name);

  constructor(private readonly requestContext: RequestContextService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const validKeys = parseList(process.env.SELAH_INTERNAL_API_KEYS);
    const allowedApps = parseList(process.env.SELAH_ALLOWED_SOURCE_APPS);
    const requestId = this.requestContext.getRequestId();
    const sourceApp =
      String(request.headers['x-source-app'] || '').trim() ||
      this.requestContext.getSourceApp();

    if (!validKeys.length) {
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
    if (!providedKey || !validKeys.includes(providedKey)) {
      this.logger.warn(
        `[${requestId}] Invalid internal API key. source=${sourceApp || 'unknown'}`,
      );
      throw new UnauthorizedException('Invalid Selah IA API key.');
    }

    if (allowedApps.length && sourceApp && !allowedApps.includes(sourceApp)) {
      this.logger.warn(
        `[${requestId}] Source application not allowed. source=${sourceApp}`,
      );
      throw new UnauthorizedException('Source application not allowed.');
    }

    return true;
  }
}
