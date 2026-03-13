import { Injectable } from '@nestjs/common';
import { StructuredOutputService } from '../../../capabilities/structured-output/structured-output.service';
import { GeneratePraiseAppKidsLessonPlanDto } from './dto/generate-praiseapp-kids-lesson-plan.dto';
import { buildPraiseAppKidsLessonPlanPrompt } from './kids-ai.prompt';
import {
  PRAISEAPP_KIDS_LESSON_PLAN_SCHEMA,
  PraiseAppKidsLessonPlanSuggestion,
  validatePraiseAppKidsLessonPlanSuggestion,
} from './kids-ai.schemas';

@Injectable()
export class KidsAiService {
  constructor(
    private readonly structuredOutputService: StructuredOutputService,
  ) {}

  async generateLessonPlan(
    input: GeneratePraiseAppKidsLessonPlanDto,
  ): Promise<{
    provider: string;
    model: string;
    generatedAt: string;
    suggestion: PraiseAppKidsLessonPlanSuggestion;
  }> {
    const prompt = buildPraiseAppKidsLessonPlanPrompt(input);
    const result = await this.structuredOutputService.generate({
      userPrompt: prompt,
      systemInstruction:
        'Você é Selah IA, uma plataforma interna de IA para SaaS. Responda em JSON válido, sem markdown, com foco operacional e seguro para equipes de igreja.',
      responseSchema: PRAISEAPP_KIDS_LESSON_PLAN_SCHEMA,
      validate: validatePraiseAppKidsLessonPlanSuggestion,
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 1400,
    });

    return {
      provider: 'gemini-developer-api',
      model: result.model,
      generatedAt: new Date().toISOString(),
      suggestion: result.data,
    };
  }
}

