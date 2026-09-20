export type ActiveLlmProvider = 'ollama' | 'gemini';

// Gemini e o provider padrao; Ollama so entra com LLM_PROVIDER=ollama explicito.
export const resolveActiveLlmProvider = (): ActiveLlmProvider => {
  const explicit = String(process.env.LLM_PROVIDER || '')
    .trim()
    .toLowerCase();
  return explicit === 'ollama' ? 'ollama' : 'gemini';
};

export const resolveActiveProviderLabel = () =>
  resolveActiveLlmProvider() === 'gemini' ? 'gemini-developer-api' : 'ollama';
