import { BadGatewayException } from '@nestjs/common';
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

    const result = await createProvider(post).generateText({
      userPrompt: 'oi',
    });

    expect(result.text).toBe('resposta final');
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('retries a network reset that has no HTTP response', async () => {
    const post = jest
      .fn()
      .mockRejectedValueOnce({ code: 'ECONNRESET', message: 'reset' })
      .mockResolvedValueOnce(okResponse());

    await createProvider(post).generateText({ userPrompt: 'oi' });

    expect(post).toHaveBeenCalledTimes(2);
  });

  it('gives up after the configured number of retries', async () => {
    const post = jest.fn().mockRejectedValue(httpError(503));

    await expect(
      createProvider(post).generateText({ userPrompt: 'oi' }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(post).toHaveBeenCalledTimes(3);
  });

  it('does not retry client errors like 400 or 403', async () => {
    for (const status of [400, 403]) {
      const post = jest.fn().mockRejectedValue(httpError(status));

      await expect(
        createProvider(post).generateText({ userPrompt: 'oi' }),
      ).rejects.toBeInstanceOf(BadGatewayException);
      expect(post).toHaveBeenCalledTimes(1);
    }
  });

  it('does not retry when Retry-After asks for longer than the max delay', async () => {
    const post = jest
      .fn()
      .mockRejectedValue(httpError(429, { 'retry-after': '60' }));

    await expect(
      createProvider(post).generateText({ userPrompt: 'oi' }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('caps each attempt timeout to the remaining budget', async () => {
    const post = jest.fn().mockResolvedValue(okResponse());

    await createProvider(post).generateText({ userPrompt: 'oi' });

    const attemptTimeout = post.mock.calls[0][2].timeout as number;
    expect(attemptTimeout).toBeLessThanOrEqual(45000);
    expect(attemptTimeout).toBeGreaterThan(40000);
  });
});
