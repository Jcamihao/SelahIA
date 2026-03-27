import { Injectable, Logger } from '@nestjs/common';
import { StructuredOutputService } from '../../../capabilities/structured-output/structured-output.service';
import { RequestContextService } from '../../../common/logging/request-context.service';
import { GenerateLumenLifeAssistantResponseDto } from './dto/generate-lumen-life-assistant-response.dto';
import { buildLumenLifeAssistantPrompt } from './lumen-life-assistant.prompt';
import {
  LUMEN_LIFE_ASSISTANT_SCHEMA,
  LumenLifeAssistantResponse,
  validateLumenLifeAssistantResponse,
} from './lumen-life-assistant.schemas';

@Injectable()
export class LumenLifeAssistantService {
  private readonly logger = new Logger(LumenLifeAssistantService.name);

  constructor(
    private readonly structuredOutputService: StructuredOutputService,
    private readonly requestContext: RequestContextService,
  ) {}

  private responseMeta(model: string) {
    return {
      provider: 'gemini-developer-api',
      version: String(process.env.SELAH_PUBLIC_VERSION || 'v1').trim() || 'v1',
      model,
      generatedAt: new Date().toISOString(),
    };
  }

  async chat(
    input: GenerateLumenLifeAssistantResponseDto,
  ): Promise<
    {
      provider: string;
      version: string;
      model: string;
      generatedAt: string;
    } & LumenLifeAssistantResponse
  > {
    const requestId = this.requestContext.getRequestId();

    this.logger.log(
      `[${requestId}] Lumen life assistant started user="${String(input.user.name || '').trim() || 'unknown'}" questionLength=${String(input.message || '').trim().length} tasksToday=${input.tasksTodayCount} overdue=${input.tasksOverdueCount} risk=${String(input.forecast.riskLevel || 'n/a').trim()}`,
    );

    const result = await this.structuredOutputService.generate({
      userPrompt: buildLumenLifeAssistantPrompt(input),
      systemInstruction:
        'Você é Selah IA, o motor oficial do assistente de vida do LUMEN. Responda em JSON válido, sem markdown. Use exclusivamente os dados estruturados enviados pela aplicação LUMEN como fonte de verdade. Preserve o padrão visual e verbal do card do assistente, mas gere o conteúdo do zero com base no contexto recebido.',
      responseSchema: LUMEN_LIFE_ASSISTANT_SCHEMA,
      validate: validateLumenLifeAssistantResponse,
      temperature: 0.12,
      topP: 0.9,
      maxOutputTokens: 1100,
      thinkingBudget: 0,
    });

    this.logger.log(
      `[${requestId}] Lumen life assistant completed focus="${result.data.focusArea}" confidence=${result.data.confidence} highlights=${result.data.highlights.length} actions=${result.data.suggestedActions.length}`,
    );

    return {
      ...this.responseMeta(result.model),
      ...result.data,
    };
  }
}
