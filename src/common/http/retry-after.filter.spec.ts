import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ProviderQuotaExceededException } from '../../providers/provider-errors';
import { RetryAfterExceptionFilter } from './retry-after.filter';

const run = (exception: HttpException, existingHeader?: string) => {
  const headers: Record<string, string> = existingHeader
    ? { 'Retry-After': existingHeader }
    : {};
  const json = jest.fn();
  const response = {
    getHeader: (name: string) => headers[name],
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
    status: jest.fn().mockReturnValue({ json }),
  };
  new RetryAfterExceptionFilter().catch(exception, {
    switchToHttp: () => ({ getResponse: () => response }),
  } as any);
  return { headers, json, status: response.status };
};

describe('RetryAfterExceptionFilter', () => {
  it('poe Retry-After e mantem o corpo quando a excecao traz retryAfterSeconds', () => {
    const exception = new ProviderQuotaExceededException(42);
    const { headers, json, status } = run(exception);

    expect(headers['Retry-After']).toBe('42');
    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(exception.getResponse());
  });

  it('nao sobrescreve um Retry-After ja definido (ex.: o do rate limit do guard)', () => {
    const { headers } = run(
      new HttpException(
        { statusCode: 429, retryAfterSeconds: 9 },
        HttpStatus.TOO_MANY_REQUESTS,
      ),
      '7',
    );
    expect(headers['Retry-After']).toBe('7');
  });

  it('nao poe Retry-After em erros comuns e mantem o corpo padrao do Nest', () => {
    const notFound = new NotFoundException();
    const first = run(notFound);
    expect(first.headers['Retry-After']).toBeUndefined();
    expect(first.json).toHaveBeenCalledWith(notFound.getResponse());

    const badRequest = new BadRequestException(['campo invalido']);
    const second = run(badRequest);
    expect(second.status).toHaveBeenCalledWith(400);
    expect(second.json).toHaveBeenCalledWith(badRequest.getResponse());
  });

  it('embrulha corpo em string no formato padrao do Nest', () => {
    const { json } = run(new HttpException('falhou', 418));
    expect(json).toHaveBeenCalledWith({ statusCode: 418, message: 'falhou' });
  });

  it('ignora retryAfterSeconds invalido', () => {
    const { headers } = run(
      new HttpException({ retryAfterSeconds: 'abc' }, 503),
    );
    expect(headers['Retry-After']).toBeUndefined();
  });
});
