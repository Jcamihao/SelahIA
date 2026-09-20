import { KidsAiService } from './kids-ai.service';
import {
  buildPraiseAppKidsAgeAdaptationsPrompt,
  buildPraiseAppKidsCheckinDailySummaryPrompt,
  buildPraiseAppKidsEventSuggestionPrompt,
  buildPraiseAppKidsLessonPlanPrompt,
  buildPraiseAppKidsNextSequencePrompt,
  buildPraiseAppKidsOperationalAssistantPrompt,
  buildPraiseAppKidsPostClassCommunicationPrompt,
  buildPraiseAppKidsWeeklyVerseExpansionPrompt,
} from './kids-ai.prompt';
import {
  validatePraiseAppKidsAgeAdaptations,
  validatePraiseAppKidsCheckinDailySummary,
  validatePraiseAppKidsEventSuggestion,
  validatePraiseAppKidsLessonPlanSuggestion,
  validatePraiseAppKidsOperationalAssistant,
  validatePraiseAppKidsPedagogicalSequence,
  validatePraiseAppKidsPostClassCommunication,
  validatePraiseAppKidsWeeklyVerseExpansion,
} from './kids-ai.schemas';

const lessonPlan = {
  suggestedTitle: 'Davi e Golias',
  biblicalReference: '1 Samuel 17',
  ageRange: '5-7 anos',
  mainObjective: 'Confiar em Deus diante dos gigantes.',
  lessonSummary: 'Davi confiou em Deus.',
  iceBreaker: 'Quem é o mais alto da sala?',
  lessonFlow: ['Abertura', 'História', 'Atividade', 'Oração'],
  activity: 'Jogo de acertar o alvo.',
  supplies: ['Bolinhas', 'Cesto'],
  prayer: 'Obrigado, Senhor.',
  takeHomeChallenge: 'Contar a história em casa.',
  messageToParents: 'Hoje falamos de Davi.',
  youtubeSearchQuery: 'davi e golias infantil',
  leaderTips: ['Use voz animada'],
  safetyNotes: ['Bolinhas macias'],
};

const checkinSummary = {
  headline: 'Domingo tranquilo',
  summaryText: '32 crianças atendidas.',
  highlights: ['Sem ocorrências'],
  actionItems: ['Reforçar equipe'],
  attentionLevel: 'baixo',
};

const sequence = {
  suggestedTitle: 'A criação',
  biblicalReference: 'Gênesis 1',
  testamentFocus: 'antigo',
  continuitySummary: 'Segue a aula anterior.',
  pedagogicalRationale: 'Equilíbrio entre testamentos.',
  memoryFocus: 'Deus criou tudo.',
  openingIdea: 'Mostrar uma planta.',
  applicationFocus: 'Cuidar da criação.',
  parentConnection: 'Conversar sobre a natureza.',
  balanceNotes: ['Antigo Testamento em foco'],
};

const verseExpansion = {
  childExplanation: 'Deus cuida de você.',
  memoryGesture: 'Abraçar a si mesmo.',
  parentPhrase: 'Deus cuida de nós.',
  prayerPrompt: 'Agradeça por hoje.',
  applicationIdea: 'Ajudar um colega.',
};

const operationalAssistant = {
  assistantSummary: 'Ajuste para turma agitada.',
  adaptedFlow: ['Movimento', 'História curta'],
  keyAdjustments: ['Reduzir tempo'],
  suppliesAdjustments: ['Menos materiais'],
  attentionResets: ['Palma, palma'],
  noScreenAlternative: 'Contar a história com fantoches.',
  leaderScript: 'Vamos lá, turma!',
  parentMessageSnippet: 'Hoje foi movimentado.',
};

const ageAdaptations = {
  baseReference: '1 Samuel 17',
  versions: [
    {
      ageRange: '3-4 anos',
      languageTone: 'Frases curtas',
      mainObjective: 'Deus cuida.',
      openingIdea: 'Canção',
      activity: 'Colorir',
      application: 'Orar',
      leaderTip: 'Repetir',
      durationMin: 20.4,
    },
  ],
};

const postClass = {
  suggestedNoticeTitle: 'Aula de hoje',
  parentMessage: 'Falamos de Davi.',
  lessonSummary: 'Davi venceu com fé.',
  weeklyChallenge: 'Orar em família.',
  verseReinforcement: '1 Samuel 17:47',
};

const eventSuggestion = {
  suggestedTitle: 'Tarde de Família',
  suggestedNoticeTitle: 'Venha participar',
  description: 'Uma tarde de brincadeiras.',
  checklist: ['Lanche', 'Música'],
  parentCommunication: 'Traga sua família.',
  programFlow: ['Recepção', 'Jogos'],
  locationSuggestion: 'Pátio da igreja',
};

const serviceMethods: Array<[string, string, string, unknown]> = [
  ['generateLessonPlan', 'suggestion', 'lesson plan', lessonPlan],
  ['generateDailyCheckinSummary', 'summary', 'check-in summary', checkinSummary],
  ['generateNextSequence', 'sequence', 'next sequence', sequence],
  ['expandWeeklyVerse', 'expansion', 'verse expansion', verseExpansion],
  ['generateOperationalAssistant', 'assistant', 'operational assistant', operationalAssistant],
  ['generateAgeAdaptations', 'adaptations', 'age adaptations', ageAdaptations],
  ['generatePostClassCommunication', 'communication', 'post-class communication', postClass],
  ['generateEventSuggestion', 'event', 'event suggestion', eventSuggestion],
];

const createService = (parsed: unknown) => {
  const generate = jest.fn(async (input: any) => ({
    data: input.validate(parsed),
    model: 'test-model',
  }));
  const service = new KidsAiService(
    { generate } as any,
    { getRequestId: () => 'test-request' } as any,
  );
  return { service, generate };
};

describe('KidsAiService', () => {
  it.each(serviceMethods)(
    '%s returns the validated %s under "%s"',
    async (method, key, _label, payload) => {
      const { service, generate } = createService(payload);

      const result = await (service as any)[method]({
        biblicalReference: 'Gênesis 1',
      });

      expect(result[key]).toBeDefined();
      expect(result.provider).toBe('gemini-developer-api');
      expect(result.model).toBe('test-model');
      expect(generate).toHaveBeenCalledTimes(1);
      expect(generate.mock.calls[0][0].systemInstruction).toContain('Selah IA');
    },
  );

  it('rejects an incomplete lesson plan instead of returning partial data', async () => {
    const { service } = createService({ ...lessonPlan, prayer: '' });

    await expect(
      service.generateLessonPlan({ biblicalReference: '1 Samuel 17' } as any),
    ).rejects.toThrow('prayer');
  });
});

describe('kids validators', () => {
  it('trims strings, caps list sizes and drops blank items', () => {
    const result = validatePraiseAppKidsLessonPlanSuggestion({
      ...lessonPlan,
      suggestedTitle: '  Davi  ',
      lessonFlow: ['a', ' ', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
      safetyNotes: 'não é lista',
    });

    expect(result.suggestedTitle).toBe('Davi');
    expect(result.lessonFlow).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(result.safetyNotes).toEqual([]);
  });

  it('rejects non-object payloads for every kids schema', () => {
    const validators = [
      validatePraiseAppKidsLessonPlanSuggestion,
      validatePraiseAppKidsCheckinDailySummary,
      validatePraiseAppKidsPedagogicalSequence,
      validatePraiseAppKidsWeeklyVerseExpansion,
      validatePraiseAppKidsOperationalAssistant,
      validatePraiseAppKidsAgeAdaptations,
      validatePraiseAppKidsPostClassCommunication,
      validatePraiseAppKidsEventSuggestion,
    ];

    for (const validator of validators) {
      expect(() => validator(null)).toThrow();
      expect(() => validator([])).toThrow();
      expect(() => validator('texto')).toThrow();
    }
  });

  it('requires each mandatory text field', () => {
    expect(() =>
      validatePraiseAppKidsCheckinDailySummary({ ...checkinSummary, headline: '' }),
    ).toThrow('headline');
    expect(() =>
      validatePraiseAppKidsWeeklyVerseExpansion({ ...verseExpansion, parentPhrase: null }),
    ).toThrow('parentPhrase');
    expect(() =>
      validatePraiseAppKidsEventSuggestion({ ...eventSuggestion, description: undefined }),
    ).toThrow('description');
  });

  it('rounds durationMin and requires at least one age version', () => {
    expect(
      validatePraiseAppKidsAgeAdaptations(ageAdaptations).versions[0].durationMin,
    ).toBe(20);
    expect(() =>
      validatePraiseAppKidsAgeAdaptations({ baseReference: 'x', versions: [] }),
    ).toThrow('versões');
  });
});

describe('kids prompts', () => {
  it('lesson plan prompt is specific to PraiseApp Kids and carries the leader context', () => {
    const prompt = buildPraiseAppKidsLessonPlanPrompt({
      biblicalReference: '1 Samuel 17',
      ageRangeLabel: '8-10 anos',
      durationMin: 45,
      theme: 'Coragem',
      recentLessonTitles: ['A criação'],
      additionalContext: 'Turma agitada',
    } as any);

    expect(prompt).toContain('Produto consumidor: PraiseApp');
    expect(prompt).toContain('Módulo: Kids');
    expect(prompt).toContain('Faixa etária: 8-10 anos');
    expect(prompt).toContain('Duração aproximada: 45 minutos');
    expect(prompt).toContain('Referência bíblica principal: 1 Samuel 17');
    expect(prompt).toContain('- A criação');
    expect(prompt).toContain('Turma agitada');
    expect(prompt).toContain('Não gere URLs');
  });

  it('lesson plan prompt applies defaults when optional context is missing', () => {
    const prompt = buildPraiseAppKidsLessonPlanPrompt({
      biblicalReference: 'Salmo 23',
    } as any);

    expect(prompt).toContain('Faixa etária: 5-7 anos');
    expect(prompt).toContain('Duração aproximada: 35 minutos');
    expect(prompt).toContain('Templates recentes: nenhum item relevante informado.');
    expect(prompt).toContain('nenhuma observação adicional informada.');
  });

  it('every prompt builder tolerates sparse input without throwing', () => {
    const builders = [
      buildPraiseAppKidsLessonPlanPrompt,
      buildPraiseAppKidsCheckinDailySummaryPrompt,
      buildPraiseAppKidsNextSequencePrompt,
      buildPraiseAppKidsWeeklyVerseExpansionPrompt,
      buildPraiseAppKidsOperationalAssistantPrompt,
      buildPraiseAppKidsAgeAdaptationsPrompt,
      buildPraiseAppKidsPostClassCommunicationPrompt,
      buildPraiseAppKidsEventSuggestionPrompt,
    ] as Array<(input: any) => string>;

    for (const build of builders) {
      const prompt = build({});
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(100);
      expect(prompt).toContain('PraiseApp');
    }
  });
});
