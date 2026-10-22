import { Logger } from '@nestjs/common';
import { GerarRascunhoDto } from './dto/gerar-rascunho.dto';
import {
  buildRascunhoClinicoSystemInstruction,
  buildRascunhoClinicoUserPrompt,
} from './rascunho-clinico.prompt';
import { RASCUNHO_CLINICO_SCHEMA } from './rascunho-clinico.schemas';
import { RascunhoClinicoService } from './rascunho-clinico.service';

const dto: GerarRascunhoDto = {
  tipoDocumento: 'evolucao',
  abordagem: 'TCC',
  textoAnonimizado: '[PACIENTE] relatou ansiedade antes da reuniao.',
};

// Espelha o contrato real do provedor: `data` e o retorno de `validate(parsed)`.
const createService = (parsed: unknown) => {
  const generateStructured = jest.fn(async (call: any) => ({
    data: call.validate(parsed),
    text: JSON.stringify(parsed),
    model: 'gemini-test',
    raw: {},
  }));
  const service = new RascunhoClinicoService(
    { generateStructured } as any,
    { getRequestId: () => 'req-1' } as any,
  );
  return { service, generateStructured };
};

describe('RascunhoClinicoService.gerar', () => {
  it('chama generateStructured com a instrucao da abordagem e valida a resposta', async () => {
    const { service, generateStructured } = createService({
      rascunho: 'Paciente relatou ansiedade.',
    });

    const result = await service.gerar(dto);

    expect(generateStructured).toHaveBeenCalledTimes(1);
    const call = generateStructured.mock.calls[0][0];
    expect(call.systemInstruction).toBe(
      buildRascunhoClinicoSystemInstruction(dto.abordagem, dto.tipoDocumento),
    );
    expect(call.userPrompt).toBe(buildRascunhoClinicoUserPrompt(dto));
    expect(call.responseSchema).toBe(RASCUNHO_CLINICO_SCHEMA);
    expect(call.temperature).toBe(0.2);
    expect(call.maxOutputTokens).toBe(1500);
    expect(result.rascunho).toBe('Paciente relatou ansiedade.');
    expect(result.model).toBe('gemini-test');
    expect(typeof result.provider).toBe('string');
    expect(typeof result.version).toBe('string');
    expect(Number.isNaN(Date.parse(result.generatedAt))).toBe(false);
  });

  it('propaga a falha da validacao quando o modelo devolve rascunho vazio', async () => {
    const { service } = createService({ rascunho: '   ' });

    await expect(service.gerar(dto)).rejects.toMatchObject({ status: 502 });
  });

  describe('privacidade dos logs', () => {
    const NOTA_MARKER = 'NOTA_CLINICA_SECRETA_91bd';
    const MODELO_MARKER = 'SAIDA_MODELO_SECRETA_5c02';
    let logged: string[];

    beforeEach(() => {
      logged = [];
      for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
        jest.spyOn(Logger.prototype, level).mockImplementation((message: any) => {
          logged.push(String(message));
        });
      }
    });

    afterEach(() => jest.restoreAllMocks());

    const expectNoMarkerInLogs = () => {
      expect(logged.length).toBeGreaterThan(0);
      expect(logged.filter((line) => line.includes(NOTA_MARKER))).toEqual([]);
      expect(logged.filter((line) => line.includes(MODELO_MARKER))).toEqual([]);
    };

    it('caminho feliz: nem a nota nem a saida do modelo aparecem nos logs', async () => {
      const { service } = createService({ rascunho: `${MODELO_MARKER} Paciente relatou...` });

      await service.gerar({ ...dto, textoAnonimizado: `[PACIENTE] disse ${NOTA_MARKER}` });

      expectNoMarkerInLogs();
    });

    it('caminho de erro: a mensagem da falha nao vaza a nota nem a saida do modelo', async () => {
      const failing = new RascunhoClinicoService(
        {
          generateStructured: jest
            .fn()
            .mockRejectedValue(new Error(`${NOTA_MARKER} ${MODELO_MARKER}`)),
        } as any,
        { getRequestId: () => 'req-1' } as any,
      );

      await failing
        .gerar({ ...dto, textoAnonimizado: `[PACIENTE] disse ${NOTA_MARKER}` })
        .catch(() => undefined);

      expectNoMarkerInLogs();
    });
  });
});
