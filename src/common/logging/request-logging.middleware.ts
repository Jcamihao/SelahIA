import { Injectable, Logger, NestMiddleware, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../metrics/metrics.service';
import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('SelahHttp');

  constructor(
    private readonly requestContext: RequestContextService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  use(request: Request, response: Response, next: NextFunction) {
    const requestId =
      String(request.headers['x-request-id'] || '').trim() || randomUUID();
    const sourceApp =
      String(request.headers['x-source-app'] || '').trim() || 'unknown';
    const method = String(request.method || 'GET').toUpperCase();
    // Sem query string: ela pode carregar dados do usuario.
    const path =
      String(request.originalUrl || request.url || '/')
        .trim()
        .split('?')[0] || '/';
    const startedAt = Date.now();
    const context = {
      requestId,
      sourceApp,
      method,
      path,
      startedAt,
    };

    response.setHeader('X-Request-Id', requestId);

    this.requestContext.run(context, () => {
      this.logger.log(
        `[${requestId}] --> ${method} ${path} source=${sourceApp} ip=${this.resolveIp(request)}`,
      );

      let finished = false;
      const finish = (event: 'finish' | 'close') => {
        if (finished) {
          return;
        }

        finished = true;
        response.removeListener('finish', onFinish);
        response.removeListener('close', onClose);

        const durationMs = Date.now() - startedAt;
        const status = Number(response.statusCode || 0);
        // Rota pelo padrao registrado (ex.: /v1/adapters/.../gerar), nunca pelo path cru: path cru
        // deixaria um chamador criar series infinitas.
        const matched = (request as { route?: { path?: unknown } }).route?.path;
        this.metrics?.recordHttp({
          app: context.sourceApp,
          method,
          route: typeof matched === 'string' ? matched : 'unmatched',
          status,
          durationMs,
        });

        const baseMessage = `[${requestId}] <-- ${method} ${path} status=${status} durationMs=${durationMs} source=${context.sourceApp} event=${event}`;

        if (status >= 500) {
          this.logger.error(baseMessage);
          return;
        }

        if (status >= 400) {
          this.logger.warn(baseMessage);
          return;
        }

        this.logger.log(baseMessage);
      };

      const onFinish = () => finish('finish');
      const onClose = () => finish('close');

      response.on('finish', onFinish);
      response.on('close', onClose);
      next();
    });
  }

  // `request.ip` respeita o `trust proxy` do app: com o nginx confiavel ele e o IP real do cliente.
  // O primeiro valor de X-Forwarded-For e o que o proprio cliente mandou e pode ser forjado, entao
  // so serve de ultimo recurso (conexao que nao veio por proxy confiavel, sem `request.ip`).
  private resolveIp(request: Request) {
    if (request.ip) {
      return request.ip;
    }

    const forwardedFor = request.headers['x-forwarded-for'];
    if (Array.isArray(forwardedFor) && forwardedFor.length) {
      return String(forwardedFor[0]).trim();
    }

    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      return forwardedFor.split(',')[0].trim();
    }

    return (
      request.socket?.remoteAddress ||
      request.connection?.remoteAddress ||
      'unknown'
    );
  }
}
