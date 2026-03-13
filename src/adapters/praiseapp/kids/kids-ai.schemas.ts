const readOptionalString = (
  payload: Record<string, unknown>,
  key: string,
  maxLength = 1200,
) => {
  const value = payload[key];
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, maxLength);
};

const readRequiredString = (
  payload: Record<string, unknown>,
  key: string,
  maxLength = 1200,
) => {
  const value = readOptionalString(payload, key, maxLength);
  if (!value) {
    throw new Error(`Campo obrigatório ausente: ${key}`);
  }
  return value;
};

const readOptionalInt = (
  payload: Record<string, unknown>,
  key: string,
  fallback = 0,
) => {
  const value = Number(payload[key]);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.round(value));
};

const readStringArray = (
  payload: Record<string, unknown>,
  key: string,
  maxItems = 8,
  maxLength = 240,
) => {
  const value = payload[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength));
};

export const PRAISEAPP_KIDS_LESSON_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    suggestedTitle: {
      type: 'string',
      description: 'Título sugerido para a aula.',
    },
    biblicalReference: {
      type: 'string',
      description: 'Referência bíblica principal da aula.',
    },
    ageRange: {
      type: 'string',
      description: 'Faixa etária sugerida para a aula.',
    },
    mainObjective: {
      type: 'string',
      description: 'Objetivo central da aula em linguagem simples.',
    },
    lessonSummary: {
      type: 'string',
      description: 'Resumo curto da lição para o líder.',
    },
    iceBreaker: {
      type: 'string',
      description: 'Quebra-gelo prático e seguro.',
    },
    lessonFlow: {
      type: 'array',
      items: { type: 'string' },
      description: 'Sequência sugerida da aula.',
    },
    activity: {
      type: 'string',
      description: 'Atividade prática principal.',
    },
    supplies: {
      type: 'array',
      items: { type: 'string' },
      description: 'Materiais necessários.',
    },
    prayer: {
      type: 'string',
      description: 'Sugestão de oração curta para a aula.',
    },
    takeHomeChallenge: {
      type: 'string',
      description: 'Aplicação ou desafio para casa.',
    },
    messageToParents: {
      type: 'string',
      description: 'Resumo pronto para enviar aos pais.',
    },
    youtubeSearchQuery: {
      type: 'string',
      description: 'Busca sugerida no YouTube, sem URL.',
    },
    leaderTips: {
      type: 'array',
      items: { type: 'string' },
      description: 'Dicas rápidas para o professor.',
    },
    safetyNotes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Cuidados pedagógicos e operacionais.',
    },
  },
  required: [
    'suggestedTitle',
    'biblicalReference',
    'ageRange',
    'mainObjective',
    'lessonSummary',
    'iceBreaker',
    'lessonFlow',
    'activity',
    'supplies',
    'prayer',
    'takeHomeChallenge',
    'messageToParents',
    'youtubeSearchQuery',
    'leaderTips',
    'safetyNotes',
  ],
};

export type PraiseAppKidsLessonPlanSuggestion = {
  suggestedTitle: string;
  biblicalReference: string;
  ageRange: string;
  mainObjective: string;
  lessonSummary: string;
  iceBreaker: string;
  lessonFlow: string[];
  activity: string;
  supplies: string[];
  prayer: string;
  takeHomeChallenge: string;
  messageToParents: string;
  youtubeSearchQuery: string;
  leaderTips: string[];
  safetyNotes: string[];
};

export type PraiseAppKidsCheckinDailySummary = {
  headline: string;
  summaryText: string;
  highlights: string[];
  actionItems: string[];
  attentionLevel: string;
};

export type PraiseAppKidsPedagogicalSequence = {
  suggestedTitle: string;
  biblicalReference: string;
  testamentFocus: string;
  continuitySummary: string;
  pedagogicalRationale: string;
  memoryFocus: string;
  openingIdea: string;
  applicationFocus: string;
  parentConnection: string;
  balanceNotes: string[];
};

export type PraiseAppKidsWeeklyVerseExpansion = {
  childExplanation: string;
  memoryGesture: string;
  parentPhrase: string;
  prayerPrompt: string;
  applicationIdea: string;
};

export type PraiseAppKidsOperationalAssistant = {
  assistantSummary: string;
  adaptedFlow: string[];
  keyAdjustments: string[];
  suppliesAdjustments: string[];
  attentionResets: string[];
  noScreenAlternative: string;
  leaderScript: string;
  parentMessageSnippet: string;
};

export type PraiseAppKidsAgeAdaptationVersion = {
  ageRange: string;
  languageTone: string;
  mainObjective: string;
  openingIdea: string;
  activity: string;
  application: string;
  leaderTip: string;
  durationMin: number;
};

export type PraiseAppKidsAgeAdaptations = {
  baseReference: string;
  versions: PraiseAppKidsAgeAdaptationVersion[];
};

export const validatePraiseAppKidsLessonPlanSuggestion = (
  input: unknown,
): PraiseAppKidsLessonPlanSuggestion => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Resposta da IA inválida para o schema do Kids.');
  }

  const payload = input as Record<string, unknown>;
  return {
    suggestedTitle: readRequiredString(payload, 'suggestedTitle', 180),
    biblicalReference: readRequiredString(payload, 'biblicalReference', 180),
    ageRange: readRequiredString(payload, 'ageRange', 120),
    mainObjective: readRequiredString(payload, 'mainObjective', 400),
    lessonSummary: readRequiredString(payload, 'lessonSummary', 1200),
    iceBreaker: readRequiredString(payload, 'iceBreaker', 800),
    lessonFlow: readStringArray(payload, 'lessonFlow', 8, 240),
    activity: readRequiredString(payload, 'activity', 1000),
    supplies: readStringArray(payload, 'supplies', 12, 160),
    prayer: readRequiredString(payload, 'prayer', 600),
    takeHomeChallenge: readRequiredString(payload, 'takeHomeChallenge', 600),
    messageToParents: readRequiredString(payload, 'messageToParents', 1200),
    youtubeSearchQuery: readRequiredString(payload, 'youtubeSearchQuery', 200),
    leaderTips: readStringArray(payload, 'leaderTips', 8, 240),
    safetyNotes: readStringArray(payload, 'safetyNotes', 6, 240),
  };
};

export const PRAISEAPP_KIDS_CHECKIN_DAILY_SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    summaryText: { type: 'string' },
    highlights: { type: 'array', items: { type: 'string' } },
    actionItems: { type: 'array', items: { type: 'string' } },
    attentionLevel: { type: 'string' },
  },
  required: ['headline', 'summaryText', 'highlights', 'actionItems', 'attentionLevel'],
};

export const validatePraiseAppKidsCheckinDailySummary = (
  input: unknown,
): PraiseAppKidsCheckinDailySummary => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Resposta da IA inválida para resumo de check-in do Kids.');
  }

  const payload = input as Record<string, unknown>;
  return {
    headline: readRequiredString(payload, 'headline', 180),
    summaryText: readRequiredString(payload, 'summaryText', 1200),
    highlights: readStringArray(payload, 'highlights', 6, 240),
    actionItems: readStringArray(payload, 'actionItems', 6, 240),
    attentionLevel: readRequiredString(payload, 'attentionLevel', 24),
  };
};

export const PRAISEAPP_KIDS_NEXT_SEQUENCE_SCHEMA = {
  type: 'object',
  properties: {
    suggestedTitle: { type: 'string' },
    biblicalReference: { type: 'string' },
    testamentFocus: { type: 'string' },
    continuitySummary: { type: 'string' },
    pedagogicalRationale: { type: 'string' },
    memoryFocus: { type: 'string' },
    openingIdea: { type: 'string' },
    applicationFocus: { type: 'string' },
    parentConnection: { type: 'string' },
    balanceNotes: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'suggestedTitle',
    'biblicalReference',
    'testamentFocus',
    'continuitySummary',
    'pedagogicalRationale',
    'memoryFocus',
    'openingIdea',
    'applicationFocus',
    'parentConnection',
    'balanceNotes',
  ],
};

export const validatePraiseAppKidsPedagogicalSequence = (
  input: unknown,
): PraiseAppKidsPedagogicalSequence => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Resposta da IA inválida para sequência pedagógica do Kids.');
  }

  const payload = input as Record<string, unknown>;
  return {
    suggestedTitle: readRequiredString(payload, 'suggestedTitle', 180),
    biblicalReference: readRequiredString(payload, 'biblicalReference', 180),
    testamentFocus: readRequiredString(payload, 'testamentFocus', 24),
    continuitySummary: readRequiredString(payload, 'continuitySummary', 800),
    pedagogicalRationale: readRequiredString(payload, 'pedagogicalRationale', 1000),
    memoryFocus: readRequiredString(payload, 'memoryFocus', 320),
    openingIdea: readRequiredString(payload, 'openingIdea', 500),
    applicationFocus: readRequiredString(payload, 'applicationFocus', 500),
    parentConnection: readRequiredString(payload, 'parentConnection', 500),
    balanceNotes: readStringArray(payload, 'balanceNotes', 6, 240),
  };
};

export const PRAISEAPP_KIDS_WEEKLY_VERSE_EXPANSION_SCHEMA = {
  type: 'object',
  properties: {
    childExplanation: { type: 'string' },
    memoryGesture: { type: 'string' },
    parentPhrase: { type: 'string' },
    prayerPrompt: { type: 'string' },
    applicationIdea: { type: 'string' },
  },
  required: [
    'childExplanation',
    'memoryGesture',
    'parentPhrase',
    'prayerPrompt',
    'applicationIdea',
  ],
};

export const validatePraiseAppKidsWeeklyVerseExpansion = (
  input: unknown,
): PraiseAppKidsWeeklyVerseExpansion => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Resposta da IA inválida para expansão do versículo do Kids.');
  }

  const payload = input as Record<string, unknown>;
  return {
    childExplanation: readRequiredString(payload, 'childExplanation', 1200),
    memoryGesture: readRequiredString(payload, 'memoryGesture', 400),
    parentPhrase: readRequiredString(payload, 'parentPhrase', 240),
    prayerPrompt: readRequiredString(payload, 'prayerPrompt', 400),
    applicationIdea: readRequiredString(payload, 'applicationIdea', 500),
  };
};

export const PRAISEAPP_KIDS_OPERATIONAL_ASSISTANT_SCHEMA = {
  type: 'object',
  properties: {
    assistantSummary: { type: 'string' },
    adaptedFlow: { type: 'array', items: { type: 'string' } },
    keyAdjustments: { type: 'array', items: { type: 'string' } },
    suppliesAdjustments: { type: 'array', items: { type: 'string' } },
    attentionResets: { type: 'array', items: { type: 'string' } },
    noScreenAlternative: { type: 'string' },
    leaderScript: { type: 'string' },
    parentMessageSnippet: { type: 'string' },
  },
  required: [
    'assistantSummary',
    'adaptedFlow',
    'keyAdjustments',
    'suppliesAdjustments',
    'attentionResets',
    'noScreenAlternative',
    'leaderScript',
    'parentMessageSnippet',
  ],
};

export const validatePraiseAppKidsOperationalAssistant = (
  input: unknown,
): PraiseAppKidsOperationalAssistant => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Resposta da IA inválida para assistente operacional do Kids.');
  }

  const payload = input as Record<string, unknown>;
  return {
    assistantSummary: readRequiredString(payload, 'assistantSummary', 1000),
    adaptedFlow: readStringArray(payload, 'adaptedFlow', 8, 260),
    keyAdjustments: readStringArray(payload, 'keyAdjustments', 8, 240),
    suppliesAdjustments: readStringArray(payload, 'suppliesAdjustments', 8, 200),
    attentionResets: readStringArray(payload, 'attentionResets', 6, 220),
    noScreenAlternative: readRequiredString(payload, 'noScreenAlternative', 600),
    leaderScript: readRequiredString(payload, 'leaderScript', 700),
    parentMessageSnippet: readRequiredString(payload, 'parentMessageSnippet', 500),
  };
};

export const PRAISEAPP_KIDS_AGE_ADAPTATIONS_SCHEMA = {
  type: 'object',
  properties: {
    baseReference: { type: 'string' },
    versions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ageRange: { type: 'string' },
          languageTone: { type: 'string' },
          mainObjective: { type: 'string' },
          openingIdea: { type: 'string' },
          activity: { type: 'string' },
          application: { type: 'string' },
          leaderTip: { type: 'string' },
          durationMin: { type: 'number' },
        },
        required: [
          'ageRange',
          'languageTone',
          'mainObjective',
          'openingIdea',
          'activity',
          'application',
          'leaderTip',
          'durationMin',
        ],
      },
    },
  },
  required: ['baseReference', 'versions'],
};

export const validatePraiseAppKidsAgeAdaptations = (
  input: unknown,
): PraiseAppKidsAgeAdaptations => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Resposta da IA inválida para adaptação por faixa etária do Kids.');
  }

  const payload = input as Record<string, unknown>;
  const versionsRaw = Array.isArray(payload.versions) ? payload.versions : [];
  const versions = versionsRaw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    .slice(0, 6)
    .map((item) => ({
      ageRange: readRequiredString(item, 'ageRange', 80),
      languageTone: readRequiredString(item, 'languageTone', 240),
      mainObjective: readRequiredString(item, 'mainObjective', 400),
      openingIdea: readRequiredString(item, 'openingIdea', 400),
      activity: readRequiredString(item, 'activity', 600),
      application: readRequiredString(item, 'application', 500),
      leaderTip: readRequiredString(item, 'leaderTip', 400),
      durationMin: readOptionalInt(item, 'durationMin', 20),
    }));

  if (!versions.length) {
    throw new Error('Resposta da IA não retornou versões por faixa etária.');
  }

  return {
    baseReference: readRequiredString(payload, 'baseReference', 180),
    versions,
  };
};
