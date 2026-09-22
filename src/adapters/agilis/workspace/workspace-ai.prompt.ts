import {
  AgilisActionPlanDto,
  AgilisBottlenecksDto,
  AgilisChatDto,
  AgilisProjectSummaryDto,
  AgilisStrategicBriefDto,
  AgilisSuggestAssigneeDto,
  AgilisTaskSummaryDto,
  AgilisWorkloadRedistributionDto,
  AgilisWorkspaceContextDto,
} from './dto/agilis-workspace.dto';
import { sanitizeFreeText } from './workspace-ai.sanitize';

const percent = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

const overdueUsersLine = (workspace: AgilisWorkspaceContextDto) =>
  workspace.topOverdueUsers.length
    ? workspace.topOverdueUsers.map((user) => `${user.name} (${user.count})`).join(', ')
    : 'nenhum';

export const AGILIS_ANALYST_SYSTEM_INSTRUCTION =
  'Você é Selah IA, analista de gestão operacional do Agilis. Responda em português do Brasil, em JSON válido e sem markdown. Baseie-se exclusivamente nos dados fornecidos e nunca invente números, nomes ou prazos.';

export const buildAgilisChatSystemInstruction = (
  workspace: AgilisWorkspaceContextDto,
) =>
  `
Você é Selah IA, o assistente de IA do Agilis, uma plataforma de gestão operacional.

CONTEXTO DO WORKSPACE (dados em tempo real):
- Total de tarefas: ${workspace.totalTasks}
- Tarefas atrasadas: ${workspace.overdueTasks}
- Tarefas concluídas: ${workspace.completedTasks}
- Tarefas em backlog: ${workspace.backlogCount}
- Projetos ativos: ${workspace.activeProjects}
- Equipes: ${workspace.teamCount}
- Taxa de conclusão: ${percent(workspace.completedTasks, workspace.totalTasks)}%
- Usuários com mais atrasos: ${overdueUsersLine(workspace)}

REGRAS:
- Responda sempre em português do Brasil.
- Seja direto, objetivo e útil.
- Use os dados reais do contexto nas respostas e não invente números.
- Se a pergunta pedir algo que o contexto não cobre, diga o que falta em vez de supor.
- Escreva em texto simples, com listas de marcadores quando ajudar; sem markdown pesado.
`.trim();

export const buildAgilisChatContents = (input: AgilisChatDto) => [
  ...(input.history || []).map((turn) => ({
    role: turn.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: turn.content }],
  })),
  { role: 'user', parts: [{ text: input.message }] },
];

export const buildAgilisProjectSummaryPrompt = (input: AgilisProjectSummaryDto) =>
  `
Contexto: produto Agilis, resumo executivo de um projeto.

Projeto: "${input.projectName}"
- ${input.totalTasks} tarefas no total, ${input.doneTasks} concluídas (${percent(input.doneTasks, input.totalTasks)}%)
- ${input.overdueTasks} tarefas atrasadas
${input.overdueTaskTitles?.length ? `- Atrasadas em destaque: ${input.overdueTaskTitles.join(', ')}` : '- Nenhuma tarefa atrasada em destaque.'}

Instruções:
- Resuma o projeto em 3 a 4 frases executivas, citando progresso e atrasos.
- Não invente informações além das acima.
`.trim();

export const buildAgilisTaskSummaryPrompt = (input: AgilisTaskSummaryDto) => {
  const comments = (input.comments || []).length
    ? (input.comments || [])
        .map((comment) => `${comment.authorName}: ${sanitizeFreeText(comment.content, 200)}`)
        .join('\n')
    : 'Sem comentários.';

  return `
Contexto: produto Agilis, resumo de uma tarefa.

Título: ${input.title} | Status: ${input.status} | Prioridade: ${input.priority}
Responsável: ${input.assigneeName || 'Sem responsável'}
Comentários recentes:
${comments}

Instruções:
- Resuma a tarefa em 2 a 3 frases: situação atual e o que falta para avançar.
- Não invente informações além das acima.
`.trim();
};

export const buildAgilisActionPlanPrompt = (input: AgilisActionPlanDto) => {
  const tasks = input.tasks.length
    ? input.tasks
        .map(
          (task) =>
            `- ${task.title} [${task.priority}]${task.assigneeName ? ` (@${task.assigneeName})` : ''}${task.dueDateLabel ? ` vence: ${task.dueDateLabel}` : ''}`,
        )
        .join('\n')
    : '- Nenhuma tarefa pendente.';

  return `
Contexto: produto Agilis, plano de ação para um projeto.

Projeto: "${input.projectName}"
Tarefas pendentes (mais prioritárias primeiro):
${tasks}

Instruções:
- immediatePriorities: o que fazer nesta semana, em ordem de importância.
- nextSteps: o que fazer nas próximas 2 semanas.
- risks: riscos que os dados acima realmente indicam (prazos, tarefas sem responsável, concentração de carga).
- recommendations: ações objetivas para a liderança.
- Cite tarefas e pessoas pelo nome quando fizer sentido. Cada item deve ser uma frase curta.
`.trim();
};

export const buildAgilisBottlenecksPrompt = (input: AgilisBottlenecksDto) => {
  const stagnant = input.stagnantTasks.length
    ? input.stagnantTasks
        .map(
          (task) =>
            `- "${task.title}" [${task.status}] em ${task.projectName}${task.assigneeName ? ` (@${task.assigneeName})` : ''}`,
        )
        .join('\n')
    : 'Nenhuma.';

  return `
Contexto: produto Agilis, identificação de gargalos operacionais.

- Tarefas atrasadas: ${input.workspace.overdueTasks} de ${input.workspace.totalTasks}
- Responsáveis com mais atrasos: ${overdueUsersLine(input.workspace)}
- Tarefas paradas há mais de 7 dias em andamento ou revisão:
${stagnant}

Instruções:
- overview: uma frase sobre a saúde geral do fluxo.
- bottlenecks: até 3 gargalos principais, cada um com título, causa provável e ação corretiva concreta.
- Se os dados não indicarem gargalo real, devolva a lista vazia em vez de inventar.
`.trim();
};

export const buildAgilisSuggestAssigneePrompt = (input: AgilisSuggestAssigneeDto) =>
  `
Contexto: produto Agilis, escolha do responsável por uma tarefa.

Tarefa: "${input.taskTitle}" [${input.taskPriority}]
Carga atual da equipe:
${input.members.map((member) => `- ${member.name}: ${member.pendingTasks} tarefas pendentes`).join('\n')}

Instruções:
- Sugira 1 ou 2 pessoas, priorizando quem tem menos tarefas pendentes.
- "name" deve ser exatamente um dos nomes da lista acima.
- Em "reason", justifique com a carga de trabalho informada.
`.trim();

export const buildAgilisStrategicBriefPrompt = (input: AgilisStrategicBriefDto) => {
  const { metrics } = input;
  const insights = (input.insights || []).length
    ? (input.insights || [])
        .map((insight) => `[${insight.severity}] ${insight.title}: ${sanitizeFreeText(insight.description, 300)}`)
        .join('\n')
    : 'Nenhum insight crítico no momento.';

  return `
Contexto: produto Agilis, brief estratégico executivo para a liderança.

MÉTRICAS:
- Total de tarefas: ${metrics.totalTasks} | Concluídas: ${metrics.doneTasks} (${metrics.completionRate}%)
- Tarefas atrasadas: ${metrics.overdueTasks} | Em backlog: ${metrics.backlogTasks}
- Projetos ativos: ${metrics.activeProjects} | Membros: ${metrics.members}
- Velocidade semanal: ${metrics.weeklyVelocity} tarefas/semana (últimos 30 dias)

INSIGHTS AUTOMÁTICOS:
${insights}

Instruções:
- summary: 2 a 3 frases sobre o estado geral da operação.
- risks: 3 riscos concretos baseados nos dados.
- opportunities: 2 a 3 oportunidades de melhoria.
- recommendations: 3 a 4 ações prioritárias com impacto esperado.
- Tom de consultor sênior, direto e sem jargão.
`.trim();
};

export const buildAgilisRedistributionPrompt = (input: AgilisWorkloadRedistributionDto) => {
  const overloaded = input.overloaded
    .map((member) => `- ${member.name}: ${member.openTasks} tarefas abertas, ${member.overdueTasks} atrasadas, carga ${member.capacityScore}/100`)
    .join('\n');
  const available = input.available.length
    ? input.available
        .map((member) => `- ${member.name}: ${member.openTasks} tarefas abertas, ${member.overdueTasks} atrasadas, carga ${member.capacityScore}/100`)
        .join('\n')
    : 'Ninguém com folga no momento.';

  return `
Contexto: produto Agilis, redistribuição de tarefas entre membros da equipe.

Membros sobrecarregados:
${overloaded}

Membros com folga:
${available}

Instruções:
- overview: 1 a 2 frases sobre o desequilíbrio de carga.
- moves: até 5 movimentações, cada uma com de quem sai ("from"), para quem vai ("to"), quantas tarefas ("tasksToMove") e o motivo.
- "from" deve ser exatamente um nome da lista de sobrecarregados e "to" exatamente um nome da lista com folga.
- Não mova mais tarefas do que a pessoa tem abertas e priorize aliviar quem tem tarefas atrasadas.
- Se ninguém tem folga, devolva moves vazio e explique no overview.
`.trim();
};

