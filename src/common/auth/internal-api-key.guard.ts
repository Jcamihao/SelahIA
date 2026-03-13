import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

const parseList = (raw: string | undefined) =>
  String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const validKeys = parseList(process.env.SELAH_INTERNAL_API_KEYS);
    const allowedApps = parseList(process.env.SELAH_ALLOWED_SOURCE_APPS);

    if (!validKeys.length) {
      if (String(process.env.NODE_ENV || '').trim() === 'production') {
        throw new ServiceUnavailableException(
          'Selah IA internal API keys are not configured.',
        );
      }
      return true;
    }

    const providedKey = String(request.headers['x-selah-api-key'] || '').trim();
    if (!providedKey || !validKeys.includes(providedKey)) {
      throw new UnauthorizedException('Invalid Selah IA API key.');
    }

    const sourceApp = String(request.headers['x-source-app'] || '').trim();
    if (allowedApps.length && sourceApp && !allowedApps.includes(sourceApp)) {
      throw new UnauthorizedException('Source application not allowed.');
    }

    return true;
  }
}
