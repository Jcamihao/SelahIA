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

