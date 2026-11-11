// O nginx fica na mesma maquina e o Docker entrega a conexao vinda de um IP privado (bridge), entao
// por padrao confiamos em loopback e faixas privadas: ai `request.ip` e o IP do cliente de verdade
// e um X-Forwarded-For forjado pelo cliente nao engana o log. `true` (confiar em qualquer um) nao e
// aceito: reabriria a falsificacao.
export const DEFAULT_TRUST_PROXY = 'loopback,uniquelocal';

const KEYWORDS = new Set(['loopback', 'linklocal', 'uniquelocal']);
const IP_OR_CIDR = /^[0-9a-fA-F:.]+(\/\d{1,3})?$/;

export type TrustProxySetting = boolean | number | string[];

export const parseTrustProxy = (
  raw: string | undefined,
): TrustProxySetting | Error => {
  const text = String(raw ?? '').trim();
  if (!text) return parseTrustProxy(DEFAULT_TRUST_PROXY);

  const lower = text.toLowerCase();
  if (lower === 'false' || lower === 'off' || lower === '0') return false;
  if (/^\d+$/.test(text)) return Number(text);

  const entries = text
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const invalid = entries.some(
    (entry) => !KEYWORDS.has(entry.toLowerCase()) && !IP_OR_CIDR.test(entry),
  );
  if (!entries.length || invalid) {
    return new Error(
      'SELAH_TRUST_PROXY invalido: use false, um numero de saltos ou uma lista de loopback, linklocal, uniquelocal, IPs ou CIDRs (nao use true).',
    );
  }
  return entries;
};
