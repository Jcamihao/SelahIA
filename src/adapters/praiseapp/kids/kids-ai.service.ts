import { Injectable, Logger } from '@nestjs/common';
import { StructuredOutputService } from '../../../capabilities/structured-output/structured-output.service';
import { GeneratePraiseAppKidsLessonPlanDto } from './dto/generate-praiseapp-kids-lesson-plan.dto';
import {
  buildPraiseAppKidsAgeAdaptationsPrompt,
  buildPraiseAppKidsCheckinDailySummaryPrompt,
  buildPraiseAppKidsEventSuggestionPrompt,
  buildPraiseAppKidsLessonPlanPrompt,
  buildPraiseAppKidsNextSequencePrompt,
  buildPraiseAppKidsOperationalAssistantPrompt,
  buildPraiseAppKidsPostClassCommunicationPrompt,
  buildPraiseAppKidsWeeklyVerseExpansionPrompt,
} from './kids-ai.prompt';
import {
  PRAISEAPP_KIDS_AGE_ADAPTATIONS_SCHEMA,
  PRAISEAPP_KIDS_CHECKIN_DAILY_SUMMARY_SCHEMA,
  PRAISEAPP_KIDS_EVENT_SUGGESTION_SCHEMA,
  PRAISEAPP_KIDS_LESSON_PLAN_SCHEMA,
  PRAISEAPP_KIDS_NEXT_SEQUENCE_SCHEMA,
  PRAISEAPP_KIDS_OPERATIONAL_ASSISTANT_SCHEMA,
  PRAISEAPP_KIDS_POST_CLASS_COMMUNICATION_SCHEMA,
  PRAISEAPP_KIDS_WEEKLY_VERSE_EXPANSION_SCHEMA,
  PraiseAppKidsAgeAdaptations,
  PraiseAppKidsCheckinDailySummary,
  PraiseAppKidsEventSuggestion,
  PraiseAppKidsLessonPlanSuggestion,
  PraiseAppKidsOperationalAssistant,
  PraiseAppKidsPedagogicalSequence,
  PraiseAppKidsPostClassCommunication,
  PraiseAppKidsWeeklyVerseExpansion,
  validatePraiseAppKidsAgeAdaptations,
  validatePraiseAppKidsCheckinDailySummary,
  validatePraiseAppKidsEventSuggestion,
  validatePraiseAppKidsLessonPlanSuggestion,
  validatePraiseAppKidsOperationalAssistant,
  validatePraiseAppKidsPedagogicalSequence,
  validatePraiseAppKidsPostClassCommunication,
  validatePraiseAppKidsWeeklyVerseExpansion,
} from './kids-ai.schemas';
import { RequestContextService } from '../../../common/logging/request-context.service';
import { GeneratePraiseAppKidsCheckinDailySummaryDto } from './dto/generate-praiseapp-kids-checkin-daily-summary.dto';
import { GeneratePraiseAppKidsNextSequenceDto } from './dto/generate-praiseapp-kids-next-sequence.dto';
import { GeneratePraiseAppKidsWeeklyVerseExpansionDto } from './dto/generate-praiseapp-kids-weekly-verse-expansion.dto';
import { GeneratePraiseAppKidsOperationalAssistantDto } from './dto/generate-praiseapp-kids-operational-assistant.dto';
import { GeneratePraiseAppKidsAgeAdaptationsDto } from './dto/generate-praiseapp-kids-age-adaptations.dto';
import { GeneratePraiseAppKidsPostClassCommunicationDto } from './dto/generate-praiseapp-kids-post-class-communication.dto';
import { GeneratePraiseAppKidsEventSuggestionDto } from './dto/generate-praiseapp-kids-event-suggestion.dto';

@Injectable()
export class KidsAiService {
  private readonly logger = new Logger(KidsAiService.name);

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

  async generateLessonPlan(
    input: GeneratePraiseAppKidsLessonPlanDto,
  ): Promise<{
    provider: string;
    version: string;
    model: string;
    generatedAt: string;
    suggestion: PraiseAppKidsLessonPlanSuggestion;
  }> {
    const requestId = this.requestContext.getRequestId();
    const prompt = buildPraiseAppKidsLessonPlanPrompt(input);
    this.logger.log(
      `[${requestId}] Kids lesson generation started reference="${String(input.biblicalReference || '').trim()}" ageRange="${String(input.ageRangeLabel || '5-7 anos').trim()}" durationMin=${Number(input.durationMin || 35)} templates=${(input.recentTemplateTitles || []).length} lessons=${(input.recentLessonTitles || []).length}`,
    );
    const result = await this.structuredOutputService.generate({
      userPrompt: prompt,
      systemInstruction:
        'Você é Selah IA, uma plataforma interna de IA para SaaS. Responda em JSON válido, sem markdown, com foco operacional e seguro para equipes de igreja.',
      responseSchema: PRAISEAPP_KIDS_LESSON_PLAN_SCHEMA,
      validate: validatePraiseAppKidsLessonPlanSuggestion,
      temperature: 0.4,
      topP: 0.9,
      maxOutputTokens: 1800,
      thinkingBudget: 0,
    });

    this.logger.log(
      `[${requestId}] Kids lesson generation completed title="${result.data.suggestedTitle}" flowSteps=${result.data.lessonFlow.length} supplies=${result.data.supplies.length}`,
    );

    return {
      ...this.responseMeta(result.model),
      suggestion: result.data,
    };
  }

  async generateDailyCheckinSummary(
    input: GeneratePraiseAppKidsCheckinDailySummaryDto,
  ): Promise<{
    provider: string;
    version: string;
    model: string;
    generatedAt: string;
    summary: PraiseAppKidsCheckinDailySummary;
  }> {
    const requestId = this.requestContext.getRequestId();
    this.logger.log(
      `[${requestId}] Kids daily summary started date="${String(input.date || '').trim()}" totalCheckins=${Number(input.totalCheckins || 0)} firstVisits=${Number(input.firstVisits || 0)} open=${Number(input.totalOpenCheckins || 0)}`,
    );

    const result = await this.structuredOutputService.generate({
      userPrompt: buildPraiseAppKidsCheckinDailySummaryPrompt(input),
      systemInstruction:
        'Você é Selah IA, uma plataforma interna de IA para SaaS. Responda em JSON válido, sem markdown, com foco operacional e seguro para equipes de igreja.',
      responseSchema: PRAISEAPP_KIDS_CHECKIN_DAILY_SUMMARY_SCHEMA,
      validate: validatePraiseAppKidsCheckinDailySummary,
      temperature: 0.3,
      topP: 0.85,
      maxOutputTokens: 1000,
      thinkingBudget: 0,
    });

    this.logger.log(
      `[${requestId}] Kids daily summary completed headline="${result.data.headline}" attentionLevel=${result.data.attentionLevel}`,
    );

    return {
      ...this.responseMeta(result.model),
      summary: result.data,
    };
  }

  async generateNextSequence(
    input: GeneratePraiseAppKidsNextSequenceDto,
  ): Promise<{
    provider: string;
    version: string;
    model: string;
    generatedAt: string;
    sequence: PraiseAppKidsPedagogicalSequence;
  }> {
    const requestId = this.requestContext.getRequestId();
    this.logger.log(
      `[${requestId}] Kids next sequence started currentReference="${String(input.currentBiblicalReference || '').trim()}" ageRange="${String(input.ageRangeLabel || '').trim() || 'default'}" recentLessons=${(input.recentLessons || []).length}`,
    );

    const result = await this.structuredOutputService.generate({
      userPrompt: buildPraiseAppKidsNextSequencePrompt(input),
      systemInstruction:
        'Você é Selah IA, uma plataforma interna de IA para SaaS. Responda em JSON válido, sem markdown, com foco operacional e seguro para equipes de igreja.',
      responseSchema: PRAISEAPP_KIDS_NEXT_SEQUENCE_SCHEMA,
      validate: validatePraiseAppKidsPedagogicalSequence,
      temperature: 0.45,
      topP: 0.9,
      maxOutputTokens: 1200,
      thinkingBudget: 0,
    });

    this.logger.log(
      `[${requestId}] Kids next sequence completed title="${result.data.suggestedTitle}" reference="${result.data.biblicalReference}"`,
    );

    return {
      ...this.responseMeta(result.model),
      sequence: result.data,
    };
  }

  async expandWeeklyVerse(
    input: GeneratePraiseAppKidsWeeklyVerseExpansionDto,
  ): Promise<{
    provider: string;
    version: string;
    model: string;
    generatedAt: string;
    expansion: PraiseAppKidsWeeklyVerseExpansion;
  }> {
    const requestId = this.requestContext.getRequestId();
    this.logger.log(
      `[${requestId}] Kids weekly verse expansion started reference="${String(input.reference || '').trim()}"`,
    );

    const result = await this.structuredOutputService.generate({
      userPrompt: buildPraiseAppKidsWeeklyVerseExpansionPrompt(input),
      systemInstruction:
        'Você é Selah IA, uma plataforma interna de IA para SaaS. Responda em JSON válido, sem markdown, com foco pedagógico, simples e seguro para ministério infantil.',
      responseSchema: PRAISEAPP_KIDS_WEEKLY_VERSE_EXPANSION_SCHEMA,
      validate: validatePraiseAppKidsWeeklyVerseExpansion,
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens: 900,
      thinkingBudget: 0,
    });

    this.logger.log(
      `[${requestId}] Kids weekly verse expansion completed phrase="${result.data.parentPhrase}"`,
    );

    return {
      ...this.responseMeta(result.model),
      expansion: result.data,
    };
  }

  async generateOperationalAssistant(
    input: GeneratePraiseAppKidsOperationalAssistantDto,
  ): Promise<{
    provider: string;
    version: string;
    model: string;
    generatedAt: string;
    assistant: PraiseAppKidsOperationalAssistant;
  }> {
    const requestId = this.requestContext.getRequestId();
    this.logger.log(
      `[${requestId}] Kids operational assistant started context="${String(input.operationalContext || '').trim().slice(0, 120)}" desiredDuration=${Number(input.desiredDurationMin || 0) || 'n/a'}`,
    );

    const result = await this.structuredOutputService.generate({
      userPrompt: buildPraiseAppKidsOperationalAssistantPrompt(input),
      systemInstruction:
        'Você é Selah IA, uma plataforma interna de IA para SaaS. Responda em JSON válido, sem markdown, com foco operacional e seguro para equipes de igreja.',
      responseSchema: PRAISEAPP_KIDS_OPERATIONAL_ASSISTANT_SCHEMA,
      validate: validatePraiseAppKidsOperationalAssistant,
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens: 1400,
      thinkingBudget: 0,
    });

    this.logger.log(
      `[${requestId}] Kids operational assistant completed adjustments=${result.data.keyAdjustments.length} adaptedFlow=${result.data.adaptedFlow.length}`,
    );

    return {
      ...this.responseMeta(result.model),
      assistant: result.data,
    };
  }

  async generateAgeAdaptations(
    input: GeneratePraiseAppKidsAgeAdaptationsDto,
  ): Promise<{
    provider: string;
    version: string;
    model: string;
    generatedAt: string;
    adaptations: PraiseAppKidsAgeAdaptations;
  }> {
    const requestId = this.requestContext.getRequestId();
    this.logger.log(
      `[${requestId}] Kids age adaptations started targetRanges=${(input.targetAgeRanges || []).length || 3}`,
    );

    const result = await this.structuredOutputService.generate({
      userPrompt: buildPraiseAppKidsAgeAdaptationsPrompt(input),
      systemInstruction:
        'Você é Selah IA, uma plataforma interna de IA para SaaS. Responda em JSON válido, sem markdown, com foco pedagógico, comparativo e seguro para ministério infantil.',
      responseSchema: PRAISEAPP_KIDS_AGE_ADAPTATIONS_SCHEMA,
      validate: validatePraiseAppKidsAgeAdaptations,
      temperature: 0.4,
      topP: 0.9,
      maxOutputTokens: 1600,
      thinkingBudget: 0,
    });

    this.logger.log(
      `[${requestId}] Kids age adaptations completed versions=${result.data.versions.length} baseReference="${result.data.baseReference}"`,
    );

    return {
      ...this.responseMeta(result.model),
      adaptations: result.data,
    };
  }

  async generatePostClassCommunication(
    input: GeneratePraiseAppKidsPostClassCommunicationDto,
  ): Promise<{
    provider: string;
    version: string;
    model: string;
    generatedAt: string;
    communication: PraiseAppKidsPostClassCommunication;
  }> {
    const requestId = this.requestContext.getRequestId();
    const lessonPlan = input.lessonPlan || {};
    this.logger.log(
      `[${requestId}] Kids post-class communication started title="${String((lessonPlan as Record<string, unknown>)?.suggestedTitle || (lessonPlan as Record<string, unknown>)?.nomeAula || '').trim()}" reference="${String((lessonPlan as Record<string, unknown>)?.biblicalReference || (lessonPlan as Record<string, unknown>)?.textoBase || '').trim()}"`,
    );

    const result = await this.structuredOutputService.generate({
      userPrompt: buildPraiseAppKidsPostClassCommunicationPrompt(input),
      systemInstruction:
        'Você é Selah IA, uma plataforma interna de IA para SaaS. Responda em JSON válido, sem markdown, com foco acolhedor, pedagógico e seguro para equipes de igreja.',
      responseSchema: PRAISEAPP_KIDS_POST_CLASS_COMMUNICATION_SCHEMA,
      validate: validatePraiseAppKidsPostClassCommunication,
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens: 1100,
      thinkingBudget: 0,
    });

    this.logger.log(
      `[${requestId}] Kids post-class communication completed noticeTitle="${result.data.suggestedNoticeTitle}"`,
    );

    return {
      ...this.responseMeta(result.model),
      communication: result.data,
    };
  }

  async generateEventSuggestion(
    input: GeneratePraiseAppKidsEventSuggestionDto,
  ): Promise<{
    provider: string;
    version: string;
    model: string;
    generatedAt: string;
    event: PraiseAppKidsEventSuggestion;
  }> {
    const requestId = this.requestContext.getRequestId();
    this.logger.log(
      `[${requestId}] Kids event suggestion started theme="${String(input.theme || '').trim()}" date="${String(input.eventDate || '').trim()}" audience="${String(input.targetAudience || '').trim()}"`,
    );

    const result = await this.structuredOutputService.generate({
      userPrompt: buildPraiseAppKidsEventSuggestionPrompt(input),
      systemInstruction:
        'Você é Selah IA, uma plataforma interna de IA para SaaS. Responda em JSON válido, sem markdown, com foco operacional, acolhedor e seguro para ministério infantil.',
      responseSchema: PRAISEAPP_KIDS_EVENT_SUGGESTION_SCHEMA,
      validate: validatePraiseAppKidsEventSuggestion,
      temperature: 0.45,
      topP: 0.92,
      maxOutputTokens: 1400,
      thinkingBudget: 0,
    });

    this.logger.log(
      `[${requestId}] Kids event suggestion completed title="${result.data.suggestedTitle}" checklist=${result.data.checklist.length} flow=${result.data.programFlow.length}`,
    );

    return {
      ...this.responseMeta(result.model),
      event: result.data,
    };
  }
}
