// ─── Types ────────────────────────────────────────────────────────────────────

export interface ServiceReportsAttendanceTrend {
  average: number;
  peakValue: number;
  peakDate: string;
  changePercent: number | null;
  insight: string;
}

export interface ServiceReportsVisitorTrend {
  total: number;
  average: number;
  conversionHighlight: string | null;
  insight: string;
}

export interface ServiceReportsOfferingTrend {
  total: number;
  average: number;
  insight: string;
}

export interface ServiceReportsAiMonthlySummary {
  period: string;
  headline: string;
  overallTrend: 'crescimento' | 'estabilidade' | 'queda';
  attendanceTrend: ServiceReportsAttendanceTrend;
  visitorTrend: ServiceReportsVisitorTrend;
  offeringTrend: ServiceReportsOfferingTrend;
  highlights: string[];
  attentionPoints: string[];
  recommendations: string[];
  closingMessage: string;
}

export interface ChurchHealthAnalysis {
  healthScore: number;
  engagementLevel: 'baixo' | 'médio' | 'alto';
  trends: Array<{
    metric: string;
    trend: 'crescimento' | 'estabilidade' | 'queda';
    percentage?: number;
  }>;
  alerts: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    suggestedAction: string;
  }>;
  pastoralInsights: string;
}

// ─── JSON Schema (Gemini structured output) ───────────────────────────────────

export const SERVICE_REPORTS_MONTHLY_SUMMARY_SCHEMA = {
  type: 'object',
  required: [
    'period', 'headline', 'overallTrend',
    'attendanceTrend', 'visitorTrend', 'offeringTrend',
    'highlights', 'attentionPoints', 'recommendations', 'closingMessage',
  ],
  properties: {
    period: { type: 'string' },
    headline: { type: 'string' },
    overallTrend: { type: 'string', enum: ['crescimento', 'estabilidade', 'queda'] },
    attendanceTrend: {
      type: 'object',
      required: ['average', 'peakValue', 'peakDate', 'changePercent', 'insight'],
      properties: {
        average: { type: 'number' },
        peakValue: { type: 'number' },
        peakDate: { type: 'string' },
        changePercent: { type: ['number', 'null'] },
        insight: { type: 'string' },
      },
    },
    visitorTrend: {
      type: 'object',
      required: ['total', 'average', 'conversionHighlight', 'insight'],
      properties: {
        total: { type: 'number' },
        average: { type: 'number' },
        conversionHighlight: { type: ['string', 'null'] },
        insight: { type: 'string' },
      },
    },
    offeringTrend: {
      type: 'object',
      required: ['total', 'average', 'insight'],
      properties: {
        total: { type: 'number' },
        average: { type: 'number' },
        insight: { type: 'string' },
      },
    },
    highlights: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
    attentionPoints: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    recommendations: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
    closingMessage: { type: 'string' },
  },
  additionalProperties: false,
};

export const CHURCH_HEALTH_SCHEMA = {
  type: 'object',
  required: ['healthScore', 'engagementLevel', 'trends', 'alerts', 'pastoralInsights'],
  properties: {
    healthScore: { type: 'number' },
    engagementLevel: { type: 'string', enum: ['baixo', 'médio', 'alto'] },
    trends: {
      type: 'array',
      items: {
        type: 'object',
        required: ['metric', 'trend'],
        properties: {
          metric: { type: 'string' },
          trend: { type: 'string', enum: ['crescimento', 'estabilidade', 'queda'] },
          percentage: { type: 'number' },
        },
      },
    },
    alerts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'severity', 'message', 'suggestedAction'],
        properties: {
          type: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          message: { type: 'string' },
          suggestedAction: { type: 'string' },
        },
      },
    },
    pastoralInsights: { type: 'string' },
  },
  additionalProperties: false,
};

// ─── Validator ────────────────────────────────────────────────────────────────

export function validateServiceReportsAiMonthlySummary(
  payload: unknown,
): ServiceReportsAiMonthlySummary {
  const p = payload as Record<string, any>;

  if (!p || typeof p !== 'object') {
    throw new Error('Resposta inválida do Selah IA: não é um objeto.');
  }

  const requiredStrings = ['period', 'headline', 'overallTrend', 'closingMessage'];
  for (const key of requiredStrings) {
    if (typeof p[key] !== 'string' || !String(p[key]).trim()) {
      throw new Error(`Campo obrigatório ausente ou inválido: ${key}`);
    }
  }

  const validTrends = ['crescimento', 'estabilidade', 'queda'];
  if (!validTrends.includes(p.overallTrend)) {
    throw new Error(`overallTrend inválido: ${p.overallTrend}`);
  }

  const assertTrend = (obj: any, name: string, fields: string[]) => {
    if (!obj || typeof obj !== 'object') {
      throw new Error(`${name} ausente ou inválido.`);
    }
    for (const f of fields) {
      if (obj[f] === undefined) {
        throw new Error(`${name}.${f} ausente.`);
      }
    }
  };

  assertTrend(p.attendanceTrend, 'attendanceTrend', ['average', 'peakValue', 'peakDate', 'changePercent', 'insight']);
  assertTrend(p.visitorTrend, 'visitorTrend', ['total', 'average', 'conversionHighlight', 'insight']);
  assertTrend(p.offeringTrend, 'offeringTrend', ['total', 'average', 'insight']);

  const assertArray = (field: string) => {
    if (!Array.isArray(p[field])) {
      throw new Error(`${field} deve ser um array.`);
    }
  };
  assertArray('highlights');
  assertArray('attentionPoints');
  assertArray('recommendations');

  return p as ServiceReportsAiMonthlySummary;
}

export function validateChurchHealthAnalysis(payload: unknown): ChurchHealthAnalysis {
  const p = payload as Record<string, any>;
  if (!p || typeof p !== 'object') {
    throw new Error('Análise de saúde inválida.');
  }
  if (typeof p.healthScore !== 'number' || !p.engagementLevel || !Array.isArray(p.trends) || !Array.isArray(p.alerts) || !p.pastoralInsights) {
    throw new Error('Campos obrigatórios de saúde ausentes.');
  }
  return p as ChurchHealthAnalysis;
}
