export type LumenLifeAssistantConfidence = 'low' | 'medium' | 'high';

export interface LumenLifeAssistantResponse {
  answer: string;
  highlights: string[];
  suggestedActions: string[];
  focusArea: string;
  confidence: LumenLifeAssistantConfidence;
  disclaimer: string | null;
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
      maxItems: 4,
    },
    suggestedActions: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 4,
    },
    focusArea: { type: 'string' },
    confidence: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
    },
    disclaimer: {
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
      .slice(0, 4),
    suggestedActions: (p.suggestedActions as unknown[])
      .filter((item): item is string => typeof item === 'string' && !!item.trim())
      .slice(0, 4),
    focusArea: String(p.focusArea).trim(),
    confidence: p.confidence as LumenLifeAssistantConfidence,
    disclaimer:
      p.disclaimer === null || p.disclaimer === undefined
        ? null
        : String(p.disclaimer).trim(),
  };
}
