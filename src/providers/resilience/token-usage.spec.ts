import { extractTokenUsage } from './token-usage';

describe('extractTokenUsage', () => {
  it('le o usageMetadata do Gemini e soma raciocinio na saida', () => {
    expect(
      extractTokenUsage({
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 40,
          thoughtsTokenCount: 10,
          totalTokenCount: 150,
        },
      }),
    ).toEqual({ prompt: 100, output: 50, total: 150 });
  });

  it('calcula o total quando o provedor nao manda totalTokenCount', () => {
    expect(
      extractTokenUsage({
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
      }).total,
    ).toBe(15);
  });

  it.each([[undefined], [null], [{}], [{ content: 'ollama' }], ['texto']])(
    'devolve zero para %p',
    (raw) => {
      expect(extractTokenUsage(raw)).toEqual({
        prompt: 0,
        output: 0,
        total: 0,
      });
    },
  );

  it('ignora valores nao numericos ou negativos', () => {
    expect(
      extractTokenUsage({
        usageMetadata: { promptTokenCount: 'x', candidatesTokenCount: -3 },
      }),
    ).toEqual({ prompt: 0, output: 0, total: 0 });
  });
});
