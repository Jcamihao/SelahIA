// POST JSON com o fetch nativo do Node. Devolve e lanca no mesmo formato que o axios usava
// ({ data } no sucesso; { response: { status, headers, data }, code } no erro), para o
// GeminiProvider decidir retry e motivo sem mudar.
type PostJsonOptions = { headers?: Record<string, string>; timeout: number };

export async function postJson<T>(
  url: string,
  body: unknown,
  { headers, timeout }: PostJsonOptions,
): Promise<{ data: T }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      // Orcamento esgotado (<= 0) aborta na hora, em vez de ficar sem limite.
      signal: AbortSignal.timeout(Math.max(1, Math.round(timeout))),
    });
  } catch (error: any) {
    const timedOut = error?.name === 'TimeoutError';
    // Erro de rede do fetch vem como TypeError('fetch failed') com o codigo em `cause`.
    throw { code: timedOut ? 'ECONNABORTED' : error?.cause?.code };
  }

  const data = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw {
      response: {
        status: res.status,
        headers: { 'retry-after': res.headers.get('retry-after') ?? undefined },
        data,
      },
    };
  }
  return { data: (data ?? {}) as T };
}
