import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { postJson } from './post-json';

describe('postJson', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  const mockFetch = (impl: () => Promise<unknown>) => {
    global.fetch = jest.fn(impl) as unknown as typeof fetch;
    return global.fetch as unknown as jest.Mock;
  };
  const jsonResponse = (status: number, body: unknown, headers = {}) =>
    new Response(JSON.stringify(body), { status, headers });

  it('envia o corpo como JSON com os headers e devolve { data }', async () => {
    const fetchMock = mockFetch(async () => jsonResponse(200, { ok: 1 }));
    const result = await postJson(
      'http://x/y',
      { a: 1 },
      {
        headers: { 'x-goog-api-key': 'k' },
        timeout: 1000,
      },
    );
    expect(result).toEqual({ data: { ok: 1 } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://x/y');
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      'x-goog-api-key': 'k',
    });
  });

  it('lanca status, retry-after e corpo quando a resposta nao e 2xx', async () => {
    mockFetch(async () =>
      jsonResponse(
        429,
        { error: { status: 'RESOURCE_EXHAUSTED' } },
        {
          'retry-after': '7',
        },
      ),
    );
    await expect(postJson('http://x', {}, { timeout: 1000 })).rejects.toEqual({
      response: {
        status: 429,
        headers: { 'retry-after': '7' },
        data: { error: { status: 'RESOURCE_EXHAUSTED' } },
      },
    });
  });

  it('sem Retry-After o header fica undefined', async () => {
    mockFetch(async () => jsonResponse(503, {}));
    await expect(
      postJson('http://x', {}, { timeout: 1000 }),
    ).rejects.toMatchObject({
      response: { status: 503, headers: { 'retry-after': undefined } },
    });
  });

  it('erro de rede devolve o codigo que veio em cause', async () => {
    mockFetch(async () => {
      throw Object.assign(new TypeError('fetch failed'), {
        cause: { code: 'ECONNRESET' },
      });
    });
    await expect(postJson('http://x', {}, { timeout: 1000 })).rejects.toEqual({
      code: 'ECONNRESET',
    });
  });

  describe('com servidor que nunca responde', () => {
    let server: Server;
    let url: string;
    beforeAll(async () => {
      server = createServer(() => undefined);
      await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
      url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });
    afterAll(async () => {
      server.closeAllConnections();
      await new Promise((ok) => server.close(ok));
    });

    it('estouro de tempo vira ECONNABORTED', async () => {
      global.fetch = realFetch;
      await expect(postJson(url, {}, { timeout: 50 })).rejects.toEqual({
        code: 'ECONNABORTED',
      });
    });

    it('orcamento negativo aborta em vez de ficar sem limite', async () => {
      global.fetch = realFetch;
      await expect(postJson(url, {}, { timeout: -5 })).rejects.toBeDefined();
    });
  });

  it('corpo de sucesso que nao e JSON vira {}', async () => {
    mockFetch(async () => new Response('nao e json', { status: 200 }));
    await expect(postJson('http://x', {}, { timeout: 1000 })).resolves.toEqual({
      data: {},
    });
  });
});
