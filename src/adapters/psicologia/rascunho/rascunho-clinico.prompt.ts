import { GerarRascunhoDto } from './dto/gerar-rascunho.dto';

const NOME_ABORDAGEM: Record<GerarRascunhoDto['abordagem'], string> = {
  SISTEMICA: 'terapia sistêmica',
  TCC: 'terapia cognitivo-comportamental',
  PSICANALISE: 'psicanálise',
  ACT: 'terapia de aceitação e compromisso',
  HUMANISTA: 'abordagem humanista',
  OUTRA: 'abordagem geral',
};

const NOME_DOCUMENTO: Record<GerarRascunhoDto['tipoDocumento'], string> = {
  evolucao: 'evolução',
  anamnese: 'anamnese',
};

export const buildRascunhoClinicoSystemInstruction = (
  abordagem: GerarRascunhoDto['abordagem'],
  tipoDocumento: GerarRascunhoDto['tipoDocumento'],
): string =>
  [
    'Você é Selah IA, apoio de registro clínico.',
    `Escreva apenas o rascunho de ${NOME_DOCUMENTO[tipoDocumento]}, no estilo da abordagem ${abordagem} (${NOME_ABORDAGEM[abordagem]}).`,
    'Baseie-se só no texto fornecido e nunca invente fatos.',
    'Preserve os códigos entre colchetes exatamente como aparecem (ex.: [PACIENTE], [PESSOA_1]): eles serão substituídos depois.',
    'Responda somente com JSON válido no formato do schema, sem markdown, com o texto no campo "rascunho".',
  ].join(' ');

export const buildRascunhoClinicoUserPrompt = (dto: GerarRascunhoDto): string =>
  `Documento: ${NOME_DOCUMENTO[dto.tipoDocumento]}\n\n${dto.textoAnonimizado}`;
