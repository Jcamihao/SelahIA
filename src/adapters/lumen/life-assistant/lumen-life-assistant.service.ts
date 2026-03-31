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
  private readonly genericPhrases = [
    'mantenha o ritmo',
    'seguir acompanhando',
    'siga acompanhando',
    'proteja o caixa',
    'avance com cautela',
    'acompanhe de perto',
    'organize suas prioridades',
    'olhe para o panorama',
    'mantenha a disciplina',
    'reforce uma meta',
    'hoje voce tem',
    'seu saldo atual esta',
    'a previsao atual',
    'visao geral do dia',
  ];

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

    let result = await this.generateAssistantCard(input);

    if (this.isResponseTooGeneric(result.data, input)) {
      this.logger.warn(
        `[${requestId}] Lumen life assistant first pass was too generic, retrying with stricter specificity rules.`,
      );

      result = await this.generateAssistantCard(input, {
        tightenSpecificity: true,
        retryFeedback: this.buildRetryFeedback(result.data, input),
      });
    }

    this.logger.log(
      `[${requestId}] Lumen life assistant completed focus="${result.data.focusArea}" confidence=${result.data.confidence} highlights=${result.data.highlights.length} actions=${result.data.suggestedActions.length}`,
    );

    return {
      ...this.responseMeta(result.model),
      ...result.data,
    };
  }

  private generateAssistantCard(
    input: GenerateLumenLifeAssistantResponseDto,
    options?: {
      tightenSpecificity?: boolean;
      retryFeedback?: string;
    },
  ) {
    return this.structuredOutputService.generate({
      userPrompt: buildLumenLifeAssistantPrompt(input, options),
      systemInstruction:
        'Você é Selah IA, o motor oficial do assistente de vida do LUMEN. Responda em JSON válido, sem markdown. Use exclusivamente os dados estruturados enviados pela aplicação LUMEN como fonte de verdade. Preserve o padrão visual e verbal do card do assistente, mas gere o conteúdo do zero com base no contexto recebido. Sua resposta precisa ser concreta: quando existir nome de tarefa, meta, insight ou movimentação, cite esses itens explicitamente em vez de resumir de forma abstrata.',
      responseSchema: LUMEN_LIFE_ASSISTANT_SCHEMA,
      validate: validateLumenLifeAssistantResponse,
      temperature: options?.tightenSpecificity ? 0.08 : 0.12,
      topP: 0.85,
      maxOutputTokens: 1100,
      thinkingBudget: 0,
    });
  }

  private isResponseTooGeneric(
    response: LumenLifeAssistantResponse,
    input: GenerateLumenLifeAssistantResponseDto,
  ) {
    const combined = this.toSearchableText([
      response.answer,
      ...response.highlights,
      ...response.suggestedActions,
    ].join(' '));
    const actionText = this.toSearchableText(response.suggestedActions.join(' '));
    const namedAnchors = this.collectNamedAnchors(input);
    const explicitQuestionTargets = (input.matchedQuestionTargets || []).filter(
      Boolean,
    );
    const anchorMatches = namedAnchors.filter((anchor) =>
      combined.includes(this.toSearchableText(anchor)),
    ).length;
    const explicitQuestionTargetMatches = explicitQuestionTargets.filter(
      (target) => combined.includes(this.toSearchableText(target)),
    ).length;
    const genericPhraseMatches = this.genericPhrases.filter((phrase) =>
      combined.includes(this.toSearchableText(phrase)),
    ).length;
    const hasMonetarySignal =
      /r\$/i.test([response.answer, ...response.highlights].join(' ')) ||
      /\d/.test(response.answer);
    const actionableAnchors = [
      ...(input.openTasks || []).slice(0, 3).map((task) => task.title),
      ...(input.activeGoals || []).slice(0, 2).map((goal) => goal.title),
    ].filter(Boolean);
    const namedActionMatches = actionableAnchors.filter((anchor) =>
      actionText.includes(this.toSearchableText(anchor)),
    ).length;

    if (namedAnchors.length >= 2 && anchorMatches === 0) {
      return true;
    }

    if (
      explicitQuestionTargets.length > 0 &&
      explicitQuestionTargetMatches === 0
    ) {
      return true;
    }

    if (
      (input.intent === 'priorities' || (input.openTasks || []).length > 0) &&
      actionableAnchors.length > 0 &&
      namedActionMatches === 0
    ) {
      return true;
    }

    if (actionableAnchors.length >= 2 && namedActionMatches < 2) {
      return true;
    }

    if (
      input.intent === 'finance_overview' &&
      ((input.recentTransactions || []).length > 0 ||
        Number(input.currentBalance || 0) !== 0) &&
      !hasMonetarySignal
    ) {
      return true;
    }

    if (
      input.intent === 'general' &&
      explicitQuestionTargets.length > 0 &&
      genericPhraseMatches > 0 &&
      explicitQuestionTargetMatches < 1
    ) {
      return true;
    }

    return genericPhraseMatches >= 2 && anchorMatches < 2;
  }

  private collectNamedAnchors(input: GenerateLumenLifeAssistantResponseDto) {
    return [
      ...(input.openTasks || []).slice(0, 3).map((task) => task.title),
      ...(input.recentTransactions || [])
        .slice(0, 2)
        .map((transaction) => transaction.description),
      ...(input.activeGoals || []).slice(0, 2).map((goal) => goal.title),
      ...(input.activeInsights || [])
        .slice(0, 2)
        .map((insight) => this.firstMeaningfulFragment(insight.message)),
    ]
      .map((value) => String(value || '').trim())
      .filter((value) => value.length >= 4);
  }

  private buildRetryFeedback(
    response: LumenLifeAssistantResponse,
    input: GenerateLumenLifeAssistantResponseDto,
  ) {
    const missingAnchors = this.collectNamedAnchors(input).slice(0, 4);
    const candidateValues = [
      ...(input.recentTransactions || [])
        .slice(0, 2)
        .map(
          (transaction) =>
            `${transaction.description}: ${transaction.amount.toFixed(2)}`,
        ),
      ...(input.activeGoals || [])
        .slice(0, 2)
        .map((goal) => `${goal.title}: ${goal.progressPercent}%`),
    ];

    return [
      `Resposta anterior: ${response.answer}`,
      missingAnchors.length
        ? `Itens concretos disponíveis para citar: ${missingAnchors.join('; ')}.`
        : 'Use os itens concretos disponíveis no contexto detalhado.',
      (input.matchedQuestionTargets || []).length
        ? `Itens citados explicitamente pelo usuário: ${input.matchedQuestionTargets?.join('; ')}.`
        : 'Responda o foco real da pergunta do usuário antes de ampliar para panorama.',
      candidateValues.length
        ? `Valores concretos disponíveis: ${candidateValues.join('; ')}.`
        : 'Se houver valor financeiro relevante, cite o número exato.',
      'Reescreva com mais especificidade e menos abstração.',
    ].join(' ');
  }

  private firstMeaningfulFragment(message: string) {
    return String(message || '')
      .split(/[.!?]/)[0]
      .trim();
  }

  private toSearchableText(value: string) {
    return String(value || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9%$ ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
