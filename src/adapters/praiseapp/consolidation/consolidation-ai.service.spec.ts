import { ConsolidationAiService } from './consolidation-ai.service';
import {
  buildConsolidationPlaybookPrompt,
  buildConsolidationSentimentPrompt,
} from './consolidation-ai.prompt';

// Espelha o contrato real dos providers: `data` e o retorno de `validate(parsed)`.
const providerLikeStructuredOutput = (parsed: unknown) => ({
  generate: jest.fn(async (input: any) => ({
    data: input.validate(parsed),
    model: 'test-model',
  })),
});

describe('ConsolidationAiService', () => {
  const sentiment = {
    sentiment: 'positivo',
    score: 0.7,
    summary: 'Visitante animado.',
    pastoralInsight: 'Convide para o grupo de novos.',
  };
  const playbook = {
    weeks: [
      { weekNumber: 1, goal: 'Acolher', actions: ['Ligar'], script: 'Oi, Ana!' },
    ],
    personalizedInsights: 'Ana valoriza comunidade.',
  };

  it('returns the analysis object, not the validator boolean', async () => {
    const service = new ConsolidationAiService(
      providerLikeStructuredOutput(sentiment) as any,
    );

    const result = await service.analyzeSentiment({
      memberName: 'Ana',
      content: 'Amei o culto',
    });

    expect(result).toEqual(sentiment);
  });

  it('returns the playbook object, not the validator boolean', async () => {
    const service = new ConsolidationAiService(
      providerLikeStructuredOutput(playbook) as any,
    );

    const result = await service.generatePlaybook({
      memberName: 'Ana',
      memberContext: 'Veio pela primeira vez',
      recentActivity: 'Culto de domingo',
    });

    expect(result).toEqual(playbook);
  });

  it('rejects a sentiment payload without a numeric score', async () => {
    const service = new ConsolidationAiService(
      providerLikeStructuredOutput({ ...sentiment, score: 'alto' }) as any,
    );

    await expect(
      service.analyzeSentiment({ memberName: 'Ana', content: 'ok' }),
    ).rejects.toThrow();
  });

  it('rejects a playbook payload without weeks', async () => {
    const service = new ConsolidationAiService(
      providerLikeStructuredOutput({ personalizedInsights: 'x' }) as any,
    );

    await expect(
      service.generatePlaybook({ memberName: 'Ana' }),
    ).rejects.toThrow();
  });

  it('builds a sentiment prompt specific to church visitors', () => {
    const prompt = buildConsolidationSentimentPrompt({
      memberName: 'Ana',
      content: 'Amei o culto',
    });

    expect(prompt).toContain('Visitante: Ana');
    expect(prompt).toContain('"Amei o culto"');
    expect(prompt).toContain('"positivo", "neutro" ou "negativo"');
    expect(prompt).toContain('líder de consolidação');
  });

  it('builds a 4-week playbook prompt and marks missing family context', () => {
    const prompt = buildConsolidationPlaybookPrompt({
      memberName: 'Ana',
      memberContext: 'Veio pela primeira vez',
      recentActivity: 'Culto de domingo',
    });

    expect(prompt).toContain('4 semanas');
    expect(prompt).toContain('novo visitante Ana');
    expect(prompt).toContain('Veio pela primeira vez');
    expect(prompt).toContain('Não informado');
  });
});
