import { Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { AgilisWorkspaceAiService } from '../../adapters/agilis/workspace/workspace-ai.service';
import { LumenLifeAssistantService } from '../../adapters/lumen/life-assistant/lumen-life-assistant.service';
import { LumenReceiptParserService } from '../../adapters/lumen/receipt-parser/lumen-receipt-parser.service';
import { KidsAiService } from '../../adapters/praiseapp/kids/kids-ai.service';
import { ServiceReportsAiService } from '../../adapters/praiseapp/service-reports/service-reports-ai.service';
import { RequestContextService } from './request-context.service';
import { RequestLoggingMiddleware } from './request-logging.middleware';

// Texto que representa dado pessoal ou conteudo livre: nome, igreja, nota de lider sobre crianca,
// saida do modelo. Se aparecer em qualquer log, o teste falha.
const SECRET = 'SEGREDO_PII_7f3a91';

const requestContext = { getRequestId: () => 'req-1' } as any;

const providerLike = (payload: unknown) => ({
  generate: jest.fn(async (input: any) => ({
    data: input.validate(payload),
    model: 'test-model',
  })),
});

describe('logs do Selah nao carregam dados pessoais nem conteudo livre', () => {
  let logged: string[];

  beforeEach(() => {
    logged = [];
    for (const level of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      jest
        .spyOn(Logger.prototype, level)
        .mockImplementation((message: any) => {
          logged.push(String(message));
        });
    }
  });

  afterEach(() => jest.restoreAllMocks());

  const expectNoSecretInLogs = () => {
    expect(logged.length).toBeGreaterThan(0);
    expect(logged.filter((line) => line.includes(SECRET))).toEqual([]);
  };

  it('Lumen life assistant: nome do usuario, pergunta e resposta', async () => {
    const service = new LumenLifeAssistantService(
      providerLike({
        answer: `${SECRET} Uma divida de 15mil precisa de negociacao antes de acelerar pagamentos; preserve moradia e alimentacao e comece pelo contrato com juros mais altos.`,
        highlights: [`Valor citado: 15mil ${SECRET}`],
        suggestedActions: [`Liste cada divida com credor e juros ${SECRET}`],
        focusArea: `Financeiro ${SECRET}`,
        confidence: 'high',
        disclaimer: null,
      }) as any,
      requestContext,
    );

    await service
      .chat({
        message: `Estou com uma divida de 15mil ${SECRET}`,
        intent: 'finance_overview',
        currentDateLabel: 'sabado',
        user: { name: SECRET, preferredCurrency: 'BRL', monthlyIncome: 6200 },
        lifeContextSummary: SECRET,
        applicationPromptContext: SECRET,
        focusAreaHint: 'Financeiro',
        tasksTodayCount: 1,
        tasksOverdueCount: 0,
        currentBalance: 1800,
        monthlyExpenses: 5400,
        monthlyIncome: 6200,
        forecast: { predictedBalance: 900, riskLevel: 'HIGH' },
        openTasks: [{ title: SECRET }],
        activeGoals: [],
        activeInsights: [],
        recentTransactions: [],
        reminderLabels: [],
        notificationLabels: [],
      } as any)
      .catch(() => undefined);

    expectNoSecretInLogs();
  });

  it('Lumen receipt parser: nome do arquivo e do estabelecimento', async () => {
    const receipt = {
      merchant: SECRET,
      merchantTaxId: '12345678000199',
      doc: '1',
      documentType: 'nfce',
      total: 10,
      confidence: 'high',
      purchaseSummary: SECRET,
      items: [{ name: SECRET, qty: 1, unit: 10, total: 10 }],
    };
    const service = new LumenReceiptParserService(
      {
        generateTextFromContents: jest
          .fn()
          .mockResolvedValue({ text: JSON.stringify(receipt), model: 'm' }),
      } as any,
      requestContext,
    );

    await service.parse({
      fileName: `nota_${SECRET}.jpg`,
      mimeType: 'image/jpeg',
      imageBase64: 'aGVsbG8=',
    } as any);

    expectNoSecretInLogs();
  });

  it('PraiseApp relatorios de culto e saude: nome da igreja e observacoes', async () => {
    const monthly = {
      period: 'Setembro',
      headline: SECRET,
      overallTrend: 'crescimento',
      attendanceTrend: { average: 1, peakValue: 1, peakDate: 'x', changePercent: 1, insight: SECRET },
      visitorTrend: { total: 1, average: 1, conversionHighlight: SECRET, insight: SECRET },
      offeringTrend: { total: 1, average: 1, insight: SECRET },
      highlights: [SECRET],
      attentionPoints: [SECRET],
      recommendations: [SECRET],
      closingMessage: SECRET,
    };
    await new ServiceReportsAiService(
      providerLike(monthly) as any,
      requestContext,
    ).generateMonthlySummary({
      month: 9,
      year: 2026,
      orgName: SECRET,
      reports: [
        { date: '2026-09-06', ministry: SECRET, attendanceCount: 1, visitorCount: 1, notes: SECRET },
      ],
    } as any);

    await new ServiceReportsAiService(
      providerLike({
        healthScore: 70,
        engagementLevel: 'alto',
        trends: [],
        alerts: [],
        pastoralInsights: SECRET,
      }) as any,
      requestContext,
    ).analyzeHealth({ orgName: SECRET, periodLabel: SECRET, attendanceData: [], visitorData: [] });

    expectNoSecretInLogs();
  });

  it('PraiseApp Kids: texto livre dos lideres (pode citar criancas) e saidas do modelo', async () => {
    const cases: Array<[string, unknown, unknown]> = [
      [
        'generateLessonPlan',
        { biblicalReference: 'Genesis 1', theme: SECRET, additionalContext: SECRET, recentLessonTitles: [SECRET] },
        {
          suggestedTitle: SECRET, biblicalReference: 'Gn 1', ageRange: '5-7', mainObjective: SECRET,
          lessonSummary: SECRET, iceBreaker: SECRET, lessonFlow: [SECRET], activity: SECRET,
          supplies: [SECRET], prayer: SECRET, takeHomeChallenge: SECRET, messageToParents: SECRET,
          youtubeSearchQuery: SECRET, leaderTips: [SECRET], safetyNotes: [SECRET],
        },
      ],
      [
        'generateDailyCheckinSummary',
        { date: '2026-09-20', totalCheckins: 3 },
        { headline: SECRET, summaryText: SECRET, highlights: [SECRET], actionItems: [SECRET], attentionLevel: 'baixo' },
      ],
      [
        'generateNextSequence',
        { currentBiblicalReference: 'Genesis 1', recentLessons: [{ suggestedTitle: SECRET }] },
        {
          suggestedTitle: SECRET, biblicalReference: 'Gn 2', testamentFocus: 'antigo', continuitySummary: SECRET,
          pedagogicalRationale: SECRET, memoryFocus: SECRET, openingIdea: SECRET, applicationFocus: SECRET,
          parentConnection: SECRET, balanceNotes: [SECRET],
        },
      ],
      [
        'expandWeeklyVerse',
        { reference: 'Salmo 23', text: SECRET },
        { childExplanation: SECRET, memoryGesture: SECRET, parentPhrase: SECRET, prayerPrompt: SECRET, applicationIdea: SECRET },
      ],
      [
        'generateOperationalAssistant',
        { operationalContext: `${SECRET} chorou a aula toda`, baseLesson: { suggestedTitle: SECRET } },
        {
          assistantSummary: SECRET, adaptedFlow: [SECRET], keyAdjustments: [SECRET], suppliesAdjustments: [SECRET],
          attentionResets: [SECRET], noScreenAlternative: SECRET, leaderScript: SECRET, parentMessageSnippet: SECRET,
        },
      ],
      [
        'generateAgeAdaptations',
        { baseLesson: { suggestedTitle: SECRET } },
        {
          baseReference: SECRET,
          versions: [
            { ageRange: '3-4', languageTone: SECRET, mainObjective: SECRET, openingIdea: SECRET, activity: SECRET, application: SECRET, leaderTip: SECRET, durationMin: 20 },
          ],
        },
      ],
      [
        'generatePostClassCommunication',
        { lessonPlan: { suggestedTitle: SECRET, biblicalReference: 'Genesis 1' } },
        { suggestedNoticeTitle: SECRET, parentMessage: SECRET, lessonSummary: SECRET, weeklyChallenge: SECRET, verseReinforcement: SECRET },
      ],
      [
        'generateEventSuggestion',
        { theme: SECRET, eventDate: '2026-10-01', targetAudience: SECRET },
        {
          suggestedTitle: SECRET, suggestedNoticeTitle: SECRET, description: SECRET, checklist: [SECRET],
          parentCommunication: SECRET, programFlow: [SECRET], locationSuggestion: SECRET,
        },
      ],
    ];

    for (const [method, input, payload] of cases) {
      const service = new KidsAiService(providerLike(payload) as any, requestContext);
      await (service as any)[method](input);
    }

    expectNoSecretInLogs();
  });

  it('Agilis: nomes de pessoas, projetos, tarefas, comentarios e respostas do modelo', async () => {
    const workspace = {
      totalTasks: 10, overdueTasks: 2, completedTasks: 5, backlogCount: 3, activeProjects: 1, teamCount: 1,
      topOverdueUsers: [{ name: SECRET, count: 2 }],
    };
    const payloads: Record<string, unknown> = {
      summary: { summary: SECRET },
      plan: { immediatePriorities: [SECRET], nextSteps: [SECRET], risks: [SECRET], recommendations: [SECRET] },
      bottlenecks: { overview: SECRET, bottlenecks: [{ title: SECRET, cause: SECRET, correctiveAction: SECRET }] },
      assignee: { suggestions: [{ name: SECRET, reason: SECRET }] },
      brief: { summary: SECRET, risks: [SECRET], opportunities: [SECRET], recommendations: [SECRET] },
    };
    const build = (payload: unknown) =>
      new AgilisWorkspaceAiService(
        providerLike(payload) as any,
        { generateTextFromContents: jest.fn().mockResolvedValue({ text: `${SECRET} resposta`, model: 'm' }) } as any,
        requestContext,
      );

    await build(payloads.summary).summarizeProject({ projectName: SECRET, totalTasks: 1, doneTasks: 0, overdueTasks: 1, overdueTaskTitles: [SECRET] });
    await build(payloads.summary).summarizeTask({ title: SECRET, status: 'DOING', priority: 'HIGH', assigneeName: SECRET, comments: [{ authorName: SECRET, content: SECRET }] });
    await build(payloads.plan).generateActionPlan({ projectName: SECRET, tasks: [{ title: SECRET, priority: 'HIGH', assigneeName: SECRET }] });
    await build(payloads.bottlenecks).identifyBottlenecks({ workspace, stagnantTasks: [{ title: SECRET, status: 'DOING', projectName: SECRET, assigneeName: SECRET }] });
    await build(payloads.assignee).suggestAssignee({ taskTitle: SECRET, taskPriority: 'HIGH', members: [{ name: SECRET, pendingTasks: 1 }] });
    await build(payloads.brief).generateStrategicBrief({
      metrics: { totalTasks: 1, doneTasks: 0, overdueTasks: 0, backlogTasks: 1, activeProjects: 1, members: 1, completionRate: 0, weeklyVelocity: 0 },
      insights: [{ severity: 'HIGH', title: SECRET, description: SECRET }],
    });
    await build({ overview: SECRET, moves: [{ from: SECRET, to: SECRET, tasksToMove: 1, reason: SECRET }] }).suggestRedistribution({
      overloaded: [{ name: SECRET, openTasks: 3, overdueTasks: 1, capacityScore: 90 }],
      available: [{ name: SECRET, openTasks: 1, overdueTasks: 0, capacityScore: 10 }],
    });
    await build({}).chat({ message: SECRET, history: [{ role: 'user', content: SECRET }], workspace });

    expectNoSecretInLogs();
  });

  it('log HTTP: a query string nao entra no path registrado', () => {
    const middleware = new RequestLoggingMiddleware(new RequestContextService());
    const response: any = new EventEmitter();
    response.setHeader = jest.fn();
    response.statusCode = 200;

    middleware.use(
      {
        headers: {},
        method: 'GET',
        originalUrl: `/health?email=${SECRET}`,
        ip: '10.0.0.1',
      } as any,
      response,
      jest.fn(),
    );
    response.emit('finish');

    expect(logged.some((line) => line.includes('GET /health'))).toBe(true);
    expectNoSecretInLogs();
  });
});
