import {
  extractMoneySignals,
  extractQuestionFacts,
  isDebtQuestion,
  isFinancialGuidanceQuestion,
  isPersonalGuidanceQuestion,
} from './lumen-life-assistant.classification';

describe('lumen-life-assistant.classification', () => {
  // Bug real corrigido em 2026-09-22: prompt.ts e service.ts tinham copias
  // divergentes deste padrao (o do service reconhecia "investir", o do prompt nao),
  // entao o service podia cobrar qualidade de resposta financeira para uma
  // pergunta que o prompt nunca instruiu o modelo a tratar como financeira.
  it('recognizes an investment question as financial guidance', () => {
    const message = 'Vale a pena eu investir essa sobra do mes ou quitar o cartao primeiro?';

    expect(isFinancialGuidanceQuestion({ intent: 'general', message })).toBe(true);
  });

  it('does not treat a debt question as financial guidance via a different signal only', () => {
    expect(isDebtQuestion('Como quito minha divida do cartao?')).toBe(true);
    expect(isFinancialGuidanceQuestion({ intent: 'general', message: 'Como quito minha divida do cartao?' })).toBe(true);
  });

  it('recognizes finance_overview intent as financial guidance even without a financial keyword', () => {
    expect(isFinancialGuidanceQuestion({ intent: 'finance_overview', message: 'e ai, como estou?' })).toBe(true);
    expect(isFinancialGuidanceQuestion({ intent: 'general', message: 'e ai, como estou?' })).toBe(false);
  });

  it('recognizes personal-guidance signals like routine and burnout', () => {
    expect(isPersonalGuidanceQuestion('Estou exausto e sem foco na rotina, o que eu ajusto?')).toBe(true);
    expect(isPersonalGuidanceQuestion('Qual o total gasto no mes?')).toBe(false);
  });

  it('extracts distinct money signals from the message, capped at 3', () => {
    expect(extractMoneySignals('Tenho uma divida de 15 mil e outra de R$ 2.500,00')).toEqual([
      '15 mil',
      'R$ 2.500,00',
    ]);
    expect(extractMoneySignals('sem nenhum valor citado aqui')).toEqual([]);
  });

  it('builds question facts combining money signals and guidance type, capped at 5', () => {
    expect(extractQuestionFacts('Como quito uma divida de 15 mil sem me ferrar?')).toEqual([
      '15 mil',
      'pedido de ajuda para quitar ou reorganizar dívida',
      'pedido de orientação financeira prática',
    ]);
    expect(extractQuestionFacts('')).toEqual([]);
  });
});
