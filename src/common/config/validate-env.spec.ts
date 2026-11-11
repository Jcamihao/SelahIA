import {
  assertValidEnvironment,
  readEnvInt,
  validateEnvironment,
} from './validate-env';

const prod = {
  NODE_ENV: 'production',
  GEMINI_API_KEY: 'k',
  SELAH_APP_KEYS: 'LumenBack:' + 'a'.repeat(32),
};

describe('validateEnvironment', () => {
  it('aceita uma configuracao de producao completa', () => {
    expect(validateEnvironment(prod)).toEqual({ errors: [], warnings: [] });
  });

  it('em producao exige GEMINI_API_KEY com o provider gemini', () => {
    const { errors } = validateEnvironment({ ...prod, GEMINI_API_KEY: '' });
    expect(errors).toEqual([expect.stringContaining('GEMINI_API_KEY')]);
  });

  it('fora de producao so avisa da falta de GEMINI_API_KEY', () => {
    const result = validateEnvironment({ NODE_ENV: 'development' });
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      expect.stringContaining('GEMINI_API_KEY'),
    ]);
  });

  it('nao exige GEMINI_API_KEY quando o provider ativo e ollama', () => {
    const { errors, warnings } = validateEnvironment({
      ...prod,
      LLM_PROVIDER: 'ollama',
      GEMINI_API_KEY: '',
    });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('em producao exige alguma chave de API interna', () => {
    const { errors } = validateEnvironment({ ...prod, SELAH_APP_KEYS: '' });
    expect(errors).toEqual([expect.stringContaining('SELAH_APP_KEYS')]);
  });

  it('aceita a chave legada no lugar da chave por app', () => {
    const { errors } = validateEnvironment({
      ...prod,
      SELAH_APP_KEYS: '',
      SELAH_INTERNAL_API_KEYS: 'legacy',
    });
    expect(errors).toEqual([]);
  });

  it.each([
    ['PORT', 'abc'],
    ['PORT', '70000'],
    ['GEMINI_TIMEOUT_MS', '-5'],
    ['GEMINI_TIMEOUT_MS', '45s'],
    ['GEMINI_MAX_RETRIES', '9'],
    ['GEMINI_RETRY_BASE_MS', '0'],
    ['GEMINI_STRUCTURED_THINKING_BUDGET', '1.5'],
    ['OLLAMA_TIMEOUT_MS', 'x'],
  ])('rejeita %s=%s', (name, value) => {
    const { errors } = validateEnvironment({ ...prod, [name]: value });
    expect(errors).toEqual([expect.stringContaining(name)]);
  });

  it.each([
    ['GEMINI_INVALID_JSON_RETRIES', '3'],
    ['LLM_MAX_CONCURRENCY', '-1'],
    ['LLM_MAX_QUEUE', 'muitas'],
    ['LLM_QUEUE_TIMEOUT_MS', '0'],
    ['LLM_CIRCUIT_FAILURE_THRESHOLD', '1.5'],
    ['LLM_CIRCUIT_OPEN_MS', '0'],
    ['SELAH_DAILY_TOKEN_BUDGET', '-10'],
    ['SELAH_DAILY_TOKEN_BUDGET', 'infinito'],
    ['SELAH_TOKEN_BUDGETS', 'LumenBack'],
    ['SELAH_TOKEN_BUDGETS', 'LumenBack:abc'],
    ['SELAH_TRUST_PROXY', 'true'],
    ['SELAH_TRUST_PROXY', 'qualquer coisa'],
  ])('rejeita a variavel de resiliencia %s=%s', (name, value) => {
    const { errors } = validateEnvironment({ ...prod, [name]: value });
    expect(errors).toEqual([expect.stringContaining(name)]);
  });

  it('aceita a configuracao de resiliencia valida (inclusive 0 para desligar)', () => {
    const { errors } = validateEnvironment({
      ...prod,
      GEMINI_INVALID_JSON_RETRIES: '0',
      LLM_MAX_CONCURRENCY: '0',
      LLM_MAX_QUEUE: '0',
      LLM_CIRCUIT_FAILURE_THRESHOLD: '0',
      SELAH_DAILY_TOKEN_BUDGET: '1000000',
      SELAH_TOKEN_BUDGETS: 'LumenBack:500000,AgilisBack:0',
      SELAH_TRUST_PROXY: 'loopback,10.0.0.0/8',
    });
    expect(errors).toEqual([]);
  });

  it('readEnvInt usa o padrao quando vazio e lanca com o nome da variavel quando invalido', () => {
    expect(readEnvInt('LLM_MAX_CONCURRENCY', 10, {})).toBe(10);
    expect(
      readEnvInt('LLM_MAX_CONCURRENCY', 10, { LLM_MAX_CONCURRENCY: ' ' }),
    ).toBe(10);
    expect(
      readEnvInt('LLM_MAX_CONCURRENCY', 10, { LLM_MAX_CONCURRENCY: '3' }),
    ).toBe(3);
    expect(() =>
      readEnvInt('LLM_MAX_CONCURRENCY', 10, { LLM_MAX_CONCURRENCY: '99999' }),
    ).toThrow('LLM_MAX_CONCURRENCY');
  });

  it.each(['GEMINI_API_BASE_URL', 'OLLAMA_BASE_URL'])(
    'rejeita %s que nao e URL http(s)',
    (name) => {
      for (const value of ['localhost:11434', 'ftp://host', 'nao e url']) {
        const { errors } = validateEnvironment({ ...prod, [name]: value });
        expect(errors).toEqual([expect.stringContaining(name)]);
      }
    },
  );

  it('rejeita LLM_PROVIDER desconhecido em vez de cair em gemini sem avisar', () => {
    const { errors } = validateEnvironment({ ...prod, LLM_PROVIDER: 'gemni' });
    expect(errors).toEqual([expect.stringContaining('LLM_PROVIDER')]);
  });

  it('variaveis vazias ou ausentes usam o padrao e nao dao erro', () => {
    const { errors } = validateEnvironment({
      ...prod,
      PORT: '',
      GEMINI_TIMEOUT_MS: '  ',
      GEMINI_MAX_RETRIES: undefined,
    });
    expect(errors).toEqual([]);
  });
});

describe('assertValidEnvironment', () => {
  it('lanca com todos os erros de uma vez, sem valores secretos', () => {
    const run = () =>
      assertValidEnvironment({
        NODE_ENV: 'production',
        GEMINI_API_KEY: '',
        PORT: 'abc',
      });
    expect(run).toThrow(/GEMINI_API_KEY/);
    expect(run).toThrow(/PORT/);
    expect(run).toThrow(/SELAH_APP_KEYS/);
  });

  it('devolve os avisos quando nao ha erro', () => {
    expect(assertValidEnvironment({ NODE_ENV: 'development' })).toEqual([
      expect.stringContaining('GEMINI_API_KEY'),
    ]);
  });
});
