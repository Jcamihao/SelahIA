import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);
import { RequestContextService } from '../../common/logging/request-context.service';
import {
  SELAH_CODER_TOOLS,
  SelahCoderMessage,
  SelahCoderOllamaClient,
} from './selah-coder-ollama.client';
import { DiffLine, SelahCoderToolExecutorService } from './selah-coder-tool-executor.service';
import { RunSelahCoderAgentDto } from './dto/run-selah-coder-agent.dto';

const DEFAULT_MODEL = 'qwen2.5-coder:7b';
const DEFAULT_MAX_ITERATIONS = 150;

export type SelahCoderToolCallLog = {
  iteration: number;
  tool: string;
  args: Record<string, unknown>;
  resultPreview: string;
};

export type SelahCoderAgentResult = {
  provider: string;
  model: string;
  generatedAt: string;
  task: string;
  workingDirectory: string;
  status: 'done' | 'max_iterations_reached' | 'cancelled';
  iterations: number;
  toolCallsLog: SelahCoderToolCallLog[];
  result: string;
};

export type AgentStreamEvent =
  | { type: 'thinking'; iteration: number }
  | { type: 'stream_token'; content: string }
  | { type: 'tool_call'; iteration: number; tool: string; args: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; result: string; diff?: DiffLine[]; isNewFile?: boolean; filePath?: string }
  | { type: 'context'; files: string[] }
  | { type: 'snapshot'; hash: string; files: number }
  | { type: 'approval_required'; id: string; command: string }
  | { type: 'decomposed'; subtasks: string[] }
  | { type: 'subtask_start'; index: number; total: number; task: string }
  | { type: 'subtask_done'; index: number; total: number; task: string }
  | { type: 'done'; result: string; iterations: number; status: string; model: string; messages: SelahCoderMessage[]; promptTokens: number; evalTokens: number }
  | { type: 'error'; message: string };

type EventEmitter = (event: AgentStreamEvent) => void;

@Injectable()
export class SelahCoderAgentService {
  private readonly logger = new Logger(SelahCoderAgentService.name);
  /** Pending approval callbacks keyed by approval ID */
  private readonly approvalRequests = new Map<string, (approved: boolean) => void>();

  constructor(
    private readonly ollamaClient: SelahCoderOllamaClient,
    private readonly toolExecutor: SelahCoderToolExecutorService,
    private readonly requestContext: RequestContextService,
  ) {}

  /** Called by the controller when the user clicks approve/reject */
  resolveApproval(id: string, approved: boolean): void {
    const cb = this.approvalRequests.get(id);
    if (cb) { cb(approved); this.approvalRequests.delete(id); }
  }

  private waitForApproval(id: string, onEvent: EventEmitter, command: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        this.approvalRequests.delete(id);
        onEvent({ type: 'error', message: `Aprovação expirou para: ${command.slice(0, 80)}` });
        resolve(false);
      }, 60_000);

      this.approvalRequests.set(id, (approved: boolean) => {
        clearTimeout(timeout);
        resolve(approved);
      });

      onEvent({ type: 'approval_required', id, command });
    });
  }

  private isDangerous(command: string): boolean {
    return [
      /\brm\s+(-[rf]+\s+|.*\s+-[rf])/i,
      /\bgit\s+reset\s+--hard\b/i,
      /\bgit\s+clean\s+-f/i,
      /\bdrop\s+(table|database|schema)\b/i,
      /\bdelete\s+from\b/i,
      /\btruncate\s+table\b/i,
      /\brmdir\s+/i,
      /\bchmod\s+[0-9]*7[0-9]*/i,
    ].some((p) => p.test(command));
  }

  run(dto: RunSelahCoderAgentDto): Promise<SelahCoderAgentResult> {
    return this.execute(dto, () => {});
  }

  runStream(dto: RunSelahCoderAgentDto, onEvent: EventEmitter, shouldCancel?: () => boolean): Promise<SelahCoderAgentResult> {
    return this.execute(dto, onEvent, { shouldCancel });
  }

  async decomposeAndRun(dto: RunSelahCoderAgentDto, onEvent: EventEmitter, shouldCancel?: () => boolean): Promise<void> {
    const requestId = this.requestContext.getRequestId();
    const model = String(dto.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
    const workingDir = this.resolveWorkingDir(dto.workingDirectory);

    // Ensure working directory exists before starting
    await fs.mkdir(workingDir, { recursive: true });

    // Gather context once — shared across all subtasks
    const { context: projectContext, files: contextFiles } =
      await this.gatherProjectContext(workingDir, dto.task);
    if (contextFiles.length > 0) {
      onEvent({ type: 'context', files: contextFiles });
    }

    // Decompose the task
    onEvent({ type: 'thinking', iteration: 0 });
    this.logger.log(`[${requestId}] Decomposing task with model=${model}`);
    const subtasks = await this.ollamaClient.decompose(model, dto.task, projectContext);
    onEvent({ type: 'decomposed', subtasks });
    this.logger.log(`[${requestId}] Decomposed into ${subtasks.length} subtasks`);

    // Execute each subtask sequentially, injecting position context so the model
    // knows what was already done and what is still pending.
    for (let i = 0; i < subtasks.length; i++) {
      onEvent({ type: 'subtask_start', index: i, total: subtasks.length, task: subtasks[i] });

      const done    = subtasks.slice(0, i);
      const pending = subtasks.slice(i + 1);

      // Force the model to act with tools immediately instead of describing.
      const taskDirective =
        `SUBTASK ${i + 1} OF ${subtasks.length} — EXECUTE WITH TOOLS NOW.\n` +
        `Do NOT describe what you will do. Call a tool immediately.\n` +
        (done.length    ? `Already completed: ${done.join(' | ')}\n`    : '') +
        (pending.length ? `Still pending after this: ${pending.join(' | ')}\n` : '') +
        `\nTask: ${subtasks[i]}`;

      const subDto: RunSelahCoderAgentDto = {
        ...dto,
        task: taskDirective,
      };

      try {
        if (shouldCancel?.()) break;
        await this.execute(subDto, onEvent, { emitContext: false, shouldCancel });
      } catch (err: any) {
        onEvent({ type: 'error', message: `Subtask ${i + 1} failed: ${err?.message}` });
      }

      onEvent({ type: 'subtask_done', index: i, total: subtasks.length, task: subtasks[i] });
    }
  }

  private async execute(
    dto: RunSelahCoderAgentDto,
    onEvent: EventEmitter,
    opts: { preContext?: string; emitContext?: boolean; shouldCancel?: () => boolean } = {},
  ): Promise<SelahCoderAgentResult> {
    const requestId = this.requestContext.getRequestId();
    const model = String(dto.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
    const maxIterations = Math.min(
      Number(dto.maxIterations || DEFAULT_MAX_ITERATIONS),
      150,
    );
    const workingDir = this.resolveWorkingDir(dto.workingDirectory);
    const [projectMemory, projectInstructions] = await Promise.all([
      this.readProjectMemory(workingDir),
      this.readProjectInstructions(workingDir),
    ]);

    // Use pre-gathered context (from decomposeAndRun) or gather fresh
    let projectContext = opts.preContext ?? null;
    let contextFiles: string[] = [];

    // Continuation: if the client sent previous session messages, resume from them.
    // Otherwise build fresh history.
    const isResume = Array.isArray(dto.messages) && dto.messages.length > 0;

    if (!isResume && !projectContext) {
      const gathered = await this.gatherProjectContext(workingDir, dto.task);
      projectContext = gathered.context;
      contextFiles = gathered.files;
    }

    this.logger.log(
      `[${requestId}] SelahCoderAgent started model=${model} maxIterations=${maxIterations} cwd=${workingDir} memory=${projectMemory ? 'loaded' : 'none'} resume=${isResume} contextFiles=${contextFiles.join(',')}`,
    );

    if (!isResume && (opts.emitContext ?? true) && contextFiles.length > 0) {
      onEvent({ type: 'context', files: contextFiles });
    }

    let messages: SelahCoderMessage[];

    // Git snapshot before execution (only for fresh tasks, not subtasks or resumes)
    if (!isResume && (opts.emitContext ?? true)) {
      await this.gitSnapshot(workingDir, dto.task, onEvent);
    }

    if (isResume) {
      // Resume: clone stored history, refresh system prompt with latest memory, append new task.
      messages = (dto.messages as SelahCoderMessage[]).map((m, i) =>
        i === 0 && m.role === 'system'
          ? { role: 'system' as const, content: this.buildSystemPrompt(workingDir, projectMemory, projectInstructions) }
          : m,
      );
      messages.push({ role: 'user', content: dto.task });
    } else {
      messages = [
        { role: 'system', content: this.buildSystemPrompt(workingDir, projectMemory, projectInstructions) },
      ];
      if (projectContext) {
        messages.push({ role: 'user', content: '[AUTO-CONTEXT] Project files read automatically before your task:' });
        messages.push({ role: 'assistant', content: projectContext });
      }
      messages.push({ role: 'user', content: dto.task });
    }

    const toolCallsLog: SelahCoderToolCallLog[] = [];
    let iteration = 0;
    let finalResult = '';
    let status: SelahCoderAgentResult['status'] = 'done';
    let totalToolCallsMade = 0;
    let totalPromptTokens = 0;
    let totalEvalTokens = 0;

    while (iteration < maxIterations) {
      // Check cancellation at the top of each iteration
      if (opts.shouldCancel?.()) {
        status = 'max_iterations_reached';
        finalResult = 'Tarefa interrompida pelo usuário.';
        break;
      }

      iteration++;

      this.pruneMessages(messages);

      onEvent({ type: 'thinking', iteration });

      // Stream tokens to UI as the model generates them
      const response = await this.ollamaClient.chat(
        model,
        messages,
        SELAH_CODER_TOOLS,
        (token) => onEvent({ type: 'stream_token', content: token }),
      );

      totalPromptTokens += response.promptTokens;
      totalEvalTokens   += response.evalTokens;

      this.logger.log(
        `[${requestId}] SelahCoderAgent iteration=${iteration} doneReason=${response.doneReason} toolCalls=${response.message.tool_calls?.length ?? 0} tokens(prompt=${response.promptTokens}, eval=${response.evalTokens})`,
      );

      messages.push(response.message);

      const toolCalls = response.message.tool_calls;
      const content   = response.message.content;

      // Empty response with no tool calls
      if (!toolCalls?.length && !content) {
        const nudgeCount = messages.filter(
          m => m.role === 'user' && m.content === 'Continue. What is the next step?'
        ).length;
        if (nudgeCount < 2) {
          messages.push({ role: 'user', content: 'Continue. What is the next step?' });
          continue;
        }
        finalResult = '';
        break;
      }

      if (!toolCalls || toolCalls.length === 0) {
        // Model responded with text only. If it never called a single tool, it is
        // describing instead of executing — force it to act.
        if (totalToolCallsMade === 0 && iteration <= 3) {
          this.logger.warn(
            `[${requestId}] Model responded with text but called no tools (iter=${iteration}) — forcing tool use`,
          );
          messages.push({
            role: 'user',
            content:
              'You described what to do but did not call any tools. ' +
              'You MUST call a tool RIGHT NOW to start working. ' +
              'Begin with list_dir to see the current state, then use write_file or run_bash to create files.',
          });
          continue;
        }
        finalResult = content;
        break;
      }

      if (iteration >= maxIterations) {
        status = 'max_iterations_reached';
        finalResult = response.message.content || 'Limite de iterações atingido.';
        break;
      }

      for (const tc of toolCalls) {
        const toolName = tc.function.name;
        const toolArgs = tc.function.arguments;

        this.logger.log(
          `[${requestId}] SelahCoderAgent tool=${toolName} args=${JSON.stringify(toolArgs).slice(0, 120)}`,
        );

        onEvent({ type: 'tool_call', iteration, tool: toolName, args: toolArgs });
        totalToolCallsMade++;

        // Approval gate for destructive bash commands
        if (toolName === 'run_bash' && this.isDangerous(String(toolArgs.command ?? ''))) {
          const approvalId = `ap-${Date.now()}`;
          const approved = await this.waitForApproval(approvalId, onEvent, String(toolArgs.command));
          if (!approved) {
            const rejected = { result: 'Comando rejeitado pelo usuário. Escolha uma abordagem diferente.' };
            onEvent({ type: 'tool_result', tool: toolName, result: rejected.result });
            messages.push({ role: 'tool', content: rejected.result });
            continue;
          }
        }

        const execResult = await this.toolExecutor.execute(toolName, toolArgs, workingDir);

        onEvent({
          type: 'tool_result',
          tool: toolName,
          result: execResult.result,
          diff: execResult.diff,
          isNewFile: execResult.isNewFile,
          filePath: execResult.filePath,
        });

        toolCallsLog.push({
          iteration,
          tool: toolName,
          args: toolArgs,
          resultPreview: execResult.result.slice(0, 300),
        });

        messages.push({ role: 'tool', content: execResult.result });
      }
    }

    this.logger.log(
      `[${requestId}] SelahCoderAgent completed status=${status} iterations=${iteration} toolCalls=${toolCallsLog.length}`,
    );

    const result: SelahCoderAgentResult = {
      provider: 'ollama',
      model,
      generatedAt: new Date().toISOString(),
      task: dto.task,
      workingDirectory: workingDir,
      status,
      iterations: iteration,
      toolCallsLog,
      result: finalResult,
    };

    onEvent({ type: 'done', result: finalResult, iterations: iteration, status, model, messages, promptTokens: totalPromptTokens, evalTokens: totalEvalTokens });

    return result;
  }

  /**
   * Keeps the conversation history from growing unboundedly.
   * Strategy: always preserve the first 4 messages (system, context user/assistant, task),
   * then keep only the most recent 12 messages. Old tool results (large file reads) are
   * discarded first since they're the main source of context bloat.
   */
  private pruneMessages(messages: SelahCoderMessage[]): void {
    const HEADER = 4;    // system + context user + context assistant + task
    const TAIL   = 12;   // recent exchanges to keep

    if (messages.length <= HEADER + TAIL) return;

    const header = messages.slice(0, HEADER);
    const tail   = messages.slice(-TAIL);

    messages.splice(0, messages.length, ...header, ...tail);
  }

  private resolveWorkingDir(workingDirectory?: string): string {
    if (!workingDirectory) return os.homedir();
    return path.isAbsolute(workingDirectory)
      ? workingDirectory
      : path.resolve(os.homedir(), workingDirectory);
  }

  private async gatherProjectContext(
    workingDir: string,
    task?: string,
  ): Promise<{ context: string; files: string[] }> {
    const sections: string[] = [];
    const files: string[] = [];

    // 1. Directory listing (always, skip heavy dirs)
    try {
      const entries = await fs.readdir(workingDir, { withFileTypes: true });
      const SKIP = new Set(['node_modules', '.git', 'dist', '.angular', 'coverage', '.next', 'build']);
      const lines = entries
        .filter((e) => !SKIP.has(e.name))
        .map((e) => (e.isDirectory() ? `[dir]  ${e.name}/` : `[file] ${e.name}`));
      if (lines.length) {
        sections.push(`## Project root (${workingDir})\n${lines.join('\n')}`);
        files.push('.');
      }
    } catch { /* workingDir may not exist yet */ }

    // 2. Anchor files — read if present, truncate large ones
    const ANCHORS: Array<{ rel: string; maxBytes: number }> = [
      { rel: 'package.json',              maxBytes: 3000 },
      { rel: 'prisma/schema.prisma',       maxBytes: 5000 },
      { rel: 'schema.prisma',              maxBytes: 5000 },
      { rel: 'src/app.module.ts',          maxBytes: 3000 },
      { rel: 'src/app/app.module.ts',      maxBytes: 3000 },
      { rel: 'angular.json',               maxBytes: 2000 },
      { rel: 'nest-cli.json',              maxBytes: 1000 },
      { rel: 'docker-compose.yml',         maxBytes: 2000 },
      { rel: 'docker-compose.yaml',        maxBytes: 2000 },
    ];

    for (const { rel, maxBytes } of ANCHORS) {
      const fullPath = path.join(workingDir, rel);
      try {
        const raw = await fs.readFile(fullPath, 'utf-8');
        const content = raw.length > maxBytes
          ? raw.slice(0, maxBytes) + `\n... [truncated — ${raw.length} chars total]`
          : raw;
        const ext = rel.split('.').pop() || '';
        sections.push(`## ${rel}\n\`\`\`${ext}\n${content}\n\`\`\``);
        files.push(rel);
      } catch { /* file doesn't exist — skip */ }
    }

    // Smart context: grep for files relevant to this task
    if (task) {
      const alreadyIncluded = new Set(files);
      const relevant = await this.findRelevantFiles(task, workingDir, alreadyIncluded);
      if (relevant.length > 0) {
        sections.push(`## Relevant files (auto-detected for this task)`);
        relevant.forEach(({ rel, content }) => {
          sections.push(content);
          files.push(rel);
        });
      }
    }

    return { context: sections.join('\n\n'), files };
  }

  /** Creates a git snapshot commit before the task starts so the user can rollback with git reset --hard HEAD~1 */
  private async gitSnapshot(workingDir: string, task: string, onEvent: EventEmitter): Promise<void> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: workingDir, timeout: 3000 });
      const { stdout: statusOut } = await execAsync('git status --porcelain', { cwd: workingDir, timeout: 3000 });
      if (!statusOut.trim()) return; // nothing to snapshot

      const shortTask = task.slice(0, 60).replace(/['"\\]/g, '');
      await execAsync(`git add -A && git commit -m "snapshot: ${shortTask}"`, {
        cwd: workingDir,
        timeout: 15_000,
      });
      const { stdout: hashOut } = await execAsync('git rev-parse --short HEAD', { cwd: workingDir, timeout: 3000 });
      const fileCount = statusOut.trim().split('\n').length;
      onEvent({ type: 'snapshot', hash: hashOut.trim(), files: fileCount });
    } catch {
      // Not a git repo or git unavailable — skip silently
    }
  }

  /** Reads .selah/instructions.md — project-specific immutable rules for the agent */
  private async readProjectInstructions(workingDir: string): Promise<string | null> {
    try {
      const content = await fs.readFile(path.join(workingDir, '.selah', 'instructions.md'), 'utf-8');
      return content.trim() || null;
    } catch {
      return null;
    }
  }

  /** Extracts identifiers from the task and greps the codebase to find relevant files */
  private async findRelevantFiles(task: string, workingDir: string, alreadyIncluded: Set<string>): Promise<Array<{ rel: string; content: string }>> {
    // Extract PascalCase identifiers and NestJS-suffixed names likely to appear in code
    const matches = task.match(/\b[A-Z][a-zA-Z0-9]*(?:Service|Controller|Module|Guard|Repository|Entity|Resolver|Interceptor|Pipe|Component|Store|DTO)?\b/g) || [];
    const keywords = [...new Set(matches)].filter((k) => k.length > 3).slice(0, 6);
    if (keywords.length === 0) return [];

    const foundFiles = new Set<string>();
    for (const kw of keywords) {
      try {
        const { stdout } = await execAsync(
          `grep -rl "${kw}" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.angular . 2>/dev/null | head -6`,
          { cwd: workingDir, timeout: 6000 },
        );
        stdout.trim().split('\n').filter(Boolean).forEach((f) => {
          const rel = f.replace(/^\.\//, '');
          if (!alreadyIncluded.has(rel)) foundFiles.add(rel);
        });
      } catch { /* grep found nothing */ }
    }

    const result: Array<{ rel: string; content: string }> = [];
    for (const rel of Array.from(foundFiles).slice(0, 5)) {
      try {
        const raw = await fs.readFile(path.join(workingDir, rel), 'utf-8');
        if (raw.length > 6000) continue; // skip very large files
        const ext = rel.split('.').pop() || '';
        result.push({ rel, content: `## ${rel}\n\`\`\`${ext}\n${raw}\n\`\`\`` });
      } catch { /* file vanished — skip */ }
    }
    return result;
  }

  private async readProjectMemory(workingDir: string): Promise<string | null> {
    const memoryPath = path.join(workingDir, '.selah', 'memory.md');
    try {
      const content = await fs.readFile(memoryPath, 'utf-8');
      return content.trim() || null;
    } catch {
      return null;
    }
  }

  private buildSystemPrompt(workingDir: string, memory: string | null, instructions: string | null = null): string {
    const memoryBlock = memory
      ? `\n════════════════════════════════════════
PROJECT MEMORY  (.selah/memory.md)
════════════════════════════════════════
${memory}
════════════════════════════════════════
Read the memory above carefully before acting. It contains the project stack,
conventions, what has already been built, and where things are located.
You MUST update .selah/memory.md at the end of every task (see instructions below).
════════════════════════════════════════\n`
      : `\n════════════════════════════════════════
PROJECT MEMORY
════════════════════════════════════════
No memory file found (.selah/memory.md does not exist yet).
After completing this task, create .selah/memory.md to record the project context.
════════════════════════════════════════\n`;

    const instructionsBlock = instructions
      ? `\n════════════════════════════════════════
PROJECT INSTRUCTIONS  (.selah/instructions.md)
════════════════════════════════════════
${instructions}
════════════════════════════════════════
These are IMMUTABLE project rules. Follow them always, even if they conflict with general conventions.
════════════════════════════════════════\n`
      : '';

    return `You are a senior software engineer with full access to the local filesystem, shell, and git. You write production-quality code in any language or framework.

Working directory: ${workingDir}
Date: ${new Date().toISOString().split('T')[0]}
${memoryBlock}${instructionsBlock}

════════════════════════════════════════
TOOLS
════════════════════════════════════════
- read_file(path)            — read a file's full content
- write_file(path, content)  — create or overwrite a file (creates parent dirs automatically)
- run_bash(command)          — execute any shell command (git, npm, tsc, grep, mkdir, etc.)
- list_dir(path?)            — list directory contents
- search_files(pattern, path?, filePattern?) — grep across files

════════════════════════════════════════
HOW TO CALL A TOOL
════════════════════════════════════════
Output ONLY a single raw JSON object. No explanation, no markdown, no extra text before or after:
{"name": "tool_name", "arguments": {"key": "value"}}

Examples:
{"name": "list_dir", "arguments": {}}
{"name": "read_file", "arguments": {"path": "src/app.module.ts"}}
{"name": "write_file", "arguments": {"path": "src/users/users.service.ts", "content": "import ..."}}
{"name": "run_bash", "arguments": {"command": "cd taskflow-api && npx prisma migrate dev --name init"}}
{"name": "run_bash", "arguments": {"command": "git add -A && git commit -m 'feat: add users module'"}}
{"name": "search_files", "arguments": {"pattern": "PrismaService", "filePattern": "*.ts"}}

════════════════════════════════════════
CODING RULES — APPLY TO ALL CODE
════════════════════════════════════════
1. Write COMPLETE files. Never truncate with comments like "// rest of code here" or "// ... existing code".
2. Use REAL, LITERAL names — never placeholders. FORBIDDEN: {name}, {src}, <Module>, [ClassName], YOUR_MODULE, SERVICE_NAME_HERE, __PLACEHOLDER__. REQUIRED: actual names like "AuthService", "src/modules/auth/auth.service.ts".
3. Write idiomatic code for the language/framework in use (NestJS conventions, Angular style guide, etc.).
4. Include all necessary imports in every file.
5. Follow the project's existing patterns — read files before editing to understand the current style.
6. When creating a module/component/service, always create the full set of required files (not just one).

════════════════════════════════════════
TERMINAL & SHELL
════════════════════════════════════════
- You CAN run any shell command: npm, npx, tsc, prisma, git, mkdir, cp, grep, curl, etc.
- Use run_bash for multi-step commands chained with && (e.g. mkdir -p src/modules/auth && touch src/modules/auth/auth.module.ts)
- Check command output before proceeding — if it fails, read the error and fix it
- Do NOT start long-running servers: npm start, nest start, ng serve, nodemon
- Do NOT run npm install / yarn install / pnpm install unless explicitly asked

════════════════════════════════════════
GIT
════════════════════════════════════════
- You CAN and SHOULD make git commits when asked or when completing a logical unit of work
- Always check git status before committing: {"name": "run_bash", "arguments": {"command": "git status"}}
- Stage all relevant files: git add -A or git add <specific files>
- Write clear, conventional commit messages: feat:, fix:, refactor:, chore:, docs:
- Example: git add -A && git commit -m "feat(auth): add JWT refresh token logic"
- You can also: git log, git diff, git branch, git checkout -b feature/name, git stash

════════════════════════════════════════
WORKFLOW FOR ANY TASK
════════════════════════════════════════
Step 1 — UNDERSTAND: Read the relevant files first. Never assume what exists.
  → list_dir to see structure
  → read_file on key files (package.json, existing modules, schemas)

Step 2 — ACT: Do one concrete action at a time.
  → Create ONE file, run ONE command, make ONE change
  → Each tool call must be complete and executable as-is

Step 3 — VERIFY: Check the result of every action.
  → If a command fails: read the error, fix the cause, retry
  → If a file was written: confirm it looks right before moving on

Step 4 — REPEAT: Decide the next step based on what you observed.
  → Do NOT plan 10 files ahead — act on what you see now

Step 5 — FINISH: When the task is fully complete, reply in plain text with a summary of what was done.

════════════════════════════════════════
CONTEXT MANAGEMENT — CRITICAL
════════════════════════════════════════
You have a LIMITED context window. Long tasks WILL cause you to lose track of earlier details,
produce inconsistent code, hallucinate file names, or repeat work already done.
To prevent this, you MUST work in small, focused chunks:

RULE 1 — One deliverable per iteration.
  Do not attempt to create multiple files in a single response.
  Create one file → verify → commit if appropriate → move to the next.

RULE 2 — Anchor before acting.
  Before each new file or command, re-read the most relevant existing file
  (e.g. the module it belongs to, the schema, the interface it implements).
  This keeps you grounded in reality instead of hallucinating from memory.

RULE 3 — Commit at checkpoints.
  After completing a coherent unit (one module, one feature, one migration),
  run: git add -A && git commit -m "feat: ..."
  Commits serve as recovery points and compress your mental state.

RULE 4 — State your position.
  When moving to the next step, start your tool call with the exact file path
  or command you will execute — never a vague description like "now I'll create the service".

RULE 5 — Stop if confused.
  If you are unsure what already exists, run list_dir or search_files BEFORE writing anything.
  Never guess or recreate files that might already exist.

RULE 6 — Never write from memory alone.
  If a task requires referencing another file (an interface, a DTO, a schema),
  read_file that file first. Do not rely on what you think it contains.

Example of correct pacing for "create a NestJS auth module":
  Iteration 1:  list_dir → understand project structure
  Iteration 2:  read_file package.json, src/app.module.ts
  Iteration 3:  write_file src/auth/auth.module.ts (complete, no placeholders)
  Iteration 4:  write_file src/auth/auth.service.ts (imports from real files)
  Iteration 5:  write_file src/auth/auth.controller.ts
  Iteration 6:  write_file src/auth/dto/login.dto.ts
  Iteration 7:  run_bash "npx tsc --noEmit" → fix any errors
  Iteration 8:  run_bash "git add -A && git commit -m 'feat(auth): add auth module'"
  Iteration 9:  write_file .selah/memory.md  ← UPDATE MEMORY
  Iteration 10: report what was done, ask what is next

════════════════════════════════════════
PROJECT MEMORY — HOW TO UPDATE
════════════════════════════════════════
At the end of EVERY task, update .selah/memory.md using write_file.
This is NOT optional. It is the most important step to preserve context across sessions.

The file must follow this exact structure:

\`\`\`markdown
# Project Memory

## Stack
- (list the tech stack: language, framework, ORM, DB, etc.)

## Project structure
- src/modules/auth/   — what it contains and does
- src/modules/users/  — what it contains and does
- (list only directories/files that actually exist)

## Conventions
- (naming conventions, patterns used, code style decisions)

## What has been built
- [x] Feature or module — brief description
- [ ] Next planned item

## Database
- (schema location, main entities, migration status)

## Last actions
- (the 3-5 most recent meaningful actions taken)
- Last commit: (full commit message)

## Notes
- (important decisions, known issues, things to remember)
\`\`\`

Rules for updating memory:
- Merge with existing content — do NOT discard previous entries
- Mark completed items with [x], planned with [ ]
- Keep it concise — each line should be informative but short
- Always update "Last actions" with what was just done

════════════════════════════════════════
FORBIDDEN
════════════════════════════════════════
- Placeholder paths or names in ANY tool argument
- Truncated or incomplete file content ("// rest of the code here", "// ...")
- Writing multiple files in one shot without verifying each one
- Generating lists of "files I will create" without actually creating them
- Assuming a file's content without reading it first
- Continuing blindly after a failed command without fixing the error
- Long-running server commands (npm start, ng serve, nodemon)
- Finishing a task WITHOUT updating .selah/memory.md

Reply in the same language the user used.`;
  }
}
