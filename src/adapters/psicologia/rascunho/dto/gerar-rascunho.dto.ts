import { IsIn, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export const TIPOS_DOCUMENTO = ['evolucao', 'anamnese'] as const;
export const ABORDAGENS = ['SISTEMICA', 'TCC', 'PSICANALISE', 'ACT', 'HUMANISTA', 'OUTRA'] as const;

export class GerarRascunhoDto {
  @IsIn(TIPOS_DOCUMENTO)
  tipoDocumento: (typeof TIPOS_DOCUMENTO)[number];

  @IsIn(ABORDAGENS)
  abordagem: (typeof ABORDAGENS)[number];

  // Texto que o Notta.psi ja anonimizou: nome, CPF, contato e terceiros viram codigos entre colchetes.
  // Vazio ou so espacos nao vira rascunho: 400 aqui, em vez de gastar cota do Gemini.
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(8000)
  textoAnonimizado: string;
}
