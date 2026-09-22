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
import { resolveActiveProviderLabel } from '../../../providers/provider-selection';
import {
  extractMoneySignals,
  isDebtQuestion,
  isFinancialGuidanceQuestion,
  isPersonalGuidanceQuestion,
} from './lumen-life-assistant.classification';

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
    'tente se organizar',
    'va com calma',
    'um passo de cada vez',
    'respire fundo',
    'equilibre as prioridades',
    'olhe com carinho',
  ];
  private readonly actionableVerbs = [
    'list',
    'mape',
    'negoci',
    'renegoci',
    'revis',
    'cort',
    'defin',
    'separ',
    'bloque',
    'fech',
    'registr',
    'prioriz',
    'adi',
    'conclu',
    'cancel',
    'congel',
    'aport',
  ];
  constructor(
    private readonly structuredOutputService: StructuredOutputService,
    private readonly requestContext: RequestContextService,
  ) {}

  private responseMeta(
    model: string,
    provider = resolveActiveProviderLabel(),
  ) {
    return {
      provider,
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
      `[${requestId}] Lumen life assistant started questionLength=${String(input.message || '').trim().length} tasksToday=${input.tasksTodayCount} overdue=${input.tasksOverdueCount} risk=${String(input.forecast.riskLevel || 'n/a').trim()}`,
    );

    let result = await this.generateAssistantCard(input);
    let responseWasGeneric = this.isResponseTooGeneric(result.data, input);

    if (responseWasGeneric) {
      this.logger.warn(
        `[${requestId}] Lumen life assistant first pass was too generic, retrying with stricter specificity rules.`,
      );

      result = await this.generateAssistantCard(input, {
        tightenSpecificity: true,
        retryFeedback: this.buildRetryFeedback(result.data, input),
      });

      responseWasGeneric = this.isResponseTooGeneric(result.data, input);
    }

    if (responseWasGeneric) {
      this.logger.warn(
        `[${requestId}] Lumen life assistant second pass still generic, retrying with question-led plan rules.`,
      );

      result = await this.generateAssistantCard(input, {
        tightenSpecificity: true,
        forceQuestionLedPlan: true,
        retryFeedback: this.buildRetryFeedback(result.data, input),
      });

      responseWasGeneric = this.isResponseTooGeneric(result.data, input);
    }

    if (responseWasGeneric) {
      const fallback = this.buildRuleBasedFallback(input);

      if (fallback) {
        this.logger.warn(
          `[${requestId}] Lumen life assistant model output remained generic after retries, using rule-based fallback for question profile.`,
        );

        return {
          ...this.responseMeta('selah-rules-fallback', 'selah-rules-engine'),
          ...fallback,
        };
      }
    }

    this.logger.log(
      `[${requestId}] Lumen life assistant completed confidence=${result.data.confidence} highlights=${result.data.highlights.length} actions=${result.data.suggestedActions.length}`,
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
      forceQuestionLedPlan?: boolean;
      retryFeedback?: string;
    },
  ) {
    return this.structuredOutputService.generate({
      userPrompt: buildLumenLifeAssistantPrompt(input, options),
      systemInstruction:
        'Você é Selah IA, o motor oficial do assistente de vida do LUMEN. Responda em JSON válido, sem markdown. Use exclusivamente os dados estruturados enviados pela aplicação LUMEN e os fatos explicitamente afirmados pelo usuário na pergunta como fonte de verdade. Preserve o padrão visual e verbal do card do assistente, mas gere o conteúdo do zero com base no contexto recebido. Sua resposta precisa ser concreta: quando existir nome de tarefa, meta, insight, movimentação, valor monetário ou problema explícito do usuário, cite esses itens diretamente em vez de resumir de forma abstrata. Para perguntas de dívida, aperto financeiro, organização da rotina ou vida pessoal, entregue diagnóstico curto e plano viável, nunca coaching genérico.',
      responseSchema: LUMEN_LIFE_ASSISTANT_SCHEMA,
      validate: validateLumenLifeAssistantResponse,
      temperature: options?.forceQuestionLedPlan
        ? 0.05
        : options?.tightenSpecificity
          ? 0.08
          : 0.12,
      topP: 0.85,
      maxOutputTokens: 1450,
      thinkingBudget: options?.forceQuestionLedPlan
        ? 256
        : options?.tightenSpecificity
          ? 128
          : 0,
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
    const questionAnchors = this.collectQuestionAnchors(input);
    const explicitQuestionTargets = (input.matchedQuestionTargets || []).filter(
      Boolean,
    );
    const anchorMatches = namedAnchors.filter((anchor) =>
      combined.includes(this.toSearchableText(anchor)),
    ).length;
    const explicitQuestionTargetMatches = explicitQuestionTargets.filter(
      (target) => combined.includes(this.toSearchableText(target)),
    ).length;
    const questionAnchorMatches = questionAnchors.filter((anchor) =>
      combined.includes(this.toSearchableText(anchor)),
    ).length;
    const genericPhraseMatches = this.genericPhrases.filter((phrase) =>
      combined.includes(this.toSearchableText(phrase)),
    ).length;
    const hasMonetarySignal =
      /r\$/i.test([response.answer, ...response.highlights].join(' ')) ||
      /\d/.test(response.answer);
    const isDebtGuidance = isDebtQuestion(input.message);
    const isFinancialGuidance = isFinancialGuidanceQuestion(input);
    const isPersonalGuidance = isPersonalGuidanceQuestion(input.message);
    const mentionsDebtTerms =
      /\b(divid|negoci|juros|parcela|credor|atraso|acordo|renegoci)\b/.test(
        combined,
      );
    const monetaryQuestionSignals = extractMoneySignals(input.message);
    const monetaryQuestionMatches = monetaryQuestionSignals.filter((signal) =>
      combined.includes(this.toSearchableText(signal)),
    ).length;
    const actionVerbMatches = this.actionableVerbs.filter((verb) =>
      actionText.includes(this.toSearchableText(verb)),
    ).length;
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
      questionAnchors.length > 0 &&
      questionAnchorMatches === 0 &&
      explicitQuestionTargetMatches === 0 &&
      namedAnchors.length === 0
    ) {
      return true;
    }

    if (isDebtGuidance) {
      if (!mentionsDebtTerms) {
        return true;
      }

      if (
        monetaryQuestionSignals.length > 0 &&
        monetaryQuestionMatches === 0 &&
        !hasMonetarySignal
      ) {
        return true;
      }

      if (response.suggestedActions.length < 3) {
        return true;
      }
    }

    if (
      (isFinancialGuidance || isPersonalGuidance) &&
      String(response.answer || '').trim().length < 150
    ) {
      return true;
    }

    if ((isFinancialGuidance || isDebtGuidance) && actionVerbMatches < 2) {
      return true;
    }

    if (
      input.intent === 'priorities' &&
      actionableAnchors.length > 0 &&
      namedActionMatches === 0
    ) {
      return true;
    }

    if (
      input.intent === 'priorities' &&
      actionableAnchors.length >= 2 &&
      namedActionMatches < 2
    ) {
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

  private collectQuestionAnchors(input: GenerateLumenLifeAssistantResponseDto) {
    return [
      ...(input.matchedQuestionTargets || []),
      ...extractMoneySignals(input.message),
      ...(isDebtQuestion(input.message)
        ? ['divida', 'juros', 'negociacao']
        : []),
      ...(isPersonalGuidanceQuestion(input.message)
        ? ['rotina', 'vida pessoal', 'energia']
        : []),
    ]
      .map((value) => String(value || '').trim())
      .filter((value) => value.length >= 4);
  }

  private buildRetryFeedback(
    response: LumenLifeAssistantResponse,
    input: GenerateLumenLifeAssistantResponseDto,
  ) {
    const missingAnchors = this.collectNamedAnchors(input).slice(0, 4);
    const questionAnchors = this.collectQuestionAnchors(input).slice(0, 4);
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
      questionAnchors.length
        ? `Fatos explícitos da pergunta que precisam aparecer: ${questionAnchors.join('; ')}.`
        : 'Use com força o que o usuário afirmou na própria pergunta.',
      (input.matchedQuestionTargets || []).length
        ? `Itens citados explicitamente pelo usuário: ${input.matchedQuestionTargets?.join('; ')}.`
        : 'Responda o foco real da pergunta do usuário antes de ampliar para panorama.',
      candidateValues.length
        ? `Valores concretos disponíveis: ${candidateValues.join('; ')}.`
        : 'Se houver valor financeiro relevante, cite o número exato.',
      isDebtQuestion(input.message)
        ? 'A resposta precisa explicar como quitar ou renegociar sem sacrificar o básico da vida.'
        : isPersonalGuidanceQuestion(input.message)
          ? 'A resposta precisa soar como orientação prática de vida pessoal, não como panorama institucional.'
          : 'A resposta precisa entregar um plano curto, não uma mensagem motivacional genérica.',
      'Reescreva com mais especificidade e menos abstração.',
    ].join(' ');
  }

  private buildRuleBasedFallback(
    input: GenerateLumenLifeAssistantResponseDto,
  ): LumenLifeAssistantResponse | null {
    if (isDebtQuestion(input.message)) {
      return this.buildDebtGuidanceFallback(input);
    }

    if (isFinancialGuidanceQuestion(input)) {
      return this.buildFinancialGuidanceFallback(input);
    }

    if (isPersonalGuidanceQuestion(input.message)) {
      return this.buildPersonalGuidanceFallback(input);
    }

    return null;
  }

  private buildDebtGuidanceFallback(
    input: GenerateLumenLifeAssistantResponseDto,
  ): LumenLifeAssistantResponse {
    const amount = extractMoneySignals(input.message)[0] || null;
    const balance = this.formatCurrency(
      Number(input.currentBalance || 0),
      input.user.preferredCurrency,
    );
    const predictedBalance = this.formatCurrency(
      Number(input.forecast.predictedBalance || 0),
      input.user.preferredCurrency,
    );
    const risk = String(input.forecast.riskLevel || 'desconhecido').toLowerCase();

    return {
      answer: amount
        ? `Uma dívida de ${amount} pede um plano de quitação sem apertar o básico da sua vida. O foco agora é parar novos juros, preservar moradia, alimentação, transporte, saúde e trabalho, e negociar primeiro a parte mais cara ou mais atrasada.`
        : `Essa dívida precisa de um plano de quitação que preserve o básico da sua vida antes de acelerar parcelas. O foco agora é parar novos juros, entender o custo real do débito e negociar primeiro a parte mais cara ou mais urgente.`,
      highlights: this.uniqueStrings([
        amount ? `Valor citado na pergunta: ${amount}.` : null,
        `Saldo atual no app: ${balance}.`,
        `Previsão financeira atual: ${predictedBalance} com risco ${risk}.`,
        'Quitar sem se ferrar significa não sacrificar moradia, comida, transporte, saúde ou trabalho.',
        'Se houver mais de uma dívida, juros mais altos ou atraso crítico vêm primeiro.',
      ]).slice(0, 4),
      suggestedActions: this.uniqueStrings([
        'Liste hoje cada dívida com credor, saldo, juros e atraso.',
        amount
          ? `Defina uma parcela mensal para atacar ${amount} sem mexer no custo básico de vida.`
          : 'Defina um valor mensal fixo que caiba no seu mês sem mexer no básico.',
        'Negocie primeiro a dívida com maior juros ou já em atraso e peça desconto para quitar ou reduzir parcelas.',
        'Suspenda por 30 dias gastos não essenciais e direcione essa sobra para a dívida renegociada.',
      ]).slice(0, 4),
      focusArea: 'Quitar divida',
      confidence: 'medium',
      disclaimer: null,
    };
  }

  private buildFinancialGuidanceFallback(
    input: GenerateLumenLifeAssistantResponseDto,
  ): LumenLifeAssistantResponse {
    const balance = this.formatCurrency(
      Number(input.currentBalance || 0),
      input.user.preferredCurrency,
    );
    const monthlyExpenses = this.formatCurrency(
      Number(input.monthlyExpenses || 0),
      input.user.preferredCurrency,
    );
    const monthlyIncome = this.formatCurrency(
      Number(input.monthlyIncome || 0),
      input.user.preferredCurrency,
    );
    const predictedBalance = this.formatCurrency(
      Number(input.forecast.predictedBalance || 0),
      input.user.preferredCurrency,
    );
    const risk = String(input.forecast.riskLevel || 'desconhecido').toLowerCase();

    return {
      answer:
        `Seu pedido pede reorganização financeira prática, não só panorama. Hoje o melhor caminho é decidir onde o caixa pode respirar, porque você está com ${balance} agora, ${monthlyIncome} de entradas no mês, ${monthlyExpenses} de saídas e previsão de ${predictedBalance}.`,
      highlights: this.uniqueStrings([
        `Risco atual da previsão: ${risk}.`,
        'A resposta precisa virar plano de corte, negociação ou priorização, não comentário genérico.',
        (input.recentTransactions || [])[0]
          ? `Movimentação mais recente no contexto: ${input.recentTransactions?.[0]?.description}.`
          : null,
        (input.activeGoals || [])[0]
          ? `Meta ativa para proteger: ${input.activeGoals?.[0]?.title}.`
          : null,
      ]).slice(0, 4),
      suggestedActions: this.uniqueStrings([
        'Revise hoje as saídas recorrentes e marque o que pode ser cortado, pausado ou renegociado.',
        'Defina um limite semanal de gasto para o restante do mês.',
        'Escolha uma conta, parcela ou categoria para atacar primeiro e acompanhe isso por 7 dias.',
        'Registre qualquer gasto extra no mesmo dia para não perder o controle do fluxo.',
      ]).slice(0, 4),
      focusArea: 'Vida financeira',
      confidence: 'medium',
      disclaimer: null,
    };
  }

  private buildPersonalGuidanceFallback(
    input: GenerateLumenLifeAssistantResponseDto,
  ): LumenLifeAssistantResponse {
    const firstTask = input.openTasks?.[0]?.title || null;
    const firstGoal = input.activeGoals?.[0]?.title || null;

    return {
      answer:
        'O melhor ajuste agora nao e tentar consertar a vida toda de uma vez. O caminho mais sustentavel e reduzir atrito na rotina, escolher um foco pequeno para esta semana e alinhar tarefas, energia e dinheiro com esse eixo.',
      highlights: this.uniqueStrings([
        firstTask ? `Tarefa concreta para puxar seu dia: ${firstTask}.` : null,
        firstGoal ? `Meta que pode dar direcao: ${firstGoal}.` : null,
        input.tasksOverdueCount > 0
          ? `Existem ${input.tasksOverdueCount} pendencia(s) atrasada(s) puxando sua energia para baixo.`
          : 'Nao ha atraso dominante no contexto atual.',
        'Vida pessoal melhora mais com consistencia pequena do que com promessa grande.',
      ]).slice(0, 4),
      suggestedActions: this.uniqueStrings([
        firstTask
          ? `Bloqueie um bloco curto hoje para fechar ${firstTask}.`
          : 'Escolha uma unica prioridade pessoal para hoje e proteja 20 minutos para ela.',
        'Corte um dreno da rotina nesta semana: excesso de tela, gasto impulsivo ou interrupcao recorrente.',
        firstGoal
          ? `Conecte sua semana com ${firstGoal} para sentir progresso real.`
          : 'Feche o dia registrando o que te deu energia e o que te drenou.',
        'Repita amanha o mesmo passo simples antes de tentar aumentar a meta.',
      ]).slice(0, 4),
      focusArea: 'Vida pessoal',
      confidence: 'medium',
      disclaimer: null,
    };
  }

  private firstMeaningfulFragment(message: string) {
    return String(message || '')
      .split(/[.!?]/)[0]
      .trim();
  }

  private formatCurrency(amount: number, currency: string) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: String(currency || 'BRL').trim() || 'BRL',
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  }

  private uniqueStrings(items: Array<string | null | undefined>) {
    return Array.from(
      new Set(
        items
          .map((item) => String(item || '').trim())
          .filter(Boolean),
      ),
    );
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
