import { ApiKeyRegistry } from './api-key-registry.service';
import { createPreAuthGate } from './pre-auth.gate';

const KEY = 'a'.repeat(32);

const run = (
  registry: Pick<ApiKeyRegistry, 'hasKeys' | 'authenticate'>,
  method: string,
  headers: Record<string, string> = {},
) => {
  const response: any = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const next = jest.fn();
  createPreAuthGate(registry as ApiKeyRegistry)(
    { method, headers } as any,
    response,
    next,
  );
  return { response, next };
};

describe('createPreAuthGate', () => {
  const registry = {
    hasKeys: () => true,
    authenticate: (key: string) => (key === KEY ? { kind: 'app' } : null),
  } as any;

  it('POST sem chave: 401 e Connection: close, sem chamar o parser', () => {
    const { response, next } = run(registry, 'POST');
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 401,
      message: 'Invalid Selah IA API key.',
      error: 'Unauthorized',
    });
    expect(response.setHeader).toHaveBeenCalledWith('Connection', 'close');
  });

  it('POST com chave errada: 401', () => {
    const { next, response } = run(registry, 'POST', {
      'x-selah-api-key': 'b'.repeat(32),
    });
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(401);
  });

  it('POST com chave valida segue para o parser', () => {
    const { next, response } = run(registry, 'POST', {
      'x-selah-api-key': KEY,
    });
    expect(next).toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
  });

  it('GET nao passa pelo portao (health continua aberto)', () => {
    const { next } = run(registry, 'GET');
    expect(next).toHaveBeenCalled();
  });

  it('sem nenhuma chave configurada nao faz nada (mesma regra do guard)', () => {
    const { next } = run(
      { hasKeys: () => false, authenticate: () => null } as any,
      'POST',
    );
    expect(next).toHaveBeenCalled();
  });
});
