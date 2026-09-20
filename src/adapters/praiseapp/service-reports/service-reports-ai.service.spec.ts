import { ServiceReportsAiService } from './service-reports-ai.service';
import {
  buildChurchHealthPrompt,
  buildServiceReportsMonthlySummaryPrompt,
} from './service-reports-ai.prompt';
import {
  validateChurchHealthAnalysis,
  validateServiceReportsAiMonthlySummary,
} from './service-reports-ai.schemas';

const summary = {
  period: 'Setembro de 2026',
  headline: 'Um mês de crescimento constante',
  overallTrend: 'crescimento',
  attendanceTrend: {
    average: 110,
    peakValue: 130,
    peakDate: '2026-09-13',
    changePercent: 8,
    insight: 'Presença em alta.',
  },
  visitorTrend: {
    total: 12,
    average: 6,
    conversionHighlight: 'Dois visitantes voltaram.',
    insight: 'Bom fluxo de visitantes.',
  },
  offeringTrend: { total: 3000, average: 1500, insight: 'Estável.' },
  highlights: ['Presença cresceu'],
  attentionPoints: [],
  recommendations: ['Acompanhar visitantes'],
  closingMessage: 'Deus é fiel.',
};

const monthlyInput = {
  month: 9,
  year: 2026,
  orgName: 'Igreja Central',
  reports: [
    {
      date: '2026-09-06',
      ministry: 'Culto de domingo',
      attendanceCount: 100,
      visitorCount: 5,
      offeringValue: 1400,
      notes: 'Ceia',
    },
    {
      date: '2026-09-13',
      ministry: 'Culto de domingo',
      attendanceCount: 120,
      visitorCount: 7,
      offeringValue: 1600,
    },
  ],
};

const createService = (parsed: unknown) => {
  const generate = jest.fn(async (input: any) => ({
    data: input.validate(parsed),
    model: 'test-model',
  }));
  const service = new ServiceReportsAiService(
    { generate } as any,
    { getRequestId: () => 'test-request' } as any,
  );
  return { service, generate };
};

describe('ServiceReportsAiService', () => {
  it('wraps the monthly summary with provider metadata', async () => {
    const { service, generate } = createService(summary);

    const result = await service.generateMonthlySummary(monthlyInput as any);

    expect(result.summary).toEqual(summary);
    expect(result.provider).toBe('gemini-developer-api');
    expect(result.model).toBe('test-model');
    expect(generate.mock.calls[0][0].systemInstruction).toContain(
      'Baseie-se exclusivamente nos dados fornecidos',
    );
  });

  it('returns the health analysis object with provider metadata', async () => {
    const analysis = {
      healthScore: 78,
      engagementLevel: 'alto',
      trends: [{ metric: 'presença', trend: 'crescimento', percentage: 8 }],
      alerts: [],
      pastoralInsights: 'Comunidade saudável.',
    };
    const { service } = createService(analysis);

    const result = await service.analyzeHealth({
      orgName: 'Igreja Central',
      periodLabel: 'Últimas 12 semanas',
      attendanceData: [],
      visitorData: [],
    });

    expect(result.analysis).toEqual(analysis);
  });

  it('rejects a summary with an unknown overallTrend', async () => {
    const { service } = createService({ ...summary, overallTrend: 'explosivo' });

    await expect(
      service.generateMonthlySummary(monthlyInput as any),
    ).rejects.toThrow('overallTrend inválido');
  });
});

describe('buildServiceReportsMonthlySummaryPrompt', () => {
  it('computes totals and averages from the reports', () => {
    const prompt = buildServiceReportsMonthlySummaryPrompt(monthlyInput as any);

    expect(prompt).toContain('# Período: Setembro de 2026');
    expect(prompt).toContain('Total de cultos registrados: 2');
    expect(prompt).toContain('Presença total: 220 pessoas');
    expect(prompt).toContain('Visitantes total: 12');
    expect(prompt).toContain('Oferta total: R$ 3000.00');
    expect(prompt).toContain('Presença média: 110');
    expect(prompt).toContain('Visitantes médios: 6');
    expect(prompt).toContain('Oferta média: R$ 1500.00');
    expect(prompt).toContain('Observações: Ceia');
    expect(prompt).toContain('liderança da Igreja Central');
  });

  it('handles a month without reports and an unnamed church', () => {
    const prompt = buildServiceReportsMonthlySummaryPrompt({
      month: 1,
      year: 2026,
      reports: [],
    } as any);

    expect(prompt).toContain('# Período: Janeiro de 2026');
    expect(prompt).toContain('Presença média: 0');
    expect(prompt).toContain('(nenhum relatório neste período)');
    expect(prompt).toContain('liderança da Igreja');
  });
});

describe('buildChurchHealthPrompt', () => {
  it('lists the weekly attendance and visitor series', () => {
    const prompt = buildChurchHealthPrompt({
      orgName: 'Igreja Central',
      periodLabel: 'Últimas 12 semanas',
      attendanceData: [{ date: '2026-09-06', count: 100 }],
      visitorData: [{ date: '2026-09-06', count: 5 }],
    });

    expect(prompt).toContain('Igreja Central');
    expect(prompt).toContain('2026-09-06: 100');
    expect(prompt).toContain('2026-09-06: 5');
    expect(prompt).toContain('healthScore (0-100)');
  });
});

describe('service-reports validators', () => {
  it('rejects a summary missing a trend block or list', () => {
    expect(() =>
      validateServiceReportsAiMonthlySummary({ ...summary, visitorTrend: undefined }),
    ).toThrow('visitorTrend');
    expect(() =>
      validateServiceReportsAiMonthlySummary({ ...summary, highlights: 'x' }),
    ).toThrow('highlights');
  });

  it('requires the core health fields', () => {
    expect(() => validateChurchHealthAnalysis({ healthScore: 50 })).toThrow();
    expect(() => validateChurchHealthAnalysis(null)).toThrow();
  });
});
