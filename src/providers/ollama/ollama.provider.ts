import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  GenerateTextInput,
  GenerateTextResult,
  LlmProvider,
  StructuredGenerationFromContentsInput,
  StructuredGenerationInput,
  StructuredGenerationResult,
} from '../llm-provider.interface';
import { RequestContextService } from '../../common/logging/request-context.service';

type OllamaMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
};

type OllamaChatResponse = {
  model: string;
  message?: {
    role: string;
    content: string;
  };
  done: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
};

@Injectable()
export class OllamaProvider implements LlmProvider {
  private readonly logger = new Logger(OllamaProvider.name);
  private readonly defaultModel = String(
    process.env.OLLAMA_MODEL || 'gemma4:e4b',
  ).trim();
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

  constructor(private readonly requestContext: RequestContextService) {}

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const model = this.resolveModel(input.model);
    const messages = this.buildMessages(input.systemInstruction, input.userPrompt);
    const content = await this.chat(
      model,
      messages,
      { temperature: input.temperature, topP: input.topP, numPredict: input.maxOutputTokens },
      { mode: 'text', promptChars: String(input.userPrompt || '').length },
    );
    return { text: content, model, raw: { content } };
  }

  async generateStructured<T>(
    input: StructuredGenerationInput<T>,
  ): Promise<StructuredGenerationResult<T>> {
    const model = this.resolveModel(input.model);
    const messages = this.buildMessages(input.systemInstruction, input.userPrompt);
    const content = await this.chat(
      model,
      messages,
      { temperature: input.temperature, topP: input.topP, numPredict: input.maxOutputTokens, format: 'json' },
      { mode: 'structured', promptChars: String(input.userPrompt || '').length },
    );
    const parsed = this.parseJson(content);
    return { data: input.validate(parsed), text: content, model, raw: { content } };
  }

  async generateStructuredFromContents<T>(
    input: StructuredGenerationFromContentsInput<T>,
  ): Promise<StructuredGenerationResult<T>> {
    const model = this.resolveModel(input.model);
    const messages = this.contentsToMessages(input.systemInstruction, input.contents);
    const content = await this.chat(
      model,
      messages,
      { temperature: input.temperature, topP: input.topP, numPredict: input.maxOutputTokens, format: 'json' },
      { mode: 'structured', promptChars: Number(input.promptChars || 0) },
    );
    const parsed = this.parseJson(content);
    return { data: input.validate(parsed), text: content, model, raw: { content } };
  }

  async generateTextFromContents(input: {
    model?: string;
    systemInstruction?: string;
    contents: Array<Record<string, unknown>>;
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
    thinkingBudget?: number;
    promptChars?: number;
  }): Promise<GenerateTextResult> {
    const model = this.resolveModel(input.model);
    const messages = this.contentsToMessages(input.systemInstruction, input.contents);
    const content = await this.chat(
      model,
      messages,
      { temperature: input.temperature, topP: input.topP, numPredict: input.maxOutputTokens },
      { mode: 'text', promptChars: Number(input.promptChars || 0) },
    );
    return { text: content, model, raw: { content } };
  }

  private resolveModel(model?: string) {
    return String(model || this.defaultModel).trim() || this.defaultModel;
  }

  private buildMessages(systemInstruction?: string, userPrompt?: string): OllamaMessage[] {
    const messages: OllamaMessage[] = [];
    const system = String(systemInstruction || '').trim();
    if (system) messages.push({ role: 'system', content: system });
    const user = String(userPrompt || '').trim();
    if (user) messages.push({ role: 'user', content: user });
    return messages;
  }

  private contentsToMessages(
    systemInstruction?: string,
    contents: Array<Record<string, unknown>> = [],
  ): OllamaMessage[] {
    const messages: OllamaMessage[] = [];
    const system = String(systemInstruction || '').trim();
    if (system) messages.push({ role: 'system', content: system });

    for (const item of contents) {
      const rawRole = String(item.role || 'user').trim();
      const role: OllamaMessage['role'] = rawRole === 'model' ? 'assistant' : 'user';
      const parts = (item.parts as Array<Record<string, unknown>>) || [];

      const text = parts
        .map((p) => String(p?.text || '').trim())
        .filter(Boolean)
        .join('\n')
        .trim();

      const images = parts
        .map((p) => (p?.inline_data as Record<string, unknown> | undefined)?.data)
        .filter((d): d is string => typeof d === 'string' && d.length > 0);

      if (text || images.length > 0) {
        const msg: OllamaMessage = { role, content: text };
        if (images.length > 0) msg.images = images;
        messages.push(msg);
      }
    }

    return messages;
  }

  private async chat(
    model: string,
    messages: OllamaMessage[],
    options: {
      temperature?: number;
      topP?: number;
      numPredict?: number;
      format?: 'json';
    },
    meta: { mode: 'text' | 'structured'; promptChars: number },
  ): Promise<string> {
    const requestId = this.requestContext.getRequestId();
    const sourceApp = this.requestContext.getSourceApp();
    const startedAt = Date.now();

    const ollamaOptions: Record<string, unknown> = {};
    if (options.temperature !== undefined) ollamaOptions.temperature = options.temperature;
    if (options.topP !== undefined) ollamaOptions.top_p = options.topP;
    if (options.numPredict !== undefined) ollamaOptions.num_predict = options.numPredict;

    const payload: Record<string, unknown> = {
      model,
      messages,
      stream: false,
      options: ollamaOptions,
    };
    if (options.format) payload.format = options.format;

    this.logger.log(
      `[${requestId}] Ollama request started mode=${meta.mode} model=${model} promptChars=${meta.promptChars} source=${sourceApp}`,
    );

    try {
      const response = await this.httpClient.post<OllamaChatResponse>(
        `${this.baseUrl}/api/chat`,
        payload,
      );

      const durationMs = Date.now() - startedAt;
      const doneReason = String(response.data?.done_reason || 'unknown').trim();
      const promptTokens = Number(response.data?.prompt_eval_count || 0);
      const evalTokens = Number(response.data?.eval_count || 0);

      this.logger.log(
        `[${requestId}] Ollama request completed mode=${meta.mode} model=${model} doneReason=${doneReason} durationMs=${durationMs} tokens(prompt=${promptTokens}, eval=${evalTokens})`,
      );

      const content = String(response.data?.message?.content || '').trim();
      if (!content) {
        throw new BadGatewayException(
          `Ollama retornou resposta vazia. doneReason=${doneReason}`,
        );
      }
      return content;
    } catch (error: any) {
      if (error instanceof BadGatewayException) throw error;
      const status = Number(error?.response?.status || 0);
      const apiMessage =
        error?.response?.data?.error ||
        error?.message ||
        'Falha ao chamar Ollama.';

      const durationMs = Date.now() - startedAt;
      this.logger.error(
        `[${requestId}] Ollama request failed mode=${meta.mode} model=${model} status=${status || 'n/a'} durationMs=${durationMs}: ${apiMessage}`,
      );
      throw new BadGatewayException(`Ollama request failed: ${apiMessage}`);
    }
  }

  private parseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      const sanitized = this.sanitizeJsonCandidate(text);
      if (sanitized) {
        try {
          return JSON.parse(sanitized);
        } catch {
          // Falls through to error below.
        }
      }
      throw new BadGatewayException(
        'Ollama retornou uma resposta JSON inválida para saída estruturada.',
      );
    }
  }

  private sanitizeJsonCandidate(text: string): string | null {
    const normalized = String(text || '').trim();
    if (!normalized) return null;

    const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) return fencedMatch[1].trim();

    const firstObjectIndex = normalized.indexOf('{');
    const lastObjectIndex = normalized.lastIndexOf('}');
    if (firstObjectIndex !== -1 && lastObjectIndex > firstObjectIndex) {
      return normalized.slice(firstObjectIndex, lastObjectIndex + 1);
    }

    const firstArrayIndex = normalized.indexOf('[');
    const lastArrayIndex = normalized.lastIndexOf(']');
    if (firstArrayIndex !== -1 && lastArrayIndex > firstArrayIndex) {
      return normalized.slice(firstArrayIndex, lastArrayIndex + 1);
    }

    return null;
  }
}
