import { Inject, Injectable, Logger } from '@nestjs/common';
import { StructuredOutputService } from '../../../capabilities/structured-output/structured-output.service';
import { RequestContextService } from '../../../common/logging/request-context.service';
import { LlmProvider } from '../../../providers/llm-provider.interface';
import { LLM_PROVIDER_TOKEN } from '../../../providers/provider.tokens';
import { resolveActiveProviderLabel } from '../../../providers/provider-selection';
import {
  AgilisActionPlanDto,
  AgilisBottlenecksDto,
  AgilisChatDto,
  AgilisProjectSummaryDto,
  AgilisStrategicBriefDto,
  AgilisSuggestAssigneeDto,
  AgilisTaskSummaryDto,
  AgilisWorkloadRedistributionDto,
} from './dto/agilis-workspace.dto';
import {
  AGILIS_ANALYST_SYSTEM_INSTRUCTION,
  buildAgilisActionPlanPrompt,
  buildAgilisBottlenecksPrompt,
  buildAgilisChatContents,
  buildAgilisChatSystemInstruction,
  buildAgilisProjectSummaryPrompt,
  buildAgilisRedistributionPrompt,
  buildAgilisStrategicBriefPrompt,
  buildAgilisSuggestAssigneePrompt,
  buildAgilisTaskSummaryPrompt,
} from './workspace-ai.prompt';
import {
  AGILIS_ACTION_PLAN_SCHEMA,
  AGILIS_ASSIGNEE_SCHEMA,
  AGILIS_BOTTLENECKS_SCHEMA,
  AGILIS_REDISTRIBUTION_SCHEMA,
  AGILIS_STRATEGIC_BRIEF_SCHEMA,
  AGILIS_SUMMARY_SCHEMA,
  validateAgilisActionPlan,
  validateAgilisAssignee,
  validateAgilisBottlenecks,
  validateAgilisRedistribution,
  validateAgilisStrategicBrief,
  validateAgilisSummary,
} from './workspace-ai.schemas';

const normalizeName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

@Injectable()
export class AgilisWorkspaceAiService {
  private readonly logger = new Logger(AgilisWorkspaceAiService.name);

  constructor(
    private readonly structuredOutputService: StructuredOutputService,
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

  private async analyze<T>(
    label: string,
    userPrompt: string,
    responseSchema: Record<string, unknown>,
    validate: (payload: unknown) => T,
    maxOutputTokens: number,
  ) {
    const requestId = this.requestContext.getRequestId();
    this.logger.log(`[${requestId}] Agilis ${label} started promptChars=${userPrompt.length}`);

    const result = await this.structuredOutputService.generate({
      userPrompt,
      systemInstruction: AGILIS_ANALYST_SYSTEM_INSTRUCTION,
      responseSchema,
      validate,
      temperature: 0.3,
      topP: 0.9,
      maxOutputTokens,
      thinkingBudget: 0,
    });

    this.logger.log(`[${requestId}] Agilis ${label} completed`);
    return { data: result.data, meta: this.responseMeta(result.model) };
  }

  async chat(input: AgilisChatDto) {
    const requestId = this.requestContext.getRequestId();
    this.logger.log(
      `[${requestId}] Agilis chat started historyTurns=${(input.history || []).length} messageChars=${input.message.length}`,
    );

    const result = await this.llmProvider.generateTextFromContents({
      systemInstruction: buildAgilisChatSystemInstruction(input.workspace),
      contents: buildAgilisChatContents(input),
      temperature: 0.4,
      topP: 0.9,
      maxOutputTokens: 1400,
      thinkingBudget: 0,
      promptChars: input.message.length,
    });
    const answer = result.text.trim();

    this.logger.log(`[${requestId}] Agilis chat completed answerChars=${answer.length}`);
    return { ...this.responseMeta(result.model), answer };
  }

  async summarizeProject(input: AgilisProjectSummaryDto) {
    const { data, meta } = await this.analyze(
      'project summary',
      buildAgilisProjectSummaryPrompt(input),
      AGILIS_SUMMARY_SCHEMA,
      validateAgilisSummary,
      700,
    );
    return { ...meta, summary: data.summary };
  }

  async summarizeTask(input: AgilisTaskSummaryDto) {
    const { data, meta } = await this.analyze(
      'task summary',
      buildAgilisTaskSummaryPrompt(input),
      AGILIS_SUMMARY_SCHEMA,
      validateAgilisSummary,
      600,
    );
    return { ...meta, summary: data.summary };
  }

  async generateActionPlan(input: AgilisActionPlanDto) {
    const { data, meta } = await this.analyze(
      'action plan',
      buildAgilisActionPlanPrompt(input),
      AGILIS_ACTION_PLAN_SCHEMA,
      validateAgilisActionPlan,
      1400,
    );
    return { ...meta, plan: data };
  }

  async identifyBottlenecks(input: AgilisBottlenecksDto) {
    const { data, meta } = await this.analyze(
      'bottlenecks',
      buildAgilisBottlenecksPrompt(input),
      AGILIS_BOTTLENECKS_SCHEMA,
      validateAgilisBottlenecks,
      1200,
    );
    return { ...meta, analysis: data };
  }

  async suggestAssignee(input: AgilisSuggestAssigneeDto) {
    const { data, meta } = await this.analyze(
      'assignee suggestion',
      buildAgilisSuggestAssigneePrompt(input),
      AGILIS_ASSIGNEE_SCHEMA,
      validateAgilisAssignee,
      500,
    );

    // O modelo so pode indicar quem esta na lista enviada; nome inventado e descartado.
    const members = new Map(
      input.members.map((member) => [normalizeName(member.name), member.name]),
    );
    const suggestions = data.suggestions.flatMap((suggestion) => {
      const name = members.get(normalizeName(suggestion.name));
      return name ? [{ name, reason: suggestion.reason }] : [];
    });

    return { ...meta, suggestions };
  }

  async suggestRedistribution(input: AgilisWorkloadRedistributionDto) {
    const { data, meta } = await this.analyze(
      'workload redistribution',
      buildAgilisRedistributionPrompt(input),
      AGILIS_REDISTRIBUTION_SCHEMA,
      validateAgilisRedistribution,
      800,
    );

    // So se move tarefa de quem esta sobrecarregado para quem tem folga, e nunca mais do que a pessoa tem.
    const overloaded = new Map(input.overloaded.map((m) => [normalizeName(m.name), m]));
    const available = new Map(input.available.map((m) => [normalizeName(m.name), m]));
    const moves = data.moves.flatMap((move) => {
      const from = overloaded.get(normalizeName(move.from));
      const to = available.get(normalizeName(move.to));
      if (!from || !to) return [];
      return [
        {
          from: from.name,
          to: to.name,
          tasksToMove: Math.min(move.tasksToMove, Math.max(1, from.openTasks)),
          reason: move.reason,
        },
      ];
    });

    return { ...meta, redistribution: { overview: data.overview, moves } };
  }

  async generateStrategicBrief(input: AgilisStrategicBriefDto) {
    const { data, meta } = await this.analyze(
      'strategic brief',
      buildAgilisStrategicBriefPrompt(input),
      AGILIS_STRATEGIC_BRIEF_SCHEMA,
      validateAgilisStrategicBrief,
      1500,
    );
    return { ...meta, brief: data };
  }
}
