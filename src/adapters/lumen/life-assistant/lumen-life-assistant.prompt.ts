import { GenerateLumenLifeAssistantResponseDto } from './dto/generate-lumen-life-assistant-response.dto';
import {
  DEBT_GUIDANCE_PATTERN,
  FINANCIAL_GUIDANCE_PATTERN,
  extractQuestionFacts,
  isPersonalGuidanceQuestion,
} from './lumen-life-assistant.classification';

const listBlock = (title: string, items?: string[]) => {
  const normalizedItems = (items || [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  if (!normalizedItems.length) {
    return `${title}: nenhum item relevante informado.`;
  }

  return `${title}:\n- ${normalizedItems.join('\n- ')}`;
};

const inlineList = (items?: string[]) => {
  const normalizedItems = (items || [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  if (!normalizedItems.length) {
    return 'nenhum item concreto informado';
  }

  return normalizedItems.join('; ');
};

const classifyQuestion = (
  input: GenerateLumenLifeAssistantResponseDto,
  questionFacts: string[],
) => {
  const message = String(input.message || '').trim();
  const normalizedMessage = message.toLowerCase();
  const isDebtGuidance = DEBT_GUIDANCE_PATTERN.test(message);
  const isFinancialGuidance =
    isDebtGuidance ||
    input.intent === 'finance_overview' ||
    FINANCIAL_GUIDANCE_PATTERN.test(message);
  const isPersonalGuidance =
    isPersonalGuidanceQuestion(message) &&
    input.intent === 'general';

  if (isDebtGuidance) {
    return {
      label: 'quitação de dívida / reorganização financeira',
      rules: [
        'Trate a pergunta como um problema concreto de reorganização financeira, não como visão geral.',
        'Cite o valor explicitamente informado pelo usuário quando ele existir, por exemplo uma dívida de 15 mil.',
        'Explique como quitar sem comprometer moradia, alimentação, transporte, saúde ou trabalho.',
        'Oriente a ordem prática: mapear credores, entender juros e atraso, definir parcela realista, negociar primeiro a dívida mais cara ou mais urgente.',
      ],
      requiredFacts:
        questionFacts.length > 0
          ? `Fatos do próprio texto do usuário que precisam aparecer: ${questionFacts.join('; ')}.`
          : 'Se o usuário trouxe valor, tipo de dívida ou urgência, isso precisa aparecer explicitamente.',
    };
  }

  if (isFinancialGuidance) {
    return {
      label: 'orientação financeira prática',
      rules: [
        'Responda como um estrategista financeiro pessoal, com diagnóstico curto e plano viável.',
        'Conecte a pergunta com saldo, despesas, previsão, risco e hábitos financeiros quando esses dados existirem.',
        'Prefira conselhos concretos sobre corte, negociação, priorização, reserva e fluxo de caixa.',
      ],
      requiredFacts:
        questionFacts.length > 0
          ? `Use os fatos explícitos da pergunta: ${questionFacts.join('; ')}.`
          : 'Se a pergunta trouxer valor ou meta financeira explícita, cite esse número.',
    };
  }

  if (isPersonalGuidance) {
    return {
      label: 'organização de vida pessoal / rotina',
      rules: [
        'Responda como um orientador de vida prática: acolhedor, mas objetivo.',
        'Conecte rotina, energia, foco, tarefas, metas e dinheiro quando isso ajudar.',
        'Evite frases motivacionais vazias; entregue um ajuste de comportamento que caiba no dia real do usuário.',
      ],
      requiredFacts:
        questionFacts.length > 0
          ? `Considere os fatos explícitos da pergunta: ${questionFacts.join('; ')}.`
          : 'Se a pergunta não trouxer fatos concretos, use os sinais da rotina e do contexto estruturado do app.',
    };
  }

  if (
    normalizedMessage.includes('como') ||
    normalizedMessage.includes('devo') ||
    normalizedMessage.includes('vale a pena') ||
    normalizedMessage.includes('faz sentido')
  ) {
    return {
      label: 'orientação prática / decisão',
      rules: [
        'Comece pela decisão principal que o usuário precisa tomar.',
        'Explique o porquê em linguagem curta e direta, antes de listar ações.',
      ],
      requiredFacts:
        questionFacts.length > 0
          ? `Use os fatos explícitos da pergunta: ${questionFacts.join('; ')}.`
          : 'Se houver alvos citados na pergunta, responda primeiro sobre eles.',
    };
  }

  return {
    label: 'leitura geral contextual',
    rules: [
      'Responda primeiro ao pedido do usuário e só use panorama como apoio.',
      'Mantenha o texto concreto, humano e orientado a decisão.',
    ],
    requiredFacts:
      questionFacts.length > 0
        ? `A pergunta trouxe fatos explícitos: ${questionFacts.join('; ')}.`
        : 'Não há fatos explícitos novos além do contexto estruturado do app.',
  };
};

export const buildLumenLifeAssistantPrompt = (
  input: GenerateLumenLifeAssistantResponseDto,
  options?: {
    tightenSpecificity?: boolean;
    forceQuestionLedPlan?: boolean;
    retryFeedback?: string;
  },
) => {
  const questionFacts = extractQuestionFacts(input.message);
  const questionProfile = classifyQuestion(input, questionFacts);
  const openTasks = (input.openTasks || []).map((task) => {
    const due = task.dueDateLabel ? `vence ${task.dueDateLabel}` : 'sem prazo informado';
    const category = task.category ? `categoria ${task.category}` : 'sem categoria';
    const impact =
      task.hasFinancialImpact && Number.isFinite(task.estimatedAmount)
        ? `impacto financeiro estimado de ${Number(task.estimatedAmount).toFixed(2)}`
        : task.hasFinancialImpact
          ? 'com impacto financeiro'
          : 'sem impacto financeiro direto';

    return `${task.title} | prioridade ${String(task.priority || 'não informada')} | ${due} | ${category} | ${impact}`;
  });

  const recentTransactions = (input.recentTransactions || []).map(
    (transaction) =>
      `${transaction.description} | ${transaction.type} | ${transaction.dateLabel} | ${transaction.category || 'sem categoria'} | ${transaction.amount.toFixed(2)}`,
  );

  const activeGoals = (input.activeGoals || []).map((goal) => {
    const targetDate = goal.targetDateLabel
      ? `data alvo ${goal.targetDateLabel}`
      : 'sem data alvo informada';
    return `${goal.title} | status ${goal.status} | progresso ${goal.progressPercent}% | ${targetDate}`;
  });

  const activeInsights = (input.activeInsights || []).map(
    (insight) =>
      `${insight.severity} | ${insight.type} | ${insight.message}`,
  );

  const preferredAnchors = [
    ...questionFacts.map((fact) => `Pergunta: ${fact}`),
    ...(input.matchedQuestionTargets || [])
      .slice(0, 3)
      .map((target) => `Alvo citado: ${target}`),
    ...(input.openTasks || []).slice(0, 3).map((task) => `Tarefa: ${task.title}`),
    ...(input.recentTransactions || [])
      .slice(0, 2)
      .map(
        (transaction) =>
          `Movimentação: ${transaction.description} (${transaction.type}, ${transaction.amount.toFixed(2)})`,
      ),
    ...(input.activeGoals || [])
      .slice(0, 2)
      .map((goal) => `Meta: ${goal.title} (${goal.progressPercent}%)`),
    ...(input.activeInsights || [])
      .slice(0, 2)
      .map((insight) => `Insight: ${insight.message}`),
  ];

  return `
Contexto do produto:
- Produto consumidor: LUMEN
- Função desta IA: assistente de vida do usuário dentro do app
- Idioma alvo: pt-BR
- Papel desta IA: conectar tarefas, dinheiro, rotina e objetivos com orientação prática
- Fonte única da verdade: o contexto estruturado montado pela aplicação LUMEN

Sessão atual:
- Usuário: ${String(input.user.name || '').trim() || 'Usuário'}
- Data percebida: ${String(input.currentDateLabel || '').trim() || 'não informada'}
- Moeda preferida: ${String(input.user.preferredCurrency || '').trim() || 'BRL'}
- Módulo de origem: ${String(input.originModule || 'general').trim()}
- Pergunta atual: ${String(input.message || '').trim()}
- Intenção já classificada pelo backend: ${String(input.intent || 'general').trim()}
- Diretriz de leitura da pergunta: ${String(input.questionContextSummary || 'Responder diretamente ao que o usuário pediu, sem cair em panorama padrão quando não for necessário.').trim()}
- Alvos citados explicitamente pelo usuário: ${inlineList(input.matchedQuestionTargets)}
- Leitura especializada da pergunta: ${questionProfile.label}
- Fatos explícitos trazidos pelo próprio usuário: ${inlineList(questionFacts)}
- FocusArea sugerido pela aplicação: ${String(input.focusAreaHint || 'Panorama').trim()}
- Memória curta de conversas recentes: ${String(input.conversationMemory || 'nenhum contexto anterior enviado').trim()}

Resumo consolidado do LUMEN:
${String(input.lifeContextSummary || '').trim()}

Contexto detalhado montado pela aplicação:
${String(input.applicationPromptContext || '').trim()}

Indicadores principais:
- Tarefas para hoje: ${Number(input.tasksTodayCount || 0)}
- Tarefas atrasadas: ${Number(input.tasksOverdueCount || 0)}
- Saldo atual: ${Number(input.currentBalance || 0).toFixed(2)}
- Despesas do mês: ${Number(input.monthlyExpenses || 0).toFixed(2)}
- Entradas do mês: ${Number(input.monthlyIncome || 0).toFixed(2)}
- Saldo previsto: ${Number(input.forecast.predictedBalance || 0).toFixed(2)}
- Risco da previsão: ${String(input.forecast.riskLevel || 'desconhecido').trim()}

${listBlock('Tarefas abertas com maior relevância', openTasks)}

${listBlock('Movimentações recentes', recentTransactions)}

${listBlock('Metas ativas', activeGoals)}

${listBlock('Insights já detectados pelo motor do produto', activeInsights)}

${listBlock('Lembretes próximos', input.reminderLabels)}

${listBlock('Notificações abertas', input.notificationLabels)}

Âncoras concretas que devem ser preferidas na redação:
- ${inlineList(preferredAnchors)}

Regras obrigatórias:
- Responda somente com base no contexto recebido do LUMEN.
- A própria pergunta do usuário faz parte do contexto confiável. Se ele afirmou um valor, problema, meta ou situação, você pode e deve citar isso como fato explícito da conversa.
- Nunca use conhecimento externo, memória própria ou inferência solta para inventar fatos.
- Nunca invente saldo, gasto, tarefa, meta, integração, funcionalidade ou histórico não informado.
- Fale como um assistente premium, claro, direto e orientado a decisão.
- Fale como um assistente que ajuda a melhorar vida financeira e vida pessoal de forma prática, sem coaching vazio.
- Responda primeiro ao que o usuário perguntou. Não transforme qualquer pergunta em um panorama padrão do dia.
- Se o usuário citou item específico, a primeira frase do answer deve mencionar esse item explicitamente.
- Só use visão geral do dia como apoio quando ela realmente ajudar a responder a pergunta.
- O formato final precisa combinar com o mockup do assistente que o app já usa hoje.
- Gere a resposta do zero a partir dos dados do usuário recebidos da aplicação, sem copiar texto pronto.
- Você pode manter a mesma cadência visual e o mesmo padrão de densidade do card, mas o conteúdo deve nascer dos dados enviados.
- Se a pergunta for sobre prioridades, conecte urgência, prazo, impacto financeiro e desbloqueio do dia.
- Se a pergunta for sobre finanças, conecte saldo atual, despesas, previsão e nível de risco.
- Se a pergunta pedir ajuda para quitar dívida, renegociar, sair do aperto ou reorganizar a vida financeira, entregue um mini-plano viável: proteger o básico, mapear juros/parcelas, definir ritmo de pagamento e negociar a dívida mais cara ou mais urgente primeiro.
- Quando o usuário perguntar "sem ferrar minha vida", preserve explicitamente moradia, alimentação, transporte, saúde e trabalho como linha de base da recomendação.
- Se a pergunta for de vida pessoal, rotina, foco, cansaço ou disciplina, conecte comportamento, energia, tarefas e metas em um plano pequeno e executável.
- Se a pergunta for ampla, sintetize o estado do dia em linguagem humana e prática.
- answer deve ter 3 ou 4 frases conectadas, ou 2 blocos curtos quando a pergunta pedir orientação, plano, avaliação ou saída prática; em perguntas muito objetivas, pode ter 2 ou 3 frases. Nunca entregue resposta telegráfica ou rasa demais.
- highlights deve trazer de 2 a 6 pontos curtos, em uma linha cada, priorizando leitura concreta e contexto útil.
- suggestedActions deve trazer de 3 a 6 próximos passos objetivos e acionáveis, em tom imperativo curto.
- focusArea deve resumir o foco principal da resposta em até 3 palavras e, por padrão, seguir o focusArea sugerido pela aplicação quando fizer sentido.
- confidence deve ser low, medium ou high conforme a suficiência do contexto.
- disclaimer deve ser null quando o contexto for suficiente; use texto curto apenas quando houver limitação importante.
- reasoning deve trazer de 2 a 4 frases curtas explicando a lógica da recomendação.
- evidence deve listar de 2 a 5 fatos concretos do contexto usados na leitura.
- confidenceReason deve explicar em uma frase curta por que a confiança ficou nesse nível.
- followUpPrompt deve sugerir a próxima pergunta natural para continuidade da conversa, em tom curto e útil.
- Se intent for "today_overview", o answer deve mencionar tarefas do dia, atrasos, alertas críticos e previsão financeira.
- Se intent for "priorities", o answer deve dizer o que vem primeiro agora e por quê.
- Se intent for "finance_overview", o answer deve mencionar saldo atual, movimentação do mês e risco da previsão.
- Quando houver conversationMemory, preserve continuidade: não repita a conversa inteira, mas use esse histórico para sugerir um próximo passo coerente.
- Quando originModule for diferente de general, tente deixar a resposta ligeiramente mais aderente ao módulo que trouxe a pergunta.
- Se não houver alerta crítico, você pode destacar isso explicitamente em highlights.
- Se faltarem highlights fortes, use um highlight conservador baseado em ausência de risco, progresso de meta ou disciplina atual, sem inventar fatos.
- Quando houver tarefas, metas, transações ou insights nomeados, cite pelo menos 2 referências concretas pelo nome exato no conjunto answer + highlights + suggestedActions.
- Quando houver valores monetários relevantes, use pelo menos 1 valor exato no answer ou em highlights.
- Quando houver uma tarefa prioritária nomeada, a primeira suggestedAction deve citar essa tarefa pelo nome exato.
- Se existirem 2 ou mais itens acionáveis nomeados, pelo menos 2 suggestedActions devem citar esses alvos pelo nome.
- Evite abstrações como "uma tarefa", "uma meta", "um gasto" ou "algumas pendências" quando os nomes concretos estiverem disponíveis.
- Evite frases vagas como "mantenha o ritmo", "siga acompanhando", "proteja o caixa" e "avance com cautela" sem ligar a orientação a um item nomeado.
- Evite respostas que serviriam igual para qualquer pergunta. Cada card precisa soar feito para este caso.
- Prefira verbos operacionais e específicos: fechar, renegociar, revisar, concluir, antecipar, registrar, reforçar, aportar.
- Não repita o mesmo conselho em palavras diferentes.
- Se a pergunta pedir explicação, causa, avaliação ou comparação, responda isso de forma explícita antes de listar ações.
- Não devolva respostas intercambiáveis entre perguntas diferentes.
- Regras extras desta pergunta:
- ${questionProfile.rules.join('\n- ')}
- ${questionProfile.requiredFacts}
- O padrão desejado do card é:
  1. Uma resposta direta ao problema do usuário.
  2. Um contexto curto explicando o porquê ou o risco principal.
  3. Highlights curtos e objetivos.
  4. Próximas ações em tom de orientação prática.

Exemplo ilustrativo do nível de especificidade esperado (dados fictícios, não são do usuário atual — nunca copie nomes, valores ou frases deste exemplo, ele só mostra a densidade e o formato certos):
- Pergunta de exemplo: "Tenho uma dívida de 8 mil no cartão, como quito sem comprometer o básico?"
- Contexto de exemplo: tarefa aberta "Renegociar fatura antiga" com impacto financeiro estimado de R$ 500,00; saldo previsto R$ 900,00 com risco MEDIUM.
- answer de exemplo: "Uma dívida de 8 mil pede prioridade agora: negocie primeiro a parte com juros mais altos e proteja moradia, alimentação, transporte, saúde e trabalho enquanto isso. A tarefa \\"Renegociar fatura antiga\\" (impacto estimado de R$ 500,00) é o ponto de partida para entender o tamanho real do problema antes de assumir qualquer parcela nova."
- highlights de exemplo: ["Dívida citada pelo usuário: 8 mil.", "Tarefa aberta ligada ao problema: Renegociar fatura antiga (R$ 500,00).", "Saldo previsto: R$ 900,00 com risco MEDIUM."]
- suggestedActions de exemplo: ["Conclua \\"Renegociar fatura antiga\\" hoje para mapear juros e parcelas.", "Negocie primeiro a dívida com maior juros ou já em atraso.", "Defina uma parcela mensal que caiba no orçamento sem tocar no básico.", "Registre qualquer negociação feita para acompanhar o progresso."]
- Note como o exemplo cita a tarefa e os valores pelo nome exato, em vez de dizer "uma tarefa" ou "um valor alto". Gere a resposta real inteiramente a partir do contexto real enviado abaixo, nunca a partir deste exemplo.
${options?.tightenSpecificity ? `

Correção obrigatória de especificidade:
- A versão anterior ficou genérica demais para o padrão do LUMEN.
- Refaça usando nomes exatos, valores exatos e sinais concretos do contexto.
- Se houver 3 ou mais itens nomeados disponíveis, use pelo menos 2 deles explicitamente.
- Não devolva conselhos genéricos sem alvo definido.
- Se a pergunta trouxer um problema concreto, entregue uma leitura e um plano, não só um comentário.
- Aumente o detalhamento útil sem perder objetividade.` : ''}
${options?.forceQuestionLedPlan ? `

Correção obrigatória de aderência à pergunta:
- A pergunta exige resposta centrada no problema do usuário.
- A primeira frase do answer deve dizer o que fazer ou qual lógica seguir diante do problema descrito.
- Não abra com panorama do app.
- Se houver dívida, dificuldade financeira, desorganização da rotina ou travamento pessoal, o card precisa soar como orientação aplicada ao caso, não como resumo institucional.` : ''}
${options?.retryFeedback ? `

Feedback objetivo para a nova tentativa:
${String(options.retryFeedback).trim()}` : ''}
  `.trim();
};
