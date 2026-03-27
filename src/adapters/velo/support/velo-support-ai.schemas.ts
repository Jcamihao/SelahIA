export type VeloSupportScope =
  | 'supported'
  | 'not_available'
  | 'out_of_scope'
  | 'handoff';
export type VeloSupportConfidence = 'low' | 'medium' | 'high';

export interface VeloSupportChatResponse {
  answer: string;
  relatedArea: string;
  scope: VeloSupportScope;
  confidence: VeloSupportConfidence;
  suggestedActions: string[];
  shouldEscalate: boolean;
  disclaimer: string | null;
}

export const VELO_SUPPORT_CHAT_SCHEMA = {
  type: 'object',
  required: [
    'answer',
    'relatedArea',
    'scope',
    'confidence',
    'suggestedActions',
    'shouldEscalate',
    'disclaimer',
  ],
  properties: {
    answer: { type: 'string' },
    relatedArea: { type: 'string' },
    scope: {
      type: 'string',
      enum: ['supported', 'not_available', 'out_of_scope', 'handoff'],
    },
    confidence: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
    },
    suggestedActions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 4,
    },
    shouldEscalate: { type: 'boolean' },
    disclaimer: {
      type: ['string', 'null'],
    },
  },
  additionalProperties: false,
};

export function validateVeloSupportChatResponse(
  payload: unknown,
): VeloSupportChatResponse {
  const p = payload as Record<string, unknown>;

  if (!p || typeof p !== 'object') {
    throw new Error('Resposta inválida do Selah IA: payload não é objeto.');
  }

  if (typeof p.answer !== 'string' || !String(p.answer).trim()) {
    throw new Error('Campo obrigatório ausente ou inválido: answer');
  }

  if (typeof p.relatedArea !== 'string' || !String(p.relatedArea).trim()) {
    throw new Error('Campo obrigatório ausente ou inválido: relatedArea');
  }

  const validScopes: VeloSupportScope[] = [
    'supported',
    'not_available',
    'out_of_scope',
    'handoff',
  ];
  if (!validScopes.includes(p.scope as VeloSupportScope)) {
    throw new Error(`scope inválido: ${String(p.scope)}`);
  }

  const validConfidence: VeloSupportConfidence[] = ['low', 'medium', 'high'];
  if (!validConfidence.includes(p.confidence as VeloSupportConfidence)) {
    throw new Error(`confidence inválido: ${String(p.confidence)}`);
  }

  if (!Array.isArray(p.suggestedActions)) {
    throw new Error('Campo obrigatório ausente ou inválido: suggestedActions');
  }

  if (typeof p.shouldEscalate !== 'boolean') {
    throw new Error('Campo obrigatório ausente ou inválido: shouldEscalate');
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
    relatedArea: String(p.relatedArea).trim(),
    scope: p.scope as VeloSupportScope,
    confidence: p.confidence as VeloSupportConfidence,
    suggestedActions: (p.suggestedActions as unknown[])
      .filter((item): item is string => typeof item === 'string' && !!item.trim())
      .slice(0, 4),
    shouldEscalate: p.shouldEscalate,
    disclaimer:
      p.disclaimer === null || p.disclaimer === undefined
        ? null
        : String(p.disclaimer).trim(),
  };
}
