const APP_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

// "App:valor,Outro:valor" -> Map. Estrito: entrada malformada lanca (o Selah nao sobe), em vez de
// ignorar o teto de um app sem avisar.
export const parseAppLimitList = (
  raw: string | undefined,
  label: string,
): Map<string, number> => {
  const limits = new Map<string, number>();
  String(raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const separator = entry.lastIndexOf(':');
      const app = separator > 0 ? entry.slice(0, separator).trim() : '';
      const text = separator > 0 ? entry.slice(separator + 1).trim() : '';
      const value = Number(text);
      if (
        !APP_NAME_PATTERN.test(app) ||
        !text ||
        !Number.isInteger(value) ||
        value < 0
      ) {
        throw new Error(
          `${label} invalido em "${entry}": esperado App:inteiro>=0.`,
        );
      }
      limits.set(app, value);
    });
  return limits;
};
