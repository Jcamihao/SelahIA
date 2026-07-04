import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export type SelahCoderMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: SelahCoderToolCall[];
};

export type SelahCoderToolCall = {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
};

export type SelahCoderToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type SelahCoderChatResult = {
  message: SelahCoderMessage;
  doneReason: string;
  promptTokens: number;
  evalTokens: number;
};

export const SELAH_CODER_TOOLS: SelahCoderToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the full contents of a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (absolute or relative to working directory)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file — creates or overwrites it',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'Full file content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_bash',
      description: 'Execute a bash command and return stdout + stderr (30s timeout)',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Bash command to execute' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List files and subdirectories at a given path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (defaults to working directory)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Search for a text pattern in files using grep (excludes node_modules and .git)',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Grep-compatible search pattern' },
          path: { type: 'string', description: 'Directory or file to search in (defaults to working directory)' },
          filePattern: { type: 'string', description: 'File glob filter, e.g. "*.ts" or "*.json"' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_tests',
      description: 'Run the project test suite (auto-detects jest, vitest, or pytest) and return results. Call this after implementing a feature to verify it works.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];

@Injectable()
export class SelahCoderOllamaClient {
  private readonly logger = new Logger(SelahCoderOllamaClient.name);
  private readonly baseUrl = String(
    process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  )
    .trim()
    .replace(/\/+$/, '');
  private readonly timeoutMs = Math.max(
    10000,
    Number(process.env.OLLAMA_TIMEOUT_MS || 120000),
  );
  private readonly httpClient: AxiosInstance = axios.create({
    timeout: this.timeoutMs,
    headers: { 'Content-Type': 'application/json' },
  });

  async chat(
    model: string,
    messages: SelahCoderMessage[],
    tools: SelahCoderToolDefinition[],
    onToken?: (token: string) => void,
  ): Promise<SelahCoderChatResult> {
    if (onToken) return this.chatStream(model, messages, tools, onToken);
    try {
      const response = await this.httpClient.post(`${this.baseUrl}/api/chat`, {
        model,
        messages,
        tools,
        stream: false,
      });

      const data = response.data;
      const msg = data?.message;

      if (!msg) {
        throw new BadGatewayException('Ollama retornou resposta sem message');
      }

      // Ollama returns arguments as an object (not a JSON string)
      let toolCalls: SelahCoderToolCall[] | undefined = Array.isArray(msg.tool_calls)
        ? msg.tool_calls.map((tc: any) => ({
            function: {
              name: String(tc?.function?.name || ''),
              arguments:
                typeof tc?.function?.arguments === 'object'
                  ? tc.function.arguments
                  : this.safeParseJson(tc?.function?.arguments),
            },
          }))
        : undefined;

      const content = String(msg.content || '').trim();

      // Fallback: smaller models (e.g. qwen2.5-coder:7b) often output the tool
      // call as plain JSON text instead of using the native tool_calls field.
      if (!toolCalls?.length && content) {
        const fallback = this.extractToolCallsFromContent(content);
        if (fallback?.length) {
          toolCalls = fallback;
          this.logger.debug(`SelahCoderOllamaClient: tool call parsed from content text`);
        }
      }

      return {
        message: {
          role: msg.role ?? 'assistant',
          // Clear content when we detected a tool call inside it — otherwise the
          // agent loop would treat the raw JSON string as the final answer.
          content: toolCalls?.length ? '' : content,
          tool_calls: toolCalls?.length ? toolCalls : undefined,
        },
        doneReason: String(data?.done_reason || 'unknown').trim(),
        promptTokens: Number(data?.prompt_eval_count || 0),
        evalTokens: Number(data?.eval_count || 0),
      };
    } catch (error: any) {
      if (error instanceof BadGatewayException) throw error;
      const apiMessage =
        error?.response?.data?.error || error?.message || 'Falha ao chamar Ollama';
      this.logger.error(`SelahCoderOllamaClient error: ${apiMessage}`);
      throw new BadGatewayException(`Codex Ollama request failed: ${apiMessage}`);
    }
  }

  private async chatStream(
    model: string,
    messages: SelahCoderMessage[],
    tools: SelahCoderToolDefinition[],
    onToken: (token: string) => void,
  ): Promise<SelahCoderChatResult> {
    const response = await this.httpClient.post(
      `${this.baseUrl}/api/chat`,
      { model, messages, tools, stream: true },
      { responseType: 'stream', timeout: this.timeoutMs },
    );

    return new Promise<SelahCoderChatResult>((resolve, reject) => {
      const stream = response.data as import('stream').Readable;
      let buffer = '';
      let accContent = '';
      let finalData: any = null;

      // Once the model starts outputting JSON (tool-call text), we stop forwarding
      // tokens to the UI. This keeps the thinking area clean. The full content is
      // still accumulated in accContent for the fallback parser.
      let streamingJson = false;

      stream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf-8');
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            const token: string = parsed?.message?.content ?? '';
            if (token) {
              accContent += token;
              // Detect the moment the model transitions to JSON output
              if (!streamingJson && accContent.trimStart().startsWith('{')) {
                streamingJson = true;
              }
              if (!streamingJson) onToken(token);
            }
            if (parsed.done) finalData = parsed;
          } catch { /* skip malformed lines */ }
        }
      });

      stream.on('end', () => {
        if (!finalData) { reject(new Error('Ollama stream ended without done signal')); return; }
        const msg = finalData.message ?? {};
        let toolCalls: SelahCoderToolCall[] | undefined = Array.isArray(msg.tool_calls)
          ? msg.tool_calls.map((tc: any) => ({
              function: {
                name: String(tc?.function?.name || ''),
                arguments: typeof tc?.function?.arguments === 'object'
                  ? tc.function.arguments
                  : this.safeParseJson(tc?.function?.arguments),
              },
            }))
          : undefined;

        if (!toolCalls?.length && accContent) {
          const fallback = this.extractToolCallsFromContent(accContent);
          if (fallback?.length) toolCalls = fallback;
        }

        resolve({
          message: {
            role: msg.role ?? 'assistant',
            content: toolCalls?.length ? '' : accContent,
            tool_calls: toolCalls?.length ? toolCalls : undefined,
          },
          doneReason: String(finalData.done_reason || 'unknown').trim(),
          promptTokens: Number(finalData.prompt_eval_count || 0),
          evalTokens: Number(finalData.eval_count || 0),
        });
      });

      stream.on('error', reject);
    });
  }

  private extractToolCallsFromContent(content: string): SelahCoderToolCall[] | undefined {
    const KNOWN_TOOLS = new Set([
      'read_file', 'write_file', 'run_bash', 'list_dir', 'search_files', 'run_tests',
    ]);

    const tryParse = (text: string): SelahCoderToolCall | undefined => {
      const candidates = [text.trim(), this.sanitizeBackticks(text.trim())];
      for (const candidate of candidates) {
        try {
          const parsed = JSON.parse(candidate);
          if (typeof parsed?.name === 'string' && KNOWN_TOOLS.has(parsed.name)) {
            return { function: { name: parsed.name, arguments: typeof parsed.arguments === 'object' ? (parsed.arguments ?? {}) : {} } };
          }
          if (typeof parsed?.tool === 'string' && KNOWN_TOOLS.has(parsed.tool)) {
            return { function: { name: parsed.tool, arguments: typeof parsed.args === 'object' ? (parsed.args ?? {}) : {} } };
          }
        } catch { /* try next */ }
      }
      return undefined;
    };

    /**
     * Scan `text` for ALL top-level {...} objects using proper bracket/string
     * tracking, then try to parse each one as a tool call.
     * This handles: single objects, multiple objects in sequence, objects inside
     * code fences, and objects embedded in prose.
     */
    const extractAll = (text: string): SelahCoderToolCall[] => {
      const results: SelahCoderToolCall[] = [];
      let i = 0;
      while (i < text.length) {
        const start = text.indexOf('{', i);
        if (start === -1) break;

        let depth = 0, inStr = false, esc = false, j = start;
        for (; j < text.length; j++) {
          const ch = text[j];
          if (esc) { esc = false; continue; }
          if (ch === '\\' && inStr) { esc = true; continue; }
          if (ch === '"') { inStr = !inStr; continue; }
          if (!inStr) {
            if (ch === '{') depth++;
            else if (ch === '}' && --depth === 0) break;
          }
        }

        if (depth === 0 && j < text.length) {
          const tc = tryParse(text.slice(start, j + 1));
          if (tc) results.push(tc);
          i = j + 1;
        } else {
          i = start + 1;
        }
      }
      return results;
    };

    // Strip code fences if present, then scan for all tool call objects
    const stripped = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const found = extractAll(stripped.trim() || content);
    if (found.length) return found;

    return undefined;
  }

  // Converts backtick-delimited strings (invalid in JSON) to properly escaped
  // double-quoted JSON strings. Handles \n, \t, \r, \, and " inside content.
  private sanitizeBackticks(text: string): string {
    return text.replace(/`([\s\S]*?)`/g, (_, inner: string) => {
      const escaped = inner
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
      return `"${escaped}"`;
    });
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await this.httpClient.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
      const models: any[] = response.data?.models ?? [];
      return models.map((m: any) => String(m.name)).filter(Boolean).sort();
    } catch {
      return [];
    }
  }

  async decompose(model: string, task: string, projectContext: string): Promise<string[]> {
    const contextBlock = projectContext
      ? `Project context (already read):\n${projectContext.slice(0, 4000)}\n\n`
      : '';

    try {
      const response = await this.httpClient.post(
        `${this.baseUrl}/api/chat`,
        {
          model,
          stream: false,
          messages: [
            {
              role: 'system',
              content: `You are a task planning assistant. Break a large task into a sequential list of concrete, self-contained subtasks.
Output ONLY a valid JSON array of strings — no explanation, no markdown, no extra text.
Example: ["Initialize NestJS project with Prisma", "Create User and Organization schema", "Implement JWT auth module"]

Rules:
- Between 3 and 10 subtasks
- Each subtask is a complete, actionable instruction (not just a label)
- Order matters: later subtasks may depend on earlier ones
- Each subtask must be specific enough that an engineer can execute it alone`,
            },
            {
              role: 'user',
              content: `${contextBlock}Task to decompose:\n${task}`,
            },
          ],
        },
        { timeout: 60_000 },
      );

      const content = String(response.data?.message?.content || '').trim();
      return this.parseSubtaskList(content);
    } catch (err: any) {
      this.logger.warn(`decompose failed: ${err?.message} — falling back to single task`);
      return [task];
    }
  }

  private parseSubtaskList(raw: string): string[] {
    // Try 1: bare JSON array
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string') && parsed.length) {
        return parsed;
      }
    } catch {}

    // Try 2: JSON inside code fence
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    if (fenced) {
      try {
        const parsed = JSON.parse(fenced);
        if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string') && parsed.length) {
          return parsed;
        }
      } catch {}
    }

    // Try 3: first [...] block
    const bracket = raw.match(/\[[\s\S]*?\]/)?.[0];
    if (bracket) {
      try {
        const parsed = JSON.parse(bracket);
        if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string') && parsed.length) {
          return parsed;
        }
      } catch {}
    }

    // Try 4: numbered / bulleted list lines
    const lines = raw
      .split('\n')
      .map((l) => l.replace(/^[\d]+[.)]\s*/, '').replace(/^[-*•]\s*/, '').trim())
      .filter((l) => l.length > 5 && l.length < 300);
    if (lines.length >= 2) return lines;

    return [raw.trim()];
  }

  private safeParseJson(value: unknown): Record<string, unknown> {
    try {
      return JSON.parse(String(value || '{}'));
    } catch {
      return {};
    }
  }
}
