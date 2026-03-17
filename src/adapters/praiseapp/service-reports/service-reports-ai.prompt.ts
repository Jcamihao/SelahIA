import { GenerateServiceReportsMonthlySummaryDto } from './dto/generate-monthly-summary.dto';

const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function buildServiceReportsMonthlySummaryPrompt(
  input: GenerateServiceReportsMonthlySummaryDto,
): string {
  const monthName = MONTH_NAMES_PT[(input.month ?? 1) - 1] ?? 'Mês desconhecido';
  const period = `${monthName} de ${input.year}`;
  const orgName = String(input.orgName || 'Igreja').trim() || 'Igreja';
  const reports = input.reports || [];

  const totalCultos = reports.length;
  const totalPresenca = reports.reduce((s, r) => s + Number(r.attendanceCount || 0), 0);
  const totalVisitantes = reports.reduce((s, r) => s + Number(r.visitorCount || 0), 0);
  const totalOferta = reports.reduce((s, r) => s + Number(r.offeringValue || 0), 0);
  const mediaPresenca = totalCultos > 0 ? Math.round(totalPresenca / totalCultos) : 0;
  const mediaVisitantes = totalCultos > 0 ? Math.round((totalVisitantes / totalCultos) * 10) / 10 : 0;
  const mediaOferta = totalCultos > 0 ? Math.round((totalOferta / totalCultos) * 100) / 100 : 0;

  const reportLines = reports
    .map((r, i) => {
      const parts = [
        `  Culto ${i + 1}: ${r.date} | Ministério: ${r.ministry}`,
        `    Presença: ${r.attendanceCount} | Visitantes: ${r.visitorCount}`,
      ];
      if (r.offeringValue !== undefined && r.offeringValue !== null) {
        parts.push(`    Oferta: R$ ${Number(r.offeringValue).toFixed(2)}`);
      }
      if (r.notes) {
        parts.push(`    Observações: ${String(r.notes).trim()}`);
      }
      return parts.join('\n');
    })
    .join('\n\n');

  return `
Você é Selah IA, assistente pastoral de dados. Analise os relatórios de culto abaixo e gere um sumário executivo mensal para a liderança da ${orgName}.

# Período: ${period}
# Total de cultos registrados: ${totalCultos}

## Totais do período
- Presença total: ${totalPresenca} pessoas
- Visitantes total: ${totalVisitantes}
- Oferta total: R$ ${totalOferta.toFixed(2)}

## Médias por culto
- Presença média: ${mediaPresenca}
- Visitantes médios: ${mediaVisitantes}
- Oferta média: R$ ${mediaOferta.toFixed(2)}

## Detalhamento por culto
${reportLines || '  (nenhum relatório neste período)'}

## Instruções para o sumário
- Escreva em português do Brasil, tom pastoral e encorajador
- Headline deve ser uma frase inspiradora que resume o mês em 1 linha
- overallTrend deve refletir a direção geral do período: "crescimento", "estabilidade" ou "queda"
- Destaques (highlights): 2 a 4 pontos positivos concretos, baseados nos dados
- Pontos de atenção (attentionPoints): 0 a 3 itens, apenas se houver dados que justifiquem preocupação
- Recomendações: 2 a 3 ações práticas para a liderança no próximo período
- closingMessage: frase pastoral breve de encorajamento (1-2 frases)
- Todos os campos numéricos (average, total, changePercent) devem ser números, não strings
- Se não houver relatórios suficientes para calcular changePercent, retorne null
`.trim();
}

export function buildChurchHealthPrompt(input: any): string {
  const attendance = (input.attendanceData || [])
    .map((d: any) => `  ${d.date}: ${d.count}`)
    .join('\n');
  const visitors = (input.visitorData || [])
    .map((d: any) => `  ${d.date}: ${d.count}`)
    .join('\n');

  return `
Você é Selah IA, estrategista de crescimento e saúde da igreja. Analise os dados de engajamento da ${input.orgName} para o período: ${input.periodLabel}.

# Dados de Presença (Últimas 12 semanas):
${attendance}

# Dados de Visitantes (Últimas 12 semanas):
${visitors}

Instruções:
- Calcule um healthScore (0-100) baseado em consistência, crescimento e retenção de visitantes.
- Identifique o engagementLevel (baixo, médio, alto).
- Liste tendências principais para métricas de presença e visitantes.
- Gere alertas se houver quedas bruscas ou anomalias.
- Providencie "pastoralInsights" estratégicos e profundos para o conselho de pastores.
  `.trim();
}
