import { Injectable, Logger } from '@nestjs/common';
import { StructuredOutputService } from '../../../capabilities/structured-output/structured-output.service';
import { RequestContextService } from '../../../common/logging/request-context.service';
import { GenerateVeloSupportResponseDto } from './dto/generate-velo-support-response.dto';
import { buildVeloSupportPrompt } from './velo-support-ai.prompt';
import {
  VELO_SUPPORT_CHAT_SCHEMA,
  VeloSupportChatResponse,
  validateVeloSupportChatResponse,
} from './velo-support-ai.schemas';

@Injectable()
export class VeloSupportAiService {
  private readonly logger = new Logger(VeloSupportAiService.name);

  constructor(
    private readonly structuredOutputService: StructuredOutputService,
    private readonly requestContext: RequestContextService,
  ) {}

  private responseMeta(model: string) {
    return {
      provider: 'ollama',
      version: String(process.env.SELAH_PUBLIC_VERSION || 'v1').trim() || 'v1',
      model,
      generatedAt: new Date().toISOString(),
    };
  }

  async chat(
    input: GenerateVeloSupportResponseDto,
  ): Promise<
    {
      provider: string;
      version: string;
      model: string;
      generatedAt: string;
    } & VeloSupportChatResponse
  > {
    const requestId = this.requestContext.getRequestId();
    this.logger.log(
      `[${requestId}] Velo support response started route="${String(input.currentRoute || '').trim()}" role="${String(input.userRole || 'GUEST').trim()}" history=${(input.conversationHistory || []).length} catalogItems=${(input.featureCatalog || []).length}`,
    );

    const result = await this.structuredOutputService.generate({
      userPrompt: buildVeloSupportPrompt(input),
      systemInstruction:
        'Você é o assistente oficial de suporte do Velo. Responda em JSON válido, sem markdown, com precisão, acolhimento e obediência estrita ao contexto recebido.',
      responseSchema: VELO_SUPPORT_CHAT_SCHEMA,
      validate: validateVeloSupportChatResponse,
      temperature: 0.2,
      topP: 0.85,
      maxOutputTokens: 1100,
      thinkingBudget: 0,
    });

    this.logger.log(
      `[${requestId}] Velo support response completed area="${result.data.relatedArea}" scope=${result.data.scope} confidence=${result.data.confidence}`,
    );

    return {
      ...this.responseMeta(result.model),
      ...result.data,
    };
  }
}
