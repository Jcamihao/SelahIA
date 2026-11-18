import { BadGatewayException, Logger } from '@nestjs/common';
import {
  ProviderQuotaExceededException,
  ProviderUpstreamException,
} from '../provider-errors';
import { GeminiProvider } from './gemini.provider';

const okResponse = (text = 'ok') => ({
  data: {
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }],
  },
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
    ).rejects.toBeInstanceOf(ProviderQuotaExceededException);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('answers 503 with retryAfterSeconds when the quota stays exhausted after retries', async () => {
    const post = jest.fn().mockRejectedValue(httpError(429));

    const error: any = await createProvider(post)
      .generateTextFromContents({ contents: [{ parts: [{ text: 'oi' }] }] })
      .catch((e) => e);

    expect(error).toBeInstanceOf(ProviderQuotaExceededException);
    expect(error.getStatus()).toBe(503);
    expect(error.getResponse()).toMatchObject({
      reason: 'PROVIDER_QUOTA_EXCEEDED',
      retryAfterSeconds: 60,
    });
    expect(post).toHaveBeenCalledTimes(3);
  });

  it('uses the upstream Retry-After (capped) in the 503 body', async () => {
    const post = jest
      .fn()
      .mockRejectedValue(httpError(429, { 'retry-after': '9999' }));

    const error: any = await createProvider(post)
      .generateTextFromContents({ contents: [{ parts: [{ text: 'oi' }] }] })
      .catch((e) => e);

    expect(error.getResponse().retryAfterSeconds).toBe(300);
  });

  it('keeps 502 for other upstream failures (403 is not a quota problem)', async () => {
    const post = jest.fn().mockRejectedValue(httpError(403));

    await expect(
      createProvider(post).generateTextFromContents({
        contents: [{ parts: [{ text: 'oi' }] }],
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
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
      jest.spyOn(Logger.prototype, level).mockImplementation((message: any) => {
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
    expect(
      logged.some((line) => line.includes('reason=INVALID_ARGUMENT')),
    ).toBe(true);
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
    (provider as any).httpClient = {
      post: jest.fn().mockResolvedValue({ data }),
    };
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
        {
          finishReason: `texto livre ${MARKER}`,
          content: { parts: [{ text: 'ok' }] },
        },
      ],
    });

    await provider.generateTextFromContents({
      contents: [{ parts: [{ text: 'oi' }] }],
    });

    expect(logged.some((line) => line.includes('finishReason=unknown'))).toBe(
      true,
    );
    expect(logged.filter((line) => line.includes(MARKER))).toEqual([]);
  });

  it('finishReason enum valido continua aparecendo no log', async () => {
    const provider = providerWithResponse({
      candidates: [
        { finishReason: 'STOP', content: { parts: [{ text: 'ok' }] } },
      ],
    });

    await provider.generateTextFromContents({
      contents: [{ parts: [{ text: 'oi' }] }],
    });

    expect(logged.some((line) => line.includes('finishReason=STOP'))).toBe(
      true,
    );
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

const structuredResponse = (text: string, finishReason = 'STOP') => ({
  data: {
    candidates: [{ finishReason, content: { parts: [{ text }] } }],
    usageMetadata: { totalTokenCount: 10 },
  },
});

describe('GeminiProvider structured retry on invalid output', () => {
  const originalEnv = { ...process.env };

  const createProvider = (post: jest.Mock, retries?: string) => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_RETRY_BASE_MS = '1';
    process.env.GEMINI_RETRY_MAX_DELAY_MS = '5';
    if (retries === undefined) delete process.env.GEMINI_INVALID_JSON_RETRIES;
    else process.env.GEMINI_INVALID_JSON_RETRIES = retries;
    const provider = new GeminiProvider({
      getRequestId: () => 'test-request',
      getSourceApp: () => 'test',
    } as any);
    (provider as any).httpClient = { post };
    return provider;
  };

  const run = (provider: GeminiProvider, validate = (v: unknown) => v) =>
    provider.generateStructured({
      userPrompt: 'x',
      responseSchema: {},
      validate,
    });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('repete uma vez quando o JSON vem quebrado e devolve a segunda resposta', async () => {
    const post = jest
      .fn()
      .mockResolvedValueOnce(structuredResponse('isso nao e json'))
      .mockResolvedValueOnce(structuredResponse('{"ok":true}'));

    const result = await run(createProvider(post));

    expect(result.data).toEqual({ ok: true });
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('repete quando o validate do adapter recusa a saida (502 de schema)', async () => {
    const post = jest
      .fn()
      .mockResolvedValueOnce(structuredResponse('{"campo":"errado"}'))
      .mockResolvedValueOnce(structuredResponse('{"campo":"certo"}'));
    const validate = jest.fn((value: any) => {
      if (value.campo !== 'certo') throw new BadGatewayException('schema');
      return value;
    });

    const result = await run(createProvider(post), validate);

    expect(result.data).toEqual({ campo: 'certo' });
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('desiste depois da tentativa extra e devolve o 502', async () => {
    const post = jest.fn().mockResolvedValue(structuredResponse('lixo'));

    await expect(run(createProvider(post))).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('GEMINI_INVALID_JSON_RETRIES=0 desliga a nova tentativa', async () => {
    const post = jest.fn().mockResolvedValue(structuredResponse('lixo'));

    await expect(run(createProvider(post, '0'))).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('nao repete quando a saida foi cortada por MAX_TOKENS (cortaria de novo)', async () => {
    const post = jest
      .fn()
      .mockResolvedValue(structuredResponse('{"a":', 'MAX_TOKENS'));

    await expect(run(createProvider(post))).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('nao repete resposta vazia ou bloqueada', async () => {
    const post = jest.fn().mockResolvedValue({
      data: { candidates: [{ finishReason: 'SAFETY' }] },
    });

    await expect(run(createProvider(post))).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('nao repete erro que nao e 502 (bug no validate nao e culpa do modelo)', async () => {
    const post = jest.fn().mockResolvedValue(structuredResponse('{"a":1}'));
    const validate = () => {
      throw new TypeError('bug');
    };

    await expect(run(createProvider(post), validate)).rejects.toBeInstanceOf(
      TypeError,
    );
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('o log da nova tentativa nao carrega a saida do modelo nem a mensagem do erro', async () => {
    const SECRET = 'SEGREDO_PII_4b2e';
    const logged: string[] = [];
    for (const level of ['log', 'warn', 'error'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation((m: any) => {
        logged.push(String(m));
      });
    }
    const post = jest
      .fn()
      .mockResolvedValueOnce(structuredResponse(`${SECRET} nao e json`))
      .mockResolvedValueOnce(structuredResponse('{"ok":true}'));

    await run(createProvider(post));

    expect(logged.some((line) => line.includes('retrying'))).toBe(true);
    expect(logged.filter((line) => line.includes(SECRET))).toEqual([]);
  });

  it('chamadas estruturadas por contents tambem repetem', async () => {
    const post = jest
      .fn()
      .mockResolvedValueOnce(structuredResponse('lixo'))
      .mockResolvedValueOnce(structuredResponse('{"ok":1}'));

    const result = await createProvider(post).generateStructuredFromContents({
      contents: [{ parts: [{ text: 'oi' }] }],
      responseSchema: {},
      validate: (v) => v,
    });

    expect(result.data).toEqual({ ok: 1 });
    expect(post).toHaveBeenCalledTimes(2);
  });
});

describe('GeminiProvider transient flag (circuit breaker)', () => {
  const originalEnv = { ...process.env };

  const failWith = async (error: unknown) => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_RETRY_BASE_MS = '1';
    process.env.GEMINI_RETRY_MAX_DELAY_MS = '5';
    const provider = new GeminiProvider({
      getRequestId: () => 'r',
      getSourceApp: () => 'test',
    } as any);
    (provider as any).httpClient = { post: jest.fn().mockRejectedValue(error) };
    return provider
      .generateTextFromContents({ contents: [{ parts: [{ text: 'oi' }] }] })
      .catch((e) => e);
  };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it.each([[500], [502], [503], [504]])(
    '%i esgotado conta como transitorio',
    async (status) => {
      const error = await failWith(httpError(status));
      expect(error).toBeInstanceOf(ProviderUpstreamException);
      expect(error.transient).toBe(true);
      expect(error.getStatus()).toBe(502);
    },
  );

  it('erro de rede sem resposta HTTP conta como transitorio', async () => {
    const error = await failWith({ code: 'ECONNRESET', message: 'reset' });
    expect(error).toBeInstanceOf(ProviderUpstreamException);
    expect(error.transient).toBe(true);
  });

  it.each([[400], [401], [403], [404]])(
    '%i nao conta: o provedor esta no ar',
    async (status) => {
      const error = await failWith(httpError(status));
      expect(error).toBeInstanceOf(ProviderUpstreamException);
      expect(error.transient).toBe(false);
    },
  );

  it('429 vira ProviderQuotaExceededException, nao ProviderUpstreamException', async () => {
    const error = await failWith(httpError(429));
    expect(error).toBeInstanceOf(ProviderQuotaExceededException);
    expect(error).not.toBeInstanceOf(ProviderUpstreamException);
  });
});
