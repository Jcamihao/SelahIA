import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AgilisWorkspaceAiService } from './workspace-ai.service';
import {
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
import { sanitizeFreeText } from './workspace-ai.sanitize';
import {
  validateAgilisActionPlan,
  validateAgilisBottlenecks,
  validateAgilisRedistribution,
  validateAgilisStrategicBrief,
  validateAgilisSummary,
} from './workspace-ai.schemas';
import { AgilisChatDto, AgilisSuggestAssigneeDto } from './dto/agilis-workspace.dto';

const workspace = {
  totalTasks: 40,
  overdueTasks: 8,
  completedTasks: 20,
  backlogCount: 12,
  activeProjects: 5,
  teamCount: 3,
  topOverdueUsers: [
    { name: 'Ana', count: 4 },
    { name: 'Bruno', count: 2 },
  ],
};

const createService = (structuredData: unknown = {}, chatText = '  resposta do chat  ') => {
  const generate = jest.fn(async (input: any) => ({
    data: input.validate(structuredData),
    model: 'test-model',
  }));
  const generateTextFromContents = jest
    .fn()
    .mockResolvedValue({ text: chatText, model: 'test-model' });
  const service = new AgilisWorkspaceAiService(
    { generate } as any,
    { generateTextFromContents } as any,
    { getRequestId: () => 'req-1' } as any,
  );
  return { service, generate, generateTextFromContents };
};

describe('AgilisWorkspaceAiService', () => {
  it('chat sends the history in provider roles and the workspace context as system instruction', async () => {
    const { service, generateTextFromContents } = createService();

    const result = await service.chat({
      message: 'Como estamos?',
      history: [
        { role: 'user', content: 'Oi' },
        { role: 'assistant', content: 'Olá!' },
      ],
      workspace,
    });

    const call = generateTextFromContents.mock.calls[0][0];
    expect(call.contents.map((c: any) => c.role)).toEqual(['user', 'model', 'user']);
    expect(call.contents[2].parts[0].text).toBe('Como estamos?');
    expect(call.systemInstruction).toContain('Total de tarefas: 40');
    expect(result.answer).toBe('resposta do chat');
    expect(result.provider).toBe('gemini-developer-api');
  });

  it('summarizes a project and a task into a plain summary string', async () => {
    const { service } = createService({ summary: 'Projeto no prazo.' });

    expect(
      (await service.summarizeProject({ projectName: 'Site', totalTasks: 10, doneTasks: 5, overdueTasks: 1 })).summary,
    ).toBe('Projeto no prazo.');
    expect(
      (await service.summarizeTask({ title: 'Login', status: 'DOING', priority: 'HIGH' })).summary,
    ).toBe('Projeto no prazo.');
  });

  it('returns the structured action plan, bottlenecks and brief', async () => {
    const plan = {
      immediatePriorities: ['Fechar login'],
      nextSteps: ['Testar'],
      risks: ['Prazo'],
      recommendations: ['Priorizar'],
    };
    expect(
      (await createService(plan).service.generateActionPlan({ projectName: 'Site', tasks: [] })).plan,
    ).toEqual(plan);

    const bottlenecks = {
      overview: 'Fluxo travado em revisão.',
      bottlenecks: [{ title: 'Revisão', cause: 'Poucos revisores', correctiveAction: 'Dividir revisões' }],
    };
    expect(
      (await createService(bottlenecks).service.identifyBottlenecks({ workspace, stagnantTasks: [] })).analysis,
    ).toEqual(bottlenecks);

    const brief = {
      summary: 'Operação estável.',
      risks: ['Atrasos'],
      opportunities: ['Automação'],
      recommendations: ['Reduzir backlog'],
    };
    const metrics = {
      totalTasks: 40, doneTasks: 20, overdueTasks: 8, backlogTasks: 12,
      activeProjects: 5, members: 6, completionRate: 50, weeklyVelocity: 7,
    };
    expect((await createService(brief).service.generateStrategicBrief({ metrics })).brief).toEqual(brief);
  });

  it('drops assignee suggestions that are not in the member list and restores the canonical name', async () => {
    const { service } = createService({
      suggestions: [
        { name: 'joão  ', reason: 'Menor carga.' },
        { name: 'Pessoa Inventada', reason: 'Alucinação.' },
      ],
    });

    const result = await service.suggestAssignee({
      taskTitle: 'Login',
      taskPriority: 'HIGH',
      members: [
        { name: 'João', pendingTasks: 1 },
        { name: 'Maria', pendingTasks: 5 },
      ],
    });

    expect(result.suggestions).toEqual([{ name: 'João', reason: 'Menor carga.' }]);
  });

  it('rejects invalid structured payloads instead of returning partial data', async () => {
    await expect(
      createService({ immediatePriorities: [] }).service.generateActionPlan({ projectName: 'X', tasks: [] }),
    ).rejects.toThrow('immediatePriorities');
    await expect(
      createService({ summary: '' }).service.summarizeProject({ projectName: 'X', totalTasks: 0, doneTasks: 0, overdueTasks: 0 }),
    ).rejects.toThrow('summary');
  });
});

describe('AgilisWorkspaceAiService.suggestRedistribution', () => {
  const input = {
    overloaded: [{ name: 'Ana', openTasks: 6, overdueTasks: 3, capacityScore: 92 }],
    available: [{ name: 'Carla', openTasks: 1, overdueTasks: 0, capacityScore: 20 }],
  };

  it('keeps only moves from an overloaded member to an available one and never moves more than the person has', async () => {
    const { service } = createService({
      overview: 'Ana concentra a carga.',
      moves: [
        { from: 'ana', to: 'CARLA', tasksToMove: 40, reason: 'Ana está sobrecarregada.' },
        { from: 'Carla', to: 'Ana', tasksToMove: 1, reason: 'Sentido invertido.' },
        { from: 'Ana', to: 'Pessoa Inventada', tasksToMove: 1, reason: 'Nome inventado.' },
      ],
    });

    const result = await service.suggestRedistribution(input);

    expect(result.redistribution.overview).toBe('Ana concentra a carga.');
    expect(result.redistribution.moves).toEqual([
      { from: 'Ana', to: 'Carla', tasksToMove: 6, reason: 'Ana está sobrecarregada.' },
    ]);
  });

  it('accepts an empty list of moves when nobody has spare capacity', async () => {
    const { service } = createService({ overview: 'Toda a equipe está no limite.', moves: [] });

    const result = await service.suggestRedistribution({ ...input, available: [] });

    expect(result.redistribution.moves).toEqual([]);
  });

  it('prompt lists both groups, states the constraints and handles nobody available', () => {
    const prompt = buildAgilisRedistributionPrompt(input);
    expect(prompt).toContain('produto Agilis');
    expect(prompt).toContain('- Ana: 6 tarefas abertas, 3 atrasadas, carga 92/100');
    expect(prompt).toContain('- Carla: 1 tarefas abertas, 0 atrasadas, carga 20/100');
    expect(prompt).toContain('exatamente um nome da lista de sobrecarregados');
    expect(buildAgilisRedistributionPrompt({ ...input, available: [] })).toContain('Ninguém com folga no momento.');
  });

  it('validator requires an overview and floors tasksToMove at 1', () => {
    expect(() => validateAgilisRedistribution({ moves: [] })).toThrow('overview');
    expect(
      validateAgilisRedistribution({
        overview: 'x',
        moves: [{ from: 'A', to: 'B', tasksToMove: 0, reason: 'r' }],
      }).moves[0].tasksToMove,
    ).toBe(1);
  });
});

describe('agilis schemas', () => {
  it('bottlenecks may be empty but the overview is required', () => {
    expect(validateAgilisBottlenecks({ overview: 'Tudo certo.', bottlenecks: [] }).bottlenecks).toEqual([]);
    expect(() => validateAgilisBottlenecks({ bottlenecks: [] })).toThrow('overview');
  });

  it('caps list sizes and trims text', () => {
    const plan = validateAgilisActionPlan({
      immediatePriorities: ['a', 'b', 'c', 'd', 'e', 'f', 'g', ' '],
      nextSteps: [],
      risks: [],
      recommendations: [],
    });
    expect(plan.immediatePriorities).toHaveLength(6);
    expect(validateAgilisSummary({ summary: '  ok  ' }).summary).toBe('ok');
  });

  it('brief requires risks and recommendations', () => {
    expect(() =>
      validateAgilisStrategicBrief({ summary: 'x', risks: [], opportunities: [], recommendations: ['a'] }),
    ).toThrow('risks');
    expect(() => validateAgilisStrategicBrief(null)).toThrow();
  });
});

describe('agilis prompts', () => {
  it('chat system instruction carries the real numbers and the completion rate', () => {
    const prompt = buildAgilisChatSystemInstruction(workspace);

    expect(prompt).toContain('assistente de IA do Agilis');
    expect(prompt).toContain('Tarefas atrasadas: 8');
    expect(prompt).toContain('Taxa de conclusão: 50%');
    expect(prompt).toContain('Ana (4), Bruno (2)');
    expect(buildAgilisChatSystemInstruction({ ...workspace, totalTasks: 0, topOverdueUsers: [] })).toContain(
      'Taxa de conclusão: 0%',
    );
  });

  it('chat contents end with the new user message', () => {
    const contents = buildAgilisChatContents({ message: 'Oi', workspace } as AgilisChatDto);
    expect(contents).toEqual([{ role: 'user', parts: [{ text: 'Oi' }] }]);
  });

  it('project and task prompts state the facts and never invent data', () => {
    const project = buildAgilisProjectSummaryPrompt({
      projectName: 'Site', totalTasks: 10, doneTasks: 5, overdueTasks: 2, overdueTaskTitles: ['Login'],
    });
    expect(project).toContain('produto Agilis');
    expect(project).toContain('5 concluídas (50%)');
    expect(project).toContain('Atrasadas em destaque: Login');

    const task = buildAgilisTaskSummaryPrompt({ title: 'Login', status: 'DOING', priority: 'HIGH' });
    expect(task).toContain('Sem responsável');
    expect(task).toContain('Sem comentários.');
  });

  it('masks emails, phones and documents in task comments before they reach the model', () => {
    const prompt = buildAgilisTaskSummaryPrompt({
      title: 'Cobrança', status: 'DOING', priority: 'HIGH',
      comments: [{ authorName: 'Ana', content: 'Ligar 11 98888-7777 ou joao@empresa.com, CPF 123.456.789-09' }],
    });

    expect(prompt).toContain('[telefone removido]');
    expect(prompt).toContain('[e-mail removido]');
    expect(prompt).toContain('[cpf removido]');
    expect(prompt).not.toContain('joao@empresa.com');
    expect(prompt).not.toContain('98888-7777');
  });

  it('action plan, bottleneck and assignee prompts list the given data', () => {
    expect(buildAgilisActionPlanPrompt({ projectName: 'Site', tasks: [] })).toContain('Nenhuma tarefa pendente.');
    expect(
      buildAgilisActionPlanPrompt({
        projectName: 'Site',
        tasks: [{ title: 'Login', priority: 'HIGH', assigneeName: 'Ana', dueDateLabel: '25/09/2026' }],
      }),
    ).toContain('- Login [HIGH] (@Ana) vence: 25/09/2026');

    const bottlenecks = buildAgilisBottlenecksPrompt({
      workspace,
      stagnantTasks: [{ title: 'Deploy', status: 'IN_REVIEW', projectName: 'Site', assigneeName: 'Bruno' }],
    });
    expect(bottlenecks).toContain('8 de 40');
    expect(bottlenecks).toContain('"Deploy" [IN_REVIEW] em Site (@Bruno)');

    const assignee = buildAgilisSuggestAssigneePrompt({
      taskTitle: 'Login', taskPriority: 'HIGH', members: [{ name: 'João', pendingTasks: 1 }],
    });
    expect(assignee).toContain('- João: 1 tarefas pendentes');
    expect(assignee).toContain('exatamente um dos nomes');
  });

  it('strategic brief prompt includes the metrics and a fallback when there are no insights', () => {
    const prompt = buildAgilisStrategicBriefPrompt({
      metrics: {
        totalTasks: 40, doneTasks: 20, overdueTasks: 8, backlogTasks: 12,
        activeProjects: 5, members: 6, completionRate: 50, weeklyVelocity: 7,
      },
    });

    expect(prompt).toContain('Velocidade semanal: 7 tarefas/semana');
    expect(prompt).toContain('Nenhum insight crítico no momento.');
  });
});

describe('sanitizeFreeText', () => {
  it('masks CNPJ before CPF and collapses whitespace', () => {
    expect(sanitizeFreeText('CNPJ 12.345.678/0001-99   ok')).toBe('CNPJ [cnpj removido] ok');
    expect(sanitizeFreeText('  a\n\nb  ')).toBe('a b');
  });

  it('truncates long text', () => {
    expect(sanitizeFreeText('x'.repeat(500), 50)).toHaveLength(50);
  });
});

describe('agilis DTOs', () => {
  it('reject negative counts and unknown chat roles', async () => {
    const chat = plainToInstance(AgilisChatDto, {
      message: 'oi',
      history: [{ role: 'system', content: 'x' }],
      workspace: { ...workspace, totalTasks: -1 },
    });
    expect((await validate(chat)).length).toBeGreaterThan(0);

    const assignee = plainToInstance(AgilisSuggestAssigneeDto, {
      taskTitle: 't', taskPriority: 'HIGH', members: [{ name: 'A', pendingTasks: 0 }],
    });
    expect(await validate(assignee)).toHaveLength(0);
  });
});
