export type AgilisSummary = { summary: string };

export type AgilisActionPlan = {
  immediatePriorities: string[];
  nextSteps: string[];
  risks: string[];
  recommendations: string[];
};

export type AgilisBottleneck = {
  title: string;
  cause: string;
  correctiveAction: string;
};

export type AgilisBottleneckAnalysis = {
  overview: string;
  bottlenecks: AgilisBottleneck[];
};

export type AgilisAssigneeSuggestion = {
  suggestions: Array<{ name: string; reason: string }>;
};

export type AgilisRedistribution = {
  overview: string;
  moves: Array<{ from: string; to: string; tasksToMove: number; reason: string }>;
};

export type AgilisStrategicBrief = {
  summary: string;
  risks: string[];
  opportunities: string[];
  recommendations: string[];
};

const stringList = (description: string, maxItems: number) => ({
  type: 'array',
  description,
  maxItems,
  items: { type: 'string' },
});

export const AGILIS_SUMMARY_SCHEMA = {
  type: 'object',
  required: ['summary'],
  properties: {
    summary: { type: 'string', description: 'Resumo executivo em português do Brasil.' },
  },
  additionalProperties: false,
};

export const AGILIS_ACTION_PLAN_SCHEMA = {
  type: 'object',
  required: ['immediatePriorities', 'nextSteps', 'risks', 'recommendations'],
  properties: {
    immediatePriorities: stringList('Prioridades imediatas, para esta semana.', 6),
    nextSteps: stringList('Próximos passos para as próximas 2 semanas.', 6),
    risks: stringList('Riscos identificados nos dados.', 5),
    recommendations: stringList('Recomendações objetivas.', 5),
  },
  additionalProperties: false,
};

export const AGILIS_BOTTLENECKS_SCHEMA = {
  type: 'object',
  required: ['overview', 'bottlenecks'],
  properties: {
    overview: { type: 'string', description: 'Uma frase sobre a saúde geral do fluxo de trabalho.' },
    bottlenecks: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        required: ['title', 'cause', 'correctiveAction'],
        properties: {
          title: { type: 'string' },
          cause: { type: 'string' },
          correctiveAction: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};

export const AGILIS_ASSIGNEE_SCHEMA = {
  type: 'object',
  required: ['suggestions'],
  properties: {
    suggestions: {
      type: 'array',
      maxItems: 2,
      items: {
        type: 'object',
        required: ['name', 'reason'],
        properties: {
          name: { type: 'string', description: 'Nome exatamente como aparece na lista de membros.' },
          reason: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};

export const AGILIS_STRATEGIC_BRIEF_SCHEMA = {
  type: 'object',
  required: ['summary', 'risks', 'opportunities', 'recommendations'],
  properties: {
    summary: { type: 'string', description: 'Resumo executivo em 2 a 3 frases.' },
    risks: stringList('Riscos concretos baseados nos dados.', 3),
    opportunities: stringList('Oportunidades de melhoria.', 3),
    recommendations: stringList('Ações prioritárias com impacto esperado.', 4),
  },
  additionalProperties: false,
};

export const AGILIS_REDISTRIBUTION_SCHEMA = {
  type: 'object',
  required: ['overview', 'moves'],
  properties: {
    overview: { type: 'string', description: 'Uma ou duas frases sobre o desequilíbrio de carga.' },
    moves: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        required: ['from', 'to', 'tasksToMove', 'reason'],
        properties: {
          from: { type: 'string', description: 'Nome exatamente como na lista de sobrecarregados.' },
          to: { type: 'string', description: 'Nome exatamente como na lista de disponíveis.' },
          tasksToMove: { type: 'integer', minimum: 1 },
          reason: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};

const asObject = (payload: unknown, label: string) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`Resposta da IA inválida para ${label}.`);
  }
  return payload as Record<string, unknown>;
};

const readString = (payload: Record<string, unknown>, key: string, maxLength: number) => {
  const value = String(payload[key] ?? '').trim();
  if (!value) {
    throw new Error(`Campo obrigatório ausente: ${key}`);
  }
  return value.slice(0, maxLength);
};

const readList = (
  payload: Record<string, unknown>,
  key: string,
  maxItems: number,
  maxLength: number,
  minItems = 0,
) => {
  const value = payload[key];
  const items = (Array.isArray(value) ? value : [])
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength));
  if (items.length < minItems) {
    throw new Error(`Campo obrigatório ausente: ${key}`);
  }
  return items;
};

export const validateAgilisSummary = (payload: unknown): AgilisSummary => ({
  summary: readString(asObject(payload, 'resumo'), 'summary', 1500),
});

export const validateAgilisActionPlan = (payload: unknown): AgilisActionPlan => {
  const p = asObject(payload, 'plano de ação');
  return {
    immediatePriorities: readList(p, 'immediatePriorities', 6, 300, 1),
    nextSteps: readList(p, 'nextSteps', 6, 300),
    risks: readList(p, 'risks', 5, 300),
    recommendations: readList(p, 'recommendations', 5, 300),
  };
};

export const validateAgilisBottlenecks = (payload: unknown): AgilisBottleneckAnalysis => {
  const p = asObject(payload, 'gargalos');
  const raw = Array.isArray(p.bottlenecks) ? p.bottlenecks : [];
  return {
    overview: readString(p, 'overview', 500),
    bottlenecks: raw
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .slice(0, 3)
      .map((item) => ({
        title: readString(item, 'title', 200),
        cause: readString(item, 'cause', 500),
        correctiveAction: readString(item, 'correctiveAction', 500),
      })),
  };
};

export const validateAgilisAssignee = (payload: unknown): AgilisAssigneeSuggestion => {
  const p = asObject(payload, 'sugestão de responsável');
  const raw = Array.isArray(p.suggestions) ? p.suggestions : [];
  return {
    suggestions: raw
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .slice(0, 2)
      .map((item) => ({
        name: readString(item, 'name', 120),
        reason: readString(item, 'reason', 500),
      })),
  };
};

export const validateAgilisStrategicBrief = (payload: unknown): AgilisStrategicBrief => {
  const p = asObject(payload, 'brief estratégico');
  return {
    summary: readString(p, 'summary', 1200),
    risks: readList(p, 'risks', 3, 400, 1),
    opportunities: readList(p, 'opportunities', 3, 400),
    recommendations: readList(p, 'recommendations', 4, 400, 1),
  };
};

export const validateAgilisRedistribution = (payload: unknown): AgilisRedistribution => {
  const p = asObject(payload, 'redistribuição de carga');
  const raw = Array.isArray(p.moves) ? p.moves : [];
  return {
    overview: readString(p, 'overview', 600),
    moves: raw
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .slice(0, 5)
      .map((item) => ({
        from: readString(item, 'from', 120),
        to: readString(item, 'to', 120),
        tasksToMove: Math.max(1, Math.round(Number(item.tasksToMove) || 1)),
        reason: readString(item, 'reason', 400),
      })),
  };
};

