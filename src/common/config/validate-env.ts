export type EnvValidationResult = { errors: string[]; warnings: string[] };

type Env = Record<string, string | undefined>;

const text = (value: string | undefined) => String(value ?? '').trim();

const isProduction = (env: Env) => text(env.NODE_ENV) === 'production';

const activeProvider = (env: Env) =>
  text(env.LLM_PROVIDER).toLowerCase() === 'ollama' ? 'ollama' : 'gemini';

// Valida a configuracao antes de subir. Hoje valores invalidos caem em padroes sem avisar
// (ex.: GEMINI_TIMEOUT_MS=abc vira 45000); aqui o erro aparece no boot, com o nome da variavel.
export const validateEnvironment = (
  env: Env = process.env,
): EnvValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const production = isProduction(env);

  const integerInRange = (name: string, min: number, max: number) => {
    const raw = text(env[name]);
    if (!raw) return;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
      errors.push(
        `${name} invalido: "${raw}" (esperado inteiro entre ${min} e ${max}).`,
      );
    }
  };

  const url = (name: string) => {
    const raw = text(env[name]);
    if (!raw) return;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('protocolo');
      }
    } catch {
      errors.push(`${name} invalido: esperado uma URL http(s) completa.`);
    }
  };

  integerInRange('PORT', 1, 65535);
  integerInRange('GEMINI_TIMEOUT_MS', 1, 3_600_000);
  integerInRange('GEMINI_MAX_RETRIES', 0, 5);
  integerInRange('GEMINI_RETRY_BASE_MS', 1, 600_000);
  integerInRange('GEMINI_RETRY_MAX_DELAY_MS', 1, 600_000);
  integerInRange('GEMINI_STRUCTURED_THINKING_BUDGET', 0, 100_000);
  integerInRange('OLLAMA_TIMEOUT_MS', 1, 3_600_000);
  url('GEMINI_API_BASE_URL');
  url('OLLAMA_BASE_URL');

  const explicitProvider = text(env.LLM_PROVIDER).toLowerCase();
  if (explicitProvider && !['gemini', 'ollama'].includes(explicitProvider)) {
    errors.push(
      `LLM_PROVIDER invalido: "${text(env.LLM_PROVIDER)}" (esperado gemini ou ollama).`,
    );
  }

  if (activeProvider(env) === 'gemini' && !text(env.GEMINI_API_KEY)) {
    const message =
      'GEMINI_API_KEY nao configurada (provider gemini esta ativo).';
    if (production) {
      errors.push(message);
    } else {
      warnings.push(`${message} As chamadas de IA vao falhar com 503.`);
    }
  }

  if (
    production &&
    !text(env.SELAH_APP_KEYS) &&
    !text(env.SELAH_INTERNAL_API_KEYS)
  ) {
    errors.push(
      'Nenhuma chave de API interna configurada em producao (SELAH_APP_KEYS).',
    );
  }

  return { errors, warnings };
};

// Lanca com todos os problemas de uma vez; devolve os avisos para o chamador logar.
export const assertValidEnvironment = (env: Env = process.env): string[] => {
  const { errors, warnings } = validateEnvironment(env);
  if (errors.length) {
    throw new Error(
      `Configuracao invalida do Selah IA:\n- ${errors.join('\n- ')}`,
    );
  }
  return warnings;
};
