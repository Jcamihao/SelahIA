import {
  validateAgilisActionPlan,
  validateAgilisBottlenecks,
  validateAgilisStrategicBrief,
  validateAgilisSummary,
} from './workspace-ai.schemas';

describe('validadores do Agilis', () => {
  it('summary: devolve o texto aparado e cortado em 1500', () => {
    expect(
      validateAgilisSummary({ summary: `  ${'a'.repeat(2000)} ` }),
    ).toEqual({
      summary: 'a'.repeat(1500),
    });
  });

  it.each([{}, { summary: '  ' }, { summary: 0 }, { summary: false }])(
    'summary ausente ou falso lanca: %p',
    (payload) => {
      expect(() => validateAgilisSummary(payload)).toThrow(
        'Campo obrigatório ausente: summary',
      );
    },
  );

  it.each([null, [], 'texto'])('payload que nao e objeto lanca: %p', (p) => {
    expect(() => validateAgilisSummary(p)).toThrow(
      'Resposta da IA inválida para resumo.',
    );
  });

  it('plano de acao: exige ao menos 1 prioridade e limita as listas', () => {
    expect(() =>
      validateAgilisActionPlan({ immediatePriorities: ['', null] }),
    ).toThrow('Campo obrigatório ausente: immediatePriorities');
    const plano = validateAgilisActionPlan({
      immediatePriorities: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      nextSteps: ['x'],
    });
    expect(plano.immediatePriorities).toHaveLength(6);
    expect(plano.nextSteps).toEqual(['x']);
    expect(plano.risks).toEqual([]);
  });

  it('brief estrategico: riscos e recomendacoes sao obrigatorios', () => {
    expect(() =>
      validateAgilisStrategicBrief({
        summary: 's',
        risks: ['r'],
        recommendations: [],
      }),
    ).toThrow('Campo obrigatório ausente: recommendations');
  });

  it('gargalos: item com campo vazio lanca, no maximo 3 itens', () => {
    expect(() =>
      validateAgilisBottlenecks({
        overview: 'o',
        bottlenecks: [{ title: 't', cause: '', correctiveAction: 'c' }],
      }),
    ).toThrow('Campo obrigatório ausente: cause');
    const item = { title: 't', cause: 'c', correctiveAction: 'a' };
    expect(
      validateAgilisBottlenecks({
        overview: 'o',
        bottlenecks: [item, item, item, item],
      }).bottlenecks,
    ).toHaveLength(3);
  });
});
