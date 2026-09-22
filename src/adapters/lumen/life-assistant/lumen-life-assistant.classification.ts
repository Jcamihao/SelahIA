import { GenerateLumenLifeAssistantResponseDto } from './dto/generate-lumen-life-assistant-response.dto';

// Fonte unica destes padroes: prompt.ts (o que instrui o modelo a escrever) e
// service.ts (o que decide se a resposta ficou generica) tinham copias
// levemente divergentes (o padrao financeiro do service incluia "invest" e o
// do prompt nao), o que podia fazer o service cobrar um padrao de qualidade
// que o prompt nunca pediu ao modelo. Import unico elimina esse drift.
export const DEBT_GUIDANCE_PATTERN =
  /\b(divid|d[ií]vida|quitar|quitacao|quita[cç][aã]o|renegoci|negoci|juros|parcela|parcelamento|cart[aã]o|emprest)\b/i;

export const FINANCIAL_GUIDANCE_PATTERN =
  /\b(divid|d[ií]vida|quitar|quitacao|quita[cç][aã]o|renegoci|negoci|juros|parcela|parcelamento|cart[aã]o|emprest|orcament|or[çc]amento|gasto|despesa|econom|renda|sal[aá]rio|boleto|conta|reserva|caixa|invest)\b/i;

export const PERSONAL_GUIDANCE_PATTERN =
  /\b(rotina|vida pessoal|cansa[cç]|ansied|foco|procrast|disciplina|h[aá]bito|organiza|emocional|energia|sono|estresse|estres|travad|desanim|produtividade|const[aâ]ncia)\b/i;

export const MONEY_SIGNAL_PATTERN =
  /(?:r\$\s*)?\d{1,3}(?:\.\d{3})*(?:,\d{2})?\s*(?:mil|k|milh[aã]o|milh[oõ]es)?|(?:r\$\s*)?\d+(?:,\d{2})?\s*(?:mil|k|milh[aã]o|milh[oõ]es)?/gi;

export const isDebtQuestion = (message: string) =>
  DEBT_GUIDANCE_PATTERN.test(String(message || ''));

export const isFinancialGuidanceQuestion = (
  input: Pick<GenerateLumenLifeAssistantResponseDto, 'intent' | 'message'>,
) =>
  input.intent === 'finance_overview' ||
  FINANCIAL_GUIDANCE_PATTERN.test(String(input.message || ''));

export const isPersonalGuidanceQuestion = (message: string) =>
  PERSONAL_GUIDANCE_PATTERN.test(String(message || ''));

export const extractMoneySignals = (message: string) => {
  const matches = String(message || '').match(MONEY_SIGNAL_PATTERN) || [];
  const normalized = matches
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return Array.from(new Set(normalized)).slice(0, 3);
};

export const extractQuestionFacts = (message: string) => {
  const normalizedMessage = String(message || '').trim();

  if (!normalizedMessage) {
    return [];
  }

  const facts = new Set<string>();

  for (const signal of extractMoneySignals(normalizedMessage)) {
    facts.add(signal);
  }

  if (isDebtQuestion(normalizedMessage)) {
    facts.add('pedido de ajuda para quitar ou reorganizar dívida');
  }

  if (FINANCIAL_GUIDANCE_PATTERN.test(normalizedMessage)) {
    facts.add('pedido de orientação financeira prática');
  }

  if (isPersonalGuidanceQuestion(normalizedMessage)) {
    facts.add('pedido de orientação para vida pessoal ou rotina');
  }

  return Array.from(facts).slice(0, 5);
};
