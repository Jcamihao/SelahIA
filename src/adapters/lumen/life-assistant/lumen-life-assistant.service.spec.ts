import { LumenLifeAssistantService } from './lumen-life-assistant.service';
import { StructuredOutputService } from '../../../capabilities/structured-output/structured-output.service';
import { RequestContextService } from '../../../common/logging/request-context.service';
import { GenerateLumenLifeAssistantResponseDto } from './dto/generate-lumen-life-assistant-response.dto';

describe('LumenLifeAssistantService', () => {
  const baseInput: GenerateLumenLifeAssistantResponseDto = {
    message:
      'Chat, estou com uma divida de 15mil, como posso quitar sem ferrar com minha vida?',
    intent: 'finance_overview',
    currentDateLabel: 'terça-feira, 31 de março',
    user: {
      name: 'Camila',
      preferredCurrency: 'BRL',
      monthlyIncome: 6200,
    },
    lifeContextSummary: 'Camila está tentando reorganizar a vida financeira.',
    applicationPromptContext:
      'Há pressão financeira no mês, mas o app não trouxe contratos detalhados de dívida.',
    questionContextSummary:
      'A resposta deve atacar a dúvida sobre quitar dívida com plano viável.',
    matchedQuestionTargets: [],
    focusAreaHint: 'Financeiro',
    tasksTodayCount: 3,
    tasksOverdueCount: 1,
    currentBalance: 1800,
    monthlyExpenses: 5400,
    monthlyIncome: 6200,
    forecast: {
      predictedBalance: 900,
      riskLevel: 'HIGH',
    },
    openTasks: [
      {
        title: 'Revisar contas do cartão',
        priority: 'HIGH',
        dueDateLabel: 'amanhã',
        category: 'Finanças',
        hasFinancialImpact: true,
        estimatedAmount: 800,
      },
    ],
    recentTransactions: [
      {
        description: 'Parcela do cartão',
        type: 'expense',
        amount: 780,
        dateLabel: 'hoje',
        category: 'Cartão',
      },
    ],
    activeGoals: [
      {
        title: 'Reserva de emergência',
        status: 'active',
        progressPercent: 22,
        targetDateLabel: 'dezembro',
      },
    ],
    activeInsights: [
      {
        type: 'cashflow',
        severity: 'critical',
        message: 'O fluxo do mês está apertado para novas parcelas.',
      },
    ],
    reminderLabels: [],
    notificationLabels: [],
  };

  const createService = (
    generate: jest.MockedFunction<StructuredOutputService['generate']>,
  ) => {
    const structuredOutputService = {
      generate,
    } as unknown as StructuredOutputService;

    const requestContext = {
      getRequestId: jest.fn().mockReturnValue('test-request'),
    } as unknown as RequestContextService;

    return new LumenLifeAssistantService(
      structuredOutputService,
      requestContext,
    );
  };

  it('retries when the first answer is generic and accepts the second concrete response', async () => {
    const generate = jest
      .fn()
      .mockResolvedValueOnce({
        model: 'gemma4:e4b',
        data: {
          answer:
            'Seu saldo atual está apertado. Mantenha o ritmo e siga acompanhando com cautela.',
          highlights: ['Proteja o caixa.'],
          suggestedActions: ['Organize suas prioridades.'],
          focusArea: 'Financeiro',
          confidence: 'medium',
          disclaimer: null,
        },
      })
      .mockResolvedValueOnce({
        model: 'gemma4:e4b',
        data: {
          answer:
            'Uma dívida de 15mil precisa de negociação antes de qualquer aceleração de pagamento. Preserve moradia, alimentação e transporte, e use Revisar contas do cartão como ponto de partida para atacar primeiro o contrato com juros mais altos.',
          highlights: [
            'Valor citado na pergunta: 15mil.',
            'Movimentação em foco: Parcela do cartão.',
            'Saldo atual no app: R$ 1.800,00.',
          ],
          suggestedActions: [
            'Liste cada dívida com credor, saldo e juros, começando por Revisar contas do cartão.',
            'Negocie primeiro a dívida com maior juros ou atraso.',
            'Defina uma parcela mensal que caiba no seu custo básico.',
          ],
          focusArea: 'Quitar divida',
          confidence: 'high',
          disclaimer: null,
        },
      });

    const service = createService(generate);
    const result = await service.chat(baseInput);

    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.provider).toBe('gemini-developer-api');
    expect(result.answer).toContain('15mil');
    expect(result.suggestedActions[0]).toContain('credor');
  });

  it('uses the rule-based fallback after repeated generic outputs on debt guidance', async () => {
    const generate = jest.fn().mockResolvedValue({
      model: 'gemma4:e4b',
      data: {
        answer:
          'Seu saldo atual está apertado. Mantenha o ritmo e siga acompanhando com cautela.',
        highlights: ['Proteja o caixa.'],
        suggestedActions: ['Organize suas prioridades.'],
        focusArea: 'Financeiro',
        confidence: 'medium',
        disclaimer: null,
      },
    });

    const service = createService(generate);
    const result = await service.chat(baseInput);

    expect(generate).toHaveBeenCalledTimes(3);
    expect(result.provider).toBe('selah-rules-engine');
    expect(result.model).toBe('selah-rules-fallback');
    expect(result.answer).toContain('15mil');
    expect(result.answer.toLowerCase()).toContain('moradia');
    expect(result.suggestedActions[0].toLowerCase()).toContain('credor');
  });
});
