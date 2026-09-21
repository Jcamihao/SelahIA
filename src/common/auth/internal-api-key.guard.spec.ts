import { HttpException } from '@nestjs/common';
import { RequestContextService } from '../logging/request-context.service';
import { ApiKeyRegistry } from './api-key-registry.service';
import { InternalApiKeyGuard } from './internal-api-key.guard';
import { RateLimiterService } from './rate-limiter.service';

describe('InternalApiKeyGuard', () => {
  const originalEnv = { ...process.env };

  const setup = (env: Record<string, string> = {}) => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    delete process.env.SELAH_APP_KEYS;
    delete process.env.SELAH_INTERNAL_API_KEYS;
    delete process.env.SELAH_ALLOWED_SOURCE_APPS;
    delete process.env.SELAH_RATE_LIMIT_PER_MINUTE;
    delete process.env.SELAH_RATE_LIMITS;
    Object.assign(process.env, env);

    const requestContext = new RequestContextService();
    const guard = new InternalApiKeyGuard(
      requestContext,
      new ApiKeyRegistry(),
      new RateLimiterService(),
    );

    const responses: Array<{ setHeader: jest.Mock }> = [];
    const call = (headers: Record<string, string>) => {
      const response = { setHeader: jest.fn() };
      responses.push(response);
      const executionContext = {
        switchToHttp: () => ({
          getRequest: () => ({ headers }),
          getResponse: () => response,
        }),
      } as any;
      let resolvedApp = '';
      const result = requestContext.run(
        {
          requestId: 'req-1',
          sourceApp: headers['x-source-app'] || 'unknown',
          method: 'POST',
          path: '/x',
          startedAt: Date.now(),
        },
        () => {
          const allowed = guard.canActivate(executionContext);
          resolvedApp = requestContext.getSourceApp();
          return allowed;
        },
      );
      return { result, resolvedApp, response };
    };

    return { call, responses };
  };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('is open in development when no keys are configured', () => {
    const { call } = setup();

    expect(call({}).result).toBe(true);
  });

  it('answers 503 in production when no keys are configured', () => {
    const { call } = setup({ NODE_ENV: 'production' });

    expect(() => call({})).toThrow('not configured');
  });

  it('rejects missing and invalid keys with 401', () => {
    const { call } = setup({ SELAH_APP_KEYS: 'LumenBack:key-lumen' });

    expect(() => call({})).toThrow('Invalid Selah IA API key');
    expect(() => call({ 'x-selah-api-key': 'errada' })).toThrow(
      'Invalid Selah IA API key',
    );
  });

  it('takes the app identity from the key, ignoring a spoofed X-Source-App', () => {
    const { call } = setup({
      SELAH_APP_KEYS: 'LumenBack:key-lumen,PraiseAppBack:key-praise',
    });

    const spoofed = call({
      'x-selah-api-key': 'key-lumen',
      'x-source-app': 'PraiseAppBack',
    });

    expect(spoofed.result).toBe(true);
    expect(spoofed.resolvedApp).toBe('LumenBack');
  });

  it('resolves the app from the key even without the header', () => {
    const { call } = setup({ SELAH_APP_KEYS: 'LumenBack:key-lumen' });

    expect(call({ 'x-selah-api-key': 'key-lumen' }).resolvedApp).toBe(
      'LumenBack',
    );
  });

  it('keeps the legacy behavior for SELAH_INTERNAL_API_KEYS: header identity and allowlist', () => {
    const { call } = setup({
      SELAH_INTERNAL_API_KEYS: 'legacy-key',
      SELAH_ALLOWED_SOURCE_APPS: 'LumenBack',
    });

    const allowed = call({
      'x-selah-api-key': 'legacy-key',
      'x-source-app': 'LumenBack',
    });
    expect(allowed.resolvedApp).toBe('LumenBack');
    expect(() =>
      call({ 'x-selah-api-key': 'legacy-key', 'x-source-app': 'Intruso' }),
    ).toThrow('Source application not allowed');
  });

  it('does not apply the source allowlist to per-app keys', () => {
    const { call } = setup({
      SELAH_APP_KEYS: 'PraiseAppBack:key-praise',
      SELAH_ALLOWED_SOURCE_APPS: 'LumenBack',
    });

    expect(call({ 'x-selah-api-key': 'key-praise' }).result).toBe(true);
  });

  it('answers 429 with Retry-After when an app exceeds its limit, without affecting others', () => {
    const { call, responses } = setup({
      SELAH_APP_KEYS: 'LumenBack:key-lumen,PraiseAppBack:key-praise',
      SELAH_RATE_LIMITS: 'LumenBack:2',
    });
    const lumen = { 'x-selah-api-key': 'key-lumen' };

    call(lumen);
    call(lumen);
    let error: HttpException | undefined;
    try {
      call(lumen);
    } catch (caught) {
      error = caught as HttpException;
    }

    expect(error?.getStatus()).toBe(429);
    expect((error?.getResponse() as any).retryAfterSeconds).toBeGreaterThan(0);
    expect(responses[2].setHeader).toHaveBeenCalledWith(
      'Retry-After',
      expect.stringMatching(/^\d+$/),
    );
    expect(responses[0].setHeader).not.toHaveBeenCalled();

    expect(call({ 'x-selah-api-key': 'key-praise' }).result).toBe(true);
  });
});
