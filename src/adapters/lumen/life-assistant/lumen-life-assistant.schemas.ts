export type LumenLifeAssistantConfidence = 'low' | 'medium' | 'high';

const LUMEN_LIFE_ASSISTANT_MAX_ITEMS = 6;

export interface LumenLifeAssistantResponse {
  answer: string;
  highlights: string[];
  suggestedActions: string[];
  focusArea: string;
  confidence: LumenLifeAssistantConfidence;
  disclaimer: string | null;
  reasoning?: string[];
  evidence?: string[];
  confidenceReason?: string | null;
  followUpPrompt?: string | null;
}

export const LUMEN_LIFE_ASSISTANT_SCHEMA = {
  type: 'object',
  required: [
    'answer',
    'highlights',
    'suggestedActions',
    'focusArea',
    'confidence',
    'disclaimer',
  ],
  properties: {
    answer: { type: 'string' },
    highlights: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: LUMEN_LIFE_ASSISTANT_MAX_ITEMS,
    },
    suggestedActions: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: LUMEN_LIFE_ASSISTANT_MAX_ITEMS,
    },
    focusArea: { type: 'string' },
    confidence: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
    },
    disclaimer: {
      type: ['string', 'null'],
    },
    reasoning: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 4,
    },
    evidence: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5,
    },
    confidenceReason: {
      type: ['string', 'null'],
    },
    followUpPrompt: {
      type: ['string', 'null'],
    },
  },
  additionalProperties: false,
};

export function validateLumenLifeAssistantResponse(
  payload: unknown,
): LumenLifeAssistantResponse {
  const p = payload as Record<string, unknown>;

  if (!p || typeof p !== 'object') {
    throw new Error('Resposta inválida do Selah IA: payload não é um objeto.');
  }

  if (typeof p.answer !== 'string' || !String(p.answer).trim()) {
    throw new Error('Campo obrigatório ausente ou inválido: answer');
  }

  if (!Array.isArray(p.highlights) || !(p.highlights as unknown[]).length) {
    throw new Error('Campo obrigatório ausente ou inválido: highlights');
  }

  if (
    !Array.isArray(p.suggestedActions) ||
    !(p.suggestedActions as unknown[]).length
  ) {
    throw new Error(
      'Campo obrigatório ausente ou inválido: suggestedActions',
    );
  }

  if (typeof p.focusArea !== 'string' || !String(p.focusArea).trim()) {
    throw new Error('Campo obrigatório ausente ou inválido: focusArea');
  }

  const validConfidence: LumenLifeAssistantConfidence[] = [
    'low',
    'medium',
    'high',
  ];

  if (!validConfidence.includes(p.confidence as LumenLifeAssistantConfidence)) {
    throw new Error(`confidence inválido: ${String(p.confidence)}`);
  }

  if (
    p.disclaimer !== null &&
    p.disclaimer !== undefined &&
    typeof p.disclaimer !== 'string'
  ) {
    throw new Error('Campo inválido: disclaimer');
  }

  return {
    answer: String(p.answer).trim(),
    highlights: (p.highlights as unknown[])
      .filter((item): item is string => typeof item === 'string' && !!item.trim())
      .slice(0, LUMEN_LIFE_ASSISTANT_MAX_ITEMS),
    suggestedActions: (p.suggestedActions as unknown[])
      .filter((item): item is string => typeof item === 'string' && !!item.trim())
      .slice(0, LUMEN_LIFE_ASSISTANT_MAX_ITEMS),
    focusArea: String(p.focusArea).trim(),
    confidence: p.confidence as LumenLifeAssistantConfidence,
    disclaimer:
      p.disclaimer === null || p.disclaimer === undefined
        ? null
        : String(p.disclaimer).trim(),
    reasoning: Array.isArray(p.reasoning)
      ? (p.reasoning as unknown[])
          .filter((item): item is string => typeof item === 'string' && !!item.trim())
          .slice(0, 4)
      : [],
    evidence: Array.isArray(p.evidence)
      ? (p.evidence as unknown[])
          .filter((item): item is string => typeof item === 'string' && !!item.trim())
          .slice(0, 5)
      : [],
    confidenceReason:
      p.confidenceReason === null || p.confidenceReason === undefined
        ? null
        : String(p.confidenceReason).trim(),
    followUpPrompt:
      p.followUpPrompt === null || p.followUpPrompt === undefined
        ? null
        : String(p.followUpPrompt).trim(),
  };
}
