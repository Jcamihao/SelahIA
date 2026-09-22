import { Injectable, Logger } from '@nestjs/common';
import { StructuredOutputService } from '../../../capabilities/structured-output/structured-output.service';
import { RequestContextService } from '../../../common/logging/request-context.service';
import { GenerateServiceReportsMonthlySummaryDto } from './dto/generate-monthly-summary.dto';
import {
  CHURCH_HEALTH_SCHEMA,
  SERVICE_REPORTS_MONTHLY_SUMMARY_SCHEMA,
  ServiceReportsAiMonthlySummary,
  validateChurchHealthAnalysis,
  validateServiceReportsAiMonthlySummary,
} from './service-reports-ai.schemas';
import {
  buildChurchHealthPrompt,
  buildServiceReportsMonthlySummaryPrompt,
} from './service-reports-ai.prompt';
import { resolveActiveProviderLabel } from '../../../providers/provider-selection';

@Injectable()
export class ServiceReportsAiService {
  private readonly logger = new Logger(ServiceReportsAiService.name);

  constructor(
    private readonly structuredOutputService: StructuredOutputService,
    private readonly requestContext: RequestContextService,
  ) {}

  private responseMeta(model: string) {
    return {
      provider: resolveActiveProviderLabel(),
      version: String(process.env.SELAH_PUBLIC_VERSION || 'v1').trim() || 'v1',
      model,
      generatedAt: new Date().toISOString(),
    };
  }

  async generateMonthlySummary(
    input: GenerateServiceReportsMonthlySummaryDto,
  ): Promise<{
    provider: string;
    version: string;
    model: string;
    generatedAt: string;
    summary: ServiceReportsAiMonthlySummary;
  }> {
    const requestId = this.requestContext.getRequestId();
    const totalReports = (input.reports || []).length;

    this.logger.log(
      `[${requestId}] Service reports monthly summary started month=${input.month}/${input.year} reports=${totalReports}`,
    );

    const prompt = buildServiceReportsMonthlySummaryPrompt(input);

    const result = await this.structuredOutputService.generate({
      userPrompt: prompt,
      systemInstruction:
        'Você é Selah IA, uma plataforma interna de IA para SaaS. Responda em JSON válido, sem markdown, com tom pastoral, analítico e encorajador. Baseie-se exclusivamente nos dados fornecidos.',
      responseSchema: SERVICE_REPORTS_MONTHLY_SUMMARY_SCHEMA,
      validate: validateServiceReportsAiMonthlySummary,
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens: 1400,
      thinkingBudget: 0,
    });

    this.logger.log(
      `[${requestId}] Service reports monthly summary completed trend="${result.data.overallTrend}" highlights=${result.data.highlights.length} recommendations=${result.data.recommendations.length}`,
    );

    return {
      ...this.responseMeta(result.model),
      summary: result.data,
    };
  }

  async analyzeHealth(input: any) {
    const requestId = this.requestContext.getRequestId();
    this.logger.log(`[${requestId}] Church health analysis started`);

    const prompt = buildChurchHealthPrompt(input);

    const result = await this.structuredOutputService.generate({
      userPrompt: prompt,
      systemInstruction: 'Você é Selah IA, estrategista de saúde da igreja e especialista em crescimento e retenção ministerial.',
      responseSchema: CHURCH_HEALTH_SCHEMA,
      validate: validateChurchHealthAnalysis,
      temperature: 0.2,
      thinkingBudget: 0,
    });

    this.logger.log(`[${requestId}] Church health analysis completed score=${result.data.healthScore}`);

    return {
      ...this.responseMeta(result.model),
      analysis: result.data,
    };
  }
}
