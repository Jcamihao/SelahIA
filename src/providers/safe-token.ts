// Unicos formatos de motivo que podem ir para log e 502: texto livre do upstream nunca passa.
const UPPER_ENUM = /^[A-Z_]{3,40}$/;
const REASON_TOKEN = /^[A-Za-z_]{1,40}$/;

// Enum em maiusculas (ex.: STOP, RESOURCE_EXHAUSTED, ECONNRESET).
export const isUpperEnum = (value: unknown): value is string =>
  typeof value === 'string' && UPPER_ENUM.test(value);

export const pickUpperEnum = (value: unknown, fallback = 'unknown'): string =>
  isUpperEnum(value) ? value : fallback;

// Motivo de parada do Ollama (ex.: stop, length), que vem em minusculas.
export const pickReasonToken = (value: unknown, fallback = 'unknown'): string =>
  typeof value === 'string' && REASON_TOKEN.test(value) ? value : fallback;
