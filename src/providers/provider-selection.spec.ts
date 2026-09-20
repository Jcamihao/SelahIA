import {
  resolveActiveLlmProvider,
  resolveActiveProviderLabel,
} from './provider-selection';

describe('provider-selection', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults to gemini when LLM_PROVIDER is missing or empty', () => {
    delete process.env.LLM_PROVIDER;
    expect(resolveActiveLlmProvider()).toBe('gemini');

    process.env.LLM_PROVIDER = '   ';
    expect(resolveActiveLlmProvider()).toBe('gemini');
  });

  it('uses ollama only when explicitly requested, ignoring case and spaces', () => {
    process.env.LLM_PROVIDER = ' Ollama ';
    expect(resolveActiveLlmProvider()).toBe('ollama');
  });

  it('falls back to gemini for unknown values instead of failing', () => {
    process.env.LLM_PROVIDER = 'openai';
    expect(resolveActiveLlmProvider()).toBe('gemini');
  });

  it('does not let GEMINI_API_KEY or OLLAMA_* change the choice', () => {
    process.env.LLM_PROVIDER = 'ollama';
    process.env.GEMINI_API_KEY = 'some-key';
    expect(resolveActiveLlmProvider()).toBe('ollama');
  });

  it('exposes the label used in adapter responses and /health', () => {
    delete process.env.LLM_PROVIDER;
    expect(resolveActiveProviderLabel()).toBe('gemini-developer-api');

    process.env.LLM_PROVIDER = 'ollama';
    expect(resolveActiveProviderLabel()).toBe('ollama');
  });
});
