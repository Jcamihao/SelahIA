import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';

// Mantem o corpo padrao do Nest e acrescenta o header Retry-After quando a excecao traz
// `retryAfterSeconds` no corpo. Assim providers e services nao precisam tocar na resposta HTTP.
@Catch(HttpException)
export class RetryAfterExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status = exception.getStatus();
    const body = exception.getResponse();

    const retryAfter =
      typeof body === 'object' && body !== null
        ? Number((body as Record<string, unknown>).retryAfterSeconds)
        : NaN;
    if (
      Number.isFinite(retryAfter) &&
      retryAfter > 0 &&
      !response.getHeader('Retry-After')
    ) {
      response.setHeader('Retry-After', String(Math.ceil(retryAfter)));
    }

    response
      .status(status)
      .json(
        typeof body === 'string' ? { statusCode: status, message: body } : body,
      );
  }
}
