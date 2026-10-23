import { BadGatewayException, Logger } from '@nestjs/common';
import { GeminiProvider } from './gemini.provider';

const okResponse = (text = 'ok') => ({
  data: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] },
});

const httpError = (status: number, headers: Record<string, string> = {}) => ({
  message: `status ${status}`,
  response: { status, headers, data: { error: { message: `erro ${status}` } } },
});

describe('GeminiProvider retry', () => {
  const originalEnv = { ...process.env };

  const createProvider = (post: jest.Mock) => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_RETRY_BASE_MS = '1';
    process.env.GEMINI_RETRY_MAX_DELAY_MS = '5';
    delete process.env.GEMINI_MAX_RETRIES;
    const provider = new GeminiProvider({
      getRequestId: () => 'test-request',
      getSourceApp: () => 'test',
    } as any);
    (provider as any).httpClient = { post };
    return provider;
  };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('retries a 429 and returns the next successful response', async () => {
    const post = jest
      .fn()
      .mockRejectedValueOnce(httpError(429))
      .mockResolvedValueOnce(okResponse('resposta final'));

    const result = await createProvider(post).generateTextFromContents({
      contents: [{ parts: [{ text: 'oi' }] }],
    });

    expect(result.text).toBe('resposta final');
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('retries a network reset that has no HTTP response', async () => {
    const post = jest
      .fn()
      .mockRejectedValueOnce({ code: 'ECONNRESET', message: 'reset' })
      .mockResolvedValueOnce(okResponse());

    await createProvider(post).generateTextFromContents({
      contents: [{ parts: [{ text: 'oi' }] }],
    });

    expect(post).toHaveBeenCalledTimes(2);
  });

  it('gives up after the configured number of retries', async () => {
    const post = jest.fn().mockRejectedValue(httpError(503));

    await expect(
      createProvider(post).generateTextFromContents({
        contents: [{ parts: [{ text: 'oi' }] }],
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(post).toHaveBeenCalledTimes(3);
  });

  it('does not retry client errors like 400 or 403', async () => {
    for (const status of [400, 403]) {
      const post = jest.fn().mockRejectedValue(httpError(status));

      await expect(
        createProvider(post).generateTextFromContents({
          contents: [{ parts: [{ text: 'oi' }] }],
        }),
      ).rejects.toBeInstanceOf(BadGatewayException);
      expect(post).toHaveBeenCalledTimes(1);
    }
  });

  it('does not retry when Retry-After asks for longer than the max delay', async () => {
    const post = jest
      .fn()
      .mockRejectedValue(httpError(429, { 'retry-after': '60' }));

    await expect(
      createProvider(post).generateTextFromContents({
        contents: [{ parts: [{ text: 'oi' }] }],
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('caps each attempt timeout to the remaining budget', async () => {
    const post = jest.fn().mockResolvedValue(okResponse());

    await createProvider(post).generateTextFromContents({
      contents: [{ parts: [{ text: 'oi' }] }],
    });

    const attemptTimeout = post.mock.calls[0][2].timeout as number;
    expect(attemptTimeout).toBeLessThanOrEqual(45000);
    expect(attemptTimeout).toBeGreaterThan(40000);
  });
});

// Erro do upstream nao pode vazar texto livre (pode repetir conteudo da requisicao) para log nem 502.
describe('GeminiProvider error redaction', () => {
  const MARKER = 'NOTA_SECRETA_7f3a';
  const originalEnv = { ...process.env };
  let logged: string[];

  const upstreamError = (status: number, googleStatus?: string) => ({
    message: `falhou ${MARKER}`,
    response: {
      status,
      headers: {},
      data: { error: { message: `eco ${MARKER}`, status: googleStatus } },
    },
  });

  const run = async (error: unknown) => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_RETRY_BASE_MS = '1';
    process.env.GEMINI_RETRY_MAX_DELAY_MS = '5';
    const provider = new GeminiProvider({
      getRequestId: () => 'test-request',
      getSourceApp: () => 'test',
    } as any);
    (provider as any).httpClient = { post: jest.fn().mockRejectedValue(error) };
    return provider
      .generateTextFromContents({ contents: [{ parts: [{ text: 'oi' }] }] })
      .then(
        () => {
          throw new Error('deveria falhar');
        },
        (e: Error) => e.message,
      );
  };

  beforeEach(() => {
    logged = [];
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      jest
        .spyOn(Logger.prototype, level)
        .mockImplementation((message: any) => {
          logged.push(String(message));
        });
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it('nao loga nem devolve a mensagem do upstream', async () => {
    const message = await run(upstreamError(400));

    expect(message).toBe('Gemini request failed status=400 reason=unknown');
    expect(message).not.toContain(MARKER);
    expect(logged.length).toBeGreaterThan(0);
    expect(logged.filter((line) => line.includes(MARKER))).toEqual([]);
  });

  it('mostra o enum de status da Google', async () => {
    const message = await run(upstreamError(400, 'INVALID_ARGUMENT'));

    expect(message).toBe(
      'Gemini request failed status=400 reason=INVALID_ARGUMENT',
    );
    expect(logged.some((line) => line.includes('reason=INVALID_ARGUMENT'))).toBe(
      true,
    );
  });

  it('nao mostra status que seja texto livre', async () => {
    const message = await run(upstreamError(400, `texto livre ${MARKER}`));

    expect(message).toBe('Gemini request failed status=400 reason=unknown');
    expect(logged.filter((line) => line.includes(MARKER))).toEqual([]);
  });

  it('erro de rede sem status mostra o codigo e nao a mensagem', async () => {
    const message = await run({ code: 'ECONNABORTED', message: MARKER });

    expect(message).toBe(
      'Gemini request failed status=n/a reason=ECONNABORTED',
    );
    expect(logged.filter((line) => line.includes(MARKER))).toEqual([]);
  });

  const providerWithResponse = (data: unknown) => {
    process.env.GEMINI_API_KEY = 'test-key';
    const provider = new GeminiProvider({
      getRequestId: () => 'test-request',
      getSourceApp: () => 'test',
    } as any);
    (provider as any).httpClient = { post: jest.fn().mockResolvedValue({ data }) };
    return provider;
  };

  it('finishReason que seja texto livre nao aparece no 502 nem no log (resposta vazia)', async () => {
    const provider = providerWithResponse({
      candidates: [{ finishReason: `texto livre ${MARKER}` }],
    });

    const error = await provider
      .generateTextFromContents({ contents: [{ parts: [{ text: 'oi' }] }] })
      .catch((e: Error) => e);

    expect((error as Error).message).toContain('finishReason=unknown');
    expect((error as Error).message).not.toContain(MARKER);
    expect(logged.filter((line) => line.includes(MARKER))).toEqual([]);
  });

  it('finishReason que seja texto livre nao aparece no log de sucesso', async () => {
    const provider = providerWithResponse({
      candidates: [
        { finishReason: `texto livre ${MARKER}`, content: { parts: [{ text: 'ok' }] } },
      ],
    });

    await provider.generateTextFromContents({ contents: [{ parts: [{ text: 'oi' }] }] });

    expect(logged.some((line) => line.includes('finishReason=unknown'))).toBe(true);
    expect(logged.filter((line) => line.includes(MARKER))).toEqual([]);
  });

  it('finishReason enum valido continua aparecendo no log', async () => {
    const provider = providerWithResponse({
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'ok' }] } }],
    });

    await provider.generateTextFromContents({ contents: [{ parts: [{ text: 'oi' }] }] });

    expect(logged.some((line) => line.includes('finishReason=STOP'))).toBe(true);
  });

  it('resposta vazia nao repete o texto livre do promptFeedback', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const provider = new GeminiProvider({
      getRequestId: () => 'test-request',
      getSourceApp: () => 'test',
    } as any);
    (provider as any).httpClient = {
      post: jest.fn().mockResolvedValue({
        data: {
          candidates: [{ finishReason: 'SAFETY' }],
          promptFeedback: { blockReason: 'SAFETY', blockReasonMessage: MARKER },
        },
      }),
    };

    const error = await provider
      .generateTextFromContents({ contents: [{ parts: [{ text: 'oi' }] }] })
      .catch((e: Error) => e);

    expect((error as Error).message).toContain('blockReason=SAFETY');
    expect((error as Error).message).not.toContain(MARKER);
  });
});
