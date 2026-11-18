// Leitura de campos da saida do modelo, usada pelos validadores dos adapters.
// Valor falso (0, false, '') conta como ausente, igual a null e undefined.
type Payload = Record<string, unknown>;

export const readRequiredString = (
  payload: Payload,
  key: string,
  maxLength = 1200,
) => {
  const value = String(payload[key] || '').trim();
  if (!value) {
    throw new Error(`Campo obrigatório ausente: ${key}`);
  }
  return value.slice(0, maxLength);
};

// Lista de textos: descarta itens vazios, limita a quantidade e o tamanho. Sem lista vira [].
// Com `minItems`, lanca se sobrar menos itens que isso.
export const readStringArray = (
  payload: Payload,
  key: string,
  maxItems = 8,
  maxLength = 240,
  minItems = 0,
) => {
  const value = payload[key];
  const items = (Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength));
  if (items.length < minItems) {
    throw new Error(`Campo obrigatório ausente: ${key}`);
  }
  return items;
};
