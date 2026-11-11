export type TokenUsage = { prompt: number; output: number; total: number };

const count = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

// Le os tokens da resposta crua do Gemini (usageMetadata). O Ollama nao devolve contagem em `raw`
// (so o conteudo), entao ali o resultado e zero e nenhum teto de tokens se aplica.
export const extractTokenUsage = (raw: unknown): TokenUsage => {
  const usage = (raw as { usageMetadata?: Record<string, unknown> } | null)
    ?.usageMetadata;
  if (!usage || typeof usage !== 'object') {
    return { prompt: 0, output: 0, total: 0 };
  }

  const prompt = count(usage.promptTokenCount);
  const output = count(usage.candidatesTokenCount);
  const thoughts = count(usage.thoughtsTokenCount);
  const total = count(usage.totalTokenCount) || prompt + output + thoughts;
  return { prompt, output: output + thoughts, total };
};
