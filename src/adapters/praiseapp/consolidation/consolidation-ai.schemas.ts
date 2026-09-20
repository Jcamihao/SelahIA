export interface ConsolidationSentiment {
  sentiment: 'positivo' | 'neutro' | 'negativo';
  score: number;
  summary: string;
  pastoralInsight: string;
}

export const CONSOLIDATION_SENTIMENT_SCHEMA = {
  type: 'object',
  required: ['sentiment', 'score', 'summary', 'pastoralInsight'],
  properties: {
    sentiment: { type: 'string', enum: ['positivo', 'neutro', 'negativo'] },
    score: { type: 'number' },
    summary: { type: 'string' },
    pastoralInsight: { type: 'string' },
  },
  additionalProperties: false,
};

export interface ConsolidationPlaybook {
  weeks: Array<{
    weekNumber: number;
    goal: string;
    actions: string[];
    script: string;
  }>;
  personalizedInsights: string;
}

export const CONSOLIDATION_PLAYBOOK_SCHEMA = {
  type: 'object',
  required: ['weeks', 'personalizedInsights'],
  properties: {
    weeks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['weekNumber', 'goal', 'actions', 'script'],
        properties: {
          weekNumber: { type: 'number' },
          goal: { type: 'string' },
          actions: { type: 'array', items: { type: 'string' } },
          script: { type: 'string' },
        },
      },
    },
    personalizedInsights: { type: 'string' },
  },
  additionalProperties: false,
};

export function validateConsolidationSentiment(data: any): ConsolidationSentiment {
  if (!data || typeof data.sentiment !== 'string' || typeof data.score !== 'number') {
    throw new Error('Resposta da IA inválida para análise de sentimento da consolidação.');
  }
  return data as ConsolidationSentiment;
}

export function validateConsolidationPlaybook(data: any): ConsolidationPlaybook {
  if (!data || !Array.isArray(data.weeks) || typeof data.personalizedInsights !== 'string') {
    throw new Error('Resposta da IA inválida para playbook de consolidação.');
  }
  return data as ConsolidationPlaybook;
}
