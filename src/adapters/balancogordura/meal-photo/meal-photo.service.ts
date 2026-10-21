import { Inject, Injectable, Logger } from '@nestjs/common';
import { RequestContextService } from '../../../common/logging/request-context.service';
import { LlmProvider } from '../../../providers/llm-provider.interface';
import { LLM_PROVIDER_TOKEN } from '../../../providers/provider.tokens';
import { resolveActiveProviderLabel } from '../../../providers/provider-selection';
import { AnalyzeMealPhotoDto } from './dto/analyze-meal-photo.dto';
import {
  buildMealPhotoPrompt,
  MEAL_PHOTO_SYSTEM_INSTRUCTION,
} from './meal-photo.prompt';
import {
  MEAL_PHOTO_SCHEMA,
  MealPhotoResponse,
  validateMealPhotoResponse,
} from './meal-photo.schemas';

@Injectable()
export class MealPhotoService {
  private readonly logger = new Logger(MealPhotoService.name);

  constructor(
    @Inject(LLM_PROVIDER_TOKEN) private readonly llmProvider: LlmProvider,
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

  async analyze(
    input: AnalyzeMealPhotoDto,
  ): Promise<
    {
      provider: string;
      version: string;
      model: string;
      generatedAt: string;
    } & MealPhotoResponse
  > {
    const requestId = this.requestContext.getRequestId();
    const startedAt = Date.now();
    const approxKb = Math.round((input.imageBase64.length * 3) / 4 / 1024);

    this.logger.log(
      `[${requestId}] Meal photo analysis started mime=${input.mimeType} approxKb=${approxKb} mealType=${input.mealType ?? 'none'}`,
    );

    try {
      const prompt = buildMealPhotoPrompt(input);
      const result = await this.llmProvider.generateStructuredFromContents({
        systemInstruction: MEAL_PHOTO_SYSTEM_INSTRUCTION,
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: input.mimeType, data: input.imageBase64 } },
            ],
          },
        ],
        responseSchema: MEAL_PHOTO_SCHEMA,
        validate: validateMealPhotoResponse,
        temperature: 0.1,
        topP: 0.8,
        maxOutputTokens: 2000,
        thinkingBudget: 0,
        promptChars: prompt.length + input.imageBase64.length,
      });

      this.logger.log(
        `[${requestId}] Meal photo analysis completed status=${result.data.status} items=${result.data.items.length} questions=${result.data.questions.length} latencyMs=${Date.now() - startedAt}`,
      );

      return { ...this.responseMeta(result.model), ...result.data };
    } catch (error) {
      this.logger.warn(
        `[${requestId}] Meal photo analysis failed error=${error instanceof Error ? error.name : 'unknown'} latencyMs=${Date.now() - startedAt}`,
      );
      throw error;
    }
  }
}
