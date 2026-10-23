import { BadGatewayException, Logger } from '@nestjs/common';
import { OllamaProvider } from './ollama.provider';

// Erro do upstream nao pode vazar texto livre (pode repetir conteudo da requisicao) para log nem 502.
describe('OllamaProvider error redaction', () => {
  const MARKER = 'NOTA_SECRETA_7f3a';
  let logged: string[];

  const run = async (error: unknown) => {
    const provider = new OllamaProvider({
      getRequestId: () => 'test-request',
      getSourceApp: () => 'test',
    } as any);
    (provider as any).httpClient = { post: jest.fn().mockRejectedValue(error) };
    return provider
      .generateTextFromContents({ contents: [{ parts: [{ text: 'oi' }] }] })
      .then(
        () => {
          throw new Error('deveria falhar');
        },
        (e: Error) => e,
      );
  };

  beforeEach(() => {
    logged = [];
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      jest
        .spyOn(Logger.prototype, level)
        .mockImplementation((message: any) => {
          logged.push(String(message));
        });
    }
  });

  afterEach(() => jest.restoreAllMocks());

  it('nao loga nem devolve o campo error do Ollama', async () => {
    const error = await run({
      message: `falhou ${MARKER}`,
      response: { status: 500, data: { error: `eco ${MARKER}` } },
    });

    expect(error).toBeInstanceOf(BadGatewayException);
    expect(error.message).toBe('Ollama request failed status=500 reason=unknown');
    expect(error.message).not.toContain(MARKER);
    expect(logged.length).toBeGreaterThan(0);
    expect(logged.filter((line) => line.includes(MARKER))).toEqual([]);
  });

  it('erro de rede sem status mostra o codigo e nao a mensagem', async () => {
    const error = await run({ code: 'ECONNREFUSED', message: MARKER });

    expect(error.message).toBe(
      'Ollama request failed status=n/a reason=ECONNREFUSED',
    );
    expect(logged.filter((line) => line.includes(MARKER))).toEqual([]);
  });

  it('codigo que seja texto livre nao aparece', async () => {
    const error = await run({ code: `texto livre ${MARKER}`, message: MARKER });

    expect(error.message).toBe('Ollama request failed status=n/a reason=unknown');
    expect(logged.filter((line) => line.includes(MARKER))).toEqual([]);
  });
});
