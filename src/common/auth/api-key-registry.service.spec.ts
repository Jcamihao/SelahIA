import { ApiKeyRegistry } from './api-key-registry.service';

describe('ApiKeyRegistry', () => {
  const originalEnv = { ...process.env };

  const create = (env: Record<string, string | undefined>) => {
    process.env = { ...originalEnv, ...env };
    delete process.env.SELAH_APP_KEYS;
    delete process.env.SELAH_INTERNAL_API_KEYS;
    Object.entries(env).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
    return new ApiKeyRegistry();
  };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('identifies the app that owns a key', () => {
    const registry = create({
      SELAH_APP_KEYS: 'LumenBack:key-lumen,PraiseAppBack:key-praise',
    });

    expect(registry.authenticate('key-lumen')).toEqual({
      kind: 'app',
      app: 'LumenBack',
      bucketId: 'app:LumenBack',
    });
    expect(registry.authenticate('key-praise')).toMatchObject({
      app: 'PraiseAppBack',
    });
  });

  it('rejects unknown and empty keys', () => {
    const registry = create({ SELAH_APP_KEYS: 'LumenBack:key-lumen' });

    expect(registry.authenticate('outra-chave')).toBeNull();
    expect(registry.authenticate('')).toBeNull();
    expect(registry.authenticate('key-lume')).toBeNull();
  });

  it('accepts several keys for the same app so keys can be rotated', () => {
    const registry = create({
      SELAH_APP_KEYS: 'LumenBack:old-key,LumenBack:new-key',
    });

    expect(registry.authenticate('old-key')).toMatchObject({ app: 'LumenBack' });
    expect(registry.authenticate('new-key')).toMatchObject({ app: 'LumenBack' });
  });

  it('treats SELAH_INTERNAL_API_KEYS as legacy keys without an app identity', () => {
    const registry = create({ SELAH_INTERNAL_API_KEYS: 'legacy-key' });

    const caller = registry.authenticate('legacy-key');
    expect(caller?.kind).toBe('legacy');
    expect(caller?.bucketId).toMatch(/^legacy:[0-9a-f]{12}$/);
  });

  it('reports whether any key is configured', () => {
    expect(create({}).hasKeys()).toBe(false);
    expect(create({ SELAH_APP_KEYS: 'LumenBack:k' }).hasKeys()).toBe(true);
    expect(create({ SELAH_INTERNAL_API_KEYS: 'k' }).hasKeys()).toBe(true);
  });

  it('refuses to boot when the same key belongs to two apps', () => {
    expect(() =>
      create({ SELAH_APP_KEYS: 'LumenBack:same-key,PraiseAppBack:same-key' }),
    ).toThrow('mesma chave');
  });

  it('refuses malformed entries without leaking the key in the message', () => {
    expect(() => create({ SELAH_APP_KEYS: 'segredo-sem-app' })).toThrow(
      'entrada 1',
    );
    expect(() => create({ SELAH_APP_KEYS: 'segredo-sem-app' })).not.toThrow(
      /segredo-sem-app/,
    );
    expect(() => create({ SELAH_APP_KEYS: 'App Invalido:k' })).toThrow();
    expect(() => create({ SELAH_APP_KEYS: 'LumenBack:' })).toThrow();
  });

  it('refuses the known development key in production only', () => {
    expect(() =>
      create({ NODE_ENV: 'production', SELAH_INTERNAL_API_KEYS: 'selah-dev-key' }),
    ).toThrow('desenvolvimento');
    expect(() =>
      create({ NODE_ENV: 'production', SELAH_APP_KEYS: 'LumenBack:selah-dev-key' }),
    ).toThrow('desenvolvimento');
    expect(() =>
      create({ NODE_ENV: 'development', SELAH_INTERNAL_API_KEYS: 'selah-dev-key' }),
    ).not.toThrow();
  });
});
