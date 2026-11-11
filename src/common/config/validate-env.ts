import { parseAppLimitList } from './app-limits';
import { parseTrustProxy } from '../http/trust-proxy';

export type EnvValidationResult = { errors: string[]; warnings: string[] };

type Env = Record<string, string | undefined>;

// Variaveis inteiras e seus limites: fonte unica para a validacao do boot e para `readEnvInt`.
export const INT_ENV_SPECS: Record<string, { min: number; max: number }> = {
  PORT: { min: 1, max: 65535 },
  GEMINI_TIMEOUT_MS: { min: 1, max: 3_600_000 },
  GEMINI_MAX_RETRIES: { min: 0, max: 5 },
  GEMINI_RETRY_BASE_MS: { min: 1, max: 600_000 },
  GEMINI_RETRY_MAX_DELAY_MS: { min: 1, max: 600_000 },
  GEMINI_STRUCTURED_THINKING_BUDGET: { min: 0, max: 100_000 },
  // Tentativas extras quando o Gemini devolve JSON invalido ou fora do schema.
  GEMINI_INVALID_JSON_RETRIES: { min: 0, max: 2 },
  OLLAMA_TIMEOUT_MS: { min: 1, max: 3_600_000 },
  // 0 desliga o limite de concorrencia.
  LLM_MAX_CONCURRENCY: { min: 0, max: 1000 },
  LLM_MAX_QUEUE: { min: 0, max: 10_000 },
  LLM_QUEUE_TIMEOUT_MS: { min: 1, max: 600_000 },
  // 0 desliga o circuit breaker.
  LLM_CIRCUIT_FAILURE_THRESHOLD: { min: 0, max: 1000 },
  LLM_CIRCUIT_OPEN_MS: { min: 1, max: 3_600_000 },
};

const text = (value: string | undefined) => String(value ?? '').trim();

const isProduction = (env: Env) => text(env.NODE_ENV) === 'production';

const activeProvider = (env: Env) =>
  text(env.LLM_PROVIDER).toLowerCase() === 'ollama' ? 'ollama' : 'gemini';

// Le um inteiro do ambiente com os limites de INT_ENV_SPECS. Vazio ou ausente = padrao; invalido lanca.
export const readEnvInt = (
  name: string,
  fallback: number,
  env: Env = process.env,
): number => {
  const raw = text(env[name]);
  if (!raw) return fallback;
  const spec = INT_ENV_SPECS[name];
  const value = Number(raw);
  if (
    !Number.isInteger(value) ||
    (spec && (value < spec.min || value > spec.max))
  ) {
    throw new Error(
      `${name} invalido: "${raw}"${spec ? ` (esperado inteiro entre ${spec.min} e ${spec.max})` : ''}.`,
    );
  }
  return value;
};

// Valida a configuracao antes de subir. Hoje valores invalidos caem em padroes sem avisar
// (ex.: GEMINI_TIMEOUT_MS=abc vira 45000); aqui o erro aparece no boot, com o nome da variavel.
export const validateEnvironment = (
  env: Env = process.env,
): EnvValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const production = isProduction(env);

  for (const [name, spec] of Object.entries(INT_ENV_SPECS)) {
    const raw = text(env[name]);
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < spec.min || value > spec.max) {
      errors.push(
        `${name} invalido: "${raw}" (esperado inteiro entre ${spec.min} e ${spec.max}).`,
      );
    }
  }

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
  url('GEMINI_API_BASE_URL');
  url('OLLAMA_BASE_URL');

  const dailyBudget = text(env.SELAH_DAILY_TOKEN_BUDGET);
  if (dailyBudget) {
    const value = Number(dailyBudget);
    if (!Number.isInteger(value) || value < 0) {
      errors.push(
        `SELAH_DAILY_TOKEN_BUDGET invalido: "${dailyBudget}" (esperado inteiro >= 0).`,
      );
    }
  }
  try {
    parseAppLimitList(env.SELAH_TOKEN_BUDGETS, 'SELAH_TOKEN_BUDGETS');
  } catch (error) {
    errors.push((error as Error).message);
  }

  const trustProxy = parseTrustProxy(env.SELAH_TRUST_PROXY);
  if (trustProxy instanceof Error) {
    errors.push(trustProxy.message);
  }

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
