import { BadGatewayException } from '@nestjs/common';
import { JsonSchema } from '../../../providers/llm-provider.interface';

export interface RascunhoClinicoResponse {
  rascunho: string;
}

export const RASCUNHO_CLINICO_SCHEMA: JsonSchema = {
  type: 'object',
  required: ['rascunho'],
  properties: {
    rascunho: { type: 'string' },
  },
  additionalProperties: false,
};

// Estrita de proposito: rascunho vazio nao ajuda o psicologo e nao pode virar 200. A mensagem
// nunca repete texto vindo do modelo.
export const validateRascunhoClinicoResponse = (
  payload: unknown,
): RascunhoClinicoResponse => {
  const rascunho = (payload as { rascunho?: unknown } | null | undefined)
    ?.rascunho;

  if (typeof rascunho !== 'string' || rascunho.trim().length === 0) {
    throw new BadGatewayException(
      'Resposta da IA invalida para psicologia/rascunho: rascunho ausente ou vazio.',
    );
  }

  return { rascunho };
};
