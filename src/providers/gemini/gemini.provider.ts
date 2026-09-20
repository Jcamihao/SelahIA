import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
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

type GeminiCandidate = {
  content?: {
    parts?: Array<Record<string, unknown>>;
  };
  finishReason?: string;
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
  usageMetadata?: Record<string, unknown>;
  promptFeedback?: Record<string, unknown>;
};

const GEMINI_RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const GEMINI_RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'EPIPE',
  'ECONNABORTED',
]);

@Injectable()
export class GeminiProvider implements LlmProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly defaultModel = String(
    process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  ).trim();
  private readonly baseUrl = String(
    process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
  )
    .trim()
    .replace(/\/+$/, '');
  private readonly apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  private readonly timeoutMs = Math.max(
    10000,
    Number(process.env.GEMINI_TIMEOUT_MS || 45000),
  );
  private readonly maxRetries = Math.min(
    5,
    Math.max(0, Number(process.env.GEMINI_MAX_RETRIES ?? 2) || 0),
  );
  private readonly retryBaseMs = Math.max(
    1,
    Number(process.env.GEMINI_RETRY_BASE_MS ?? 800) || 800,
  );
  private readonly retryMaxDelayMs = Math.max(
    1,
    Number(process.env.GEMINI_RETRY_MAX_DELAY_MS ?? 8000) || 8000,
  );
  private readonly structuredThinkingBudget = Number(
    process.env.GEMINI_STRUCTURED_THINKING_BUDGET ?? 0,
  );
  private readonly httpClient: AxiosInstance = axios.create({
    timeout: this.timeoutMs,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  constructor(private readonly requestContext: RequestContextService) {}

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const model = this.resolveModel(input.model);
    const response = await this.request(model, {
      system_instruction: this.toSystemInstruction(input.systemInstruction),
      contents: [
        {
          parts: [{ text: input.userPrompt }],
        },
      ],
      generationConfig: this.toGenerationConfig(input),
    }, {
      mode: 'text',
      promptChars: String(input.userPrompt || '').length,
    });

    const text = this.extractText(response);
    return {
      text,
      model,
      raw: response,
    };
  }

  async generateStructured<T>(
    input: StructuredGenerationInput<T>,
  ): Promise<StructuredGenerationResult<T>> {
    const model = this.resolveModel(input.model);
    const thinkingBudget =
      input.thinkingBudget !== undefined
        ? input.thinkingBudget
        : this.structuredThinkingBudget;
    const response = await this.request(model, {
      system_instruction: this.toSystemInstruction(input.systemInstruction),
      contents: [
        {
          parts: [{ text: input.userPrompt }],
        },
      ],
      generationConfig: {
        ...this.toGenerationConfig({
          ...input,
          thinkingBudget,
        }),
        responseMimeType: 'application/json',
        responseJsonSchema: input.responseSchema,
      },
    }, {
      mode: 'structured',
      promptChars: String(input.userPrompt || '').length,
      thinkingBudget,
      maxOutputTokens: input.maxOutputTokens,
    });

    const text = this.extractText(response);
    const parsed = this.parseJson(text, response);
    return {
      data: input.validate(parsed),
      text,
      model,
      raw: response,
    };
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
    const thinkingBudget =
      input.thinkingBudget !== undefined
        ? input.thinkingBudget
        : this.structuredThinkingBudget;
    const response = await this.request(
      model,
      {
        system_instruction: this.toSystemInstruction(input.systemInstruction),
        contents: input.contents,
        generationConfig: this.toGenerationConfig({
          userPrompt: '',
          temperature: input.temperature,
          topP: input.topP,
          maxOutputTokens: input.maxOutputTokens,
          thinkingBudget,
        }),
      },
      {
        mode: 'text',
        promptChars: Number(input.promptChars || 0),
        thinkingBudget,
        maxOutputTokens: input.maxOutputTokens,
      },
    );

    const text = this.extractText(response);
    return {
      text,
      model,
      raw: response,
    };
  }

  async generateStructuredFromContents<T>(
    input: StructuredGenerationFromContentsInput<T>,
  ): Promise<StructuredGenerationResult<T>> {
    const model = this.resolveModel(input.model);
    const thinkingBudget =
      input.thinkingBudget !== undefined
        ? input.thinkingBudget
        : this.structuredThinkingBudget;
    const response = await this.request(
      model,
      {
        system_instruction: this.toSystemInstruction(input.systemInstruction),
        contents: input.contents,
        generationConfig: {
          ...this.toGenerationConfig({
            userPrompt: '',
            temperature: input.temperature,
            topP: input.topP,
            maxOutputTokens: input.maxOutputTokens,
            thinkingBudget,
          }),
          responseMimeType: 'application/json',
          responseJsonSchema: input.responseSchema,
        },
      },
      {
        mode: 'structured',
        promptChars: Number(input.promptChars || 0),
        thinkingBudget,
        maxOutputTokens: input.maxOutputTokens,
      },
    );

    const text = this.extractText(response);
    const parsed = this.parseJson(text, response);
    return {
      data: input.validate(parsed),
      text,
      model,
      raw: response,
    };
  }

  private resolveModel(model?: string) {
    return String(model || this.defaultModel).trim() || this.defaultModel;
  }

  private toSystemInstruction(value?: string) {
    const text = String(value || '').trim();
    if (!text) {
      return undefined;
    }

    return {
      parts: [{ text }],
    };
  }

  private toGenerationConfig(input: GenerateTextInput) {
    const config: Record<string, unknown> = {};
    if (input.temperature !== undefined) {
      config.temperature = input.temperature;
    }
    if (input.topP !== undefined) {
      config.topP = input.topP;
    }
    if (input.maxOutputTokens !== undefined) {
      config.maxOutputTokens = input.maxOutputTokens;
    }
    const thinkingBudget =
      input.thinkingBudget !== undefined
        ? Number(input.thinkingBudget)
        : undefined;
    if (
      thinkingBudget !== undefined &&
      Number.isFinite(thinkingBudget) &&
      thinkingBudget >= 0
    ) {
      config.thinkingConfig = {
        thinkingBudget,
      };
    }
    return config;
  }

  private async request(
    model: string,
    payload: Record<string, unknown>,
    meta: {
      mode: 'text' | 'structured';
      promptChars: number;
      thinkingBudget?: number;
      maxOutputTokens?: number;
    },
  ) {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY não configurada no Selah IA.',
      );
    }

    const url = `${this.baseUrl}/models/${model}:generateContent`;
    const requestId = this.requestContext.getRequestId();
    const sourceApp = this.requestContext.getSourceApp();
    const startedAt = Date.now();

    this.logger.log(
      `[${requestId}] Gemini request started mode=${meta.mode} model=${model} promptChars=${meta.promptChars} maxOutputTokens=${meta.maxOutputTokens ?? 'default'} thinkingBudget=${meta.thinkingBudget ?? 'default'} source=${sourceApp}`,
    );

    for (let attempt = 0; ; attempt++) {
      const remainingMs = this.timeoutMs - (Date.now() - startedAt);
      try {
        const response = await this.httpClient.post<GeminiResponse>(
          url,
          payload,
          {
            headers: {
              'x-goog-api-key': this.apiKey,
            },
            timeout: remainingMs,
          },
        );

        const durationMs = Date.now() - startedAt;
        const finishReason = String(
          response.data?.candidates?.[0]?.finishReason || 'unknown',
        ).trim();
        const usage = this.summarizeUsage(response.data?.usageMetadata);

        this.logger.log(
          `[${requestId}] Gemini request completed mode=${meta.mode} model=${model} finishReason=${finishReason} attempts=${attempt + 1} durationMs=${durationMs}${usage ? ` ${usage}` : ''}`,
        );

        return response.data;
      } catch (error: any) {
        const status = Number(error?.response?.status || 0);
        const apiMessage =
          error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          'Falha ao chamar Gemini Developer API.';
        const elapsedMs = Date.now() - startedAt;

        const delayMs = this.nextRetryDelayMs(error, attempt);
        if (delayMs !== null && elapsedMs + delayMs < this.timeoutMs) {
          this.logger.warn(
            `[${requestId}] Gemini request will retry mode=${meta.mode} model=${model} status=${status || error?.code || 'n/a'} attempt=${attempt + 1}/${this.maxRetries + 1} delayMs=${delayMs}: ${apiMessage}`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        this.logger.error(
          `[${requestId}] Gemini request failed mode=${meta.mode} model=${model} status=${status || 'n/a'} attempts=${attempt + 1} durationMs=${elapsedMs}: ${apiMessage}`,
        );
        throw new BadGatewayException(`Gemini request failed: ${apiMessage}`);
      }
    }
  }

  // Retorna o atraso antes da proxima tentativa, ou null se o erro nao deve ser repetido.
  private nextRetryDelayMs(error: any, attempt: number): number | null {
    if (attempt >= this.maxRetries) {
      return null;
    }

    const status = Number(error?.response?.status || 0);
    const retryable = status
      ? GEMINI_RETRYABLE_STATUS.has(status)
      : GEMINI_RETRYABLE_NETWORK_CODES.has(String(error?.code || ''));
    if (!retryable) {
      return null;
    }

    const retryAfterSeconds = Number(error?.response?.headers?.['retry-after']);
    const retryAfterMs = Number.isFinite(retryAfterSeconds)
      ? retryAfterSeconds * 1000
      : 0;
    if (retryAfterMs > this.retryMaxDelayMs) {
      return null;
    }

    const backoffMs = this.retryBaseMs * 2 ** attempt;
    const jitteredMs = backoffMs / 2 + Math.random() * (backoffMs / 2);
    return Math.min(
      this.retryMaxDelayMs,
      Math.max(retryAfterMs, Math.round(jitteredMs)),
    );
  }

  private extractText(response: GeminiResponse) {
    const candidate = (response?.candidates || [])[0];
    const finishReason = String(candidate?.finishReason || '').trim();
    const parts = candidate?.content?.parts || [];
    const text = parts
      .map((part) => String(part?.text || '').trim())
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!text) {
      const feedback = JSON.stringify(response?.promptFeedback || {});
      throw new BadGatewayException(
        `Gemini returned empty content. finishReason=${finishReason || 'unknown'} feedback=${feedback}`,
      );
    }

    return text;
  }

  private parseJson(text: string, response?: GeminiResponse) {
    try {
      return JSON.parse(text);
    } catch (_error) {
      const sanitized = this.sanitizeJsonCandidate(text);
      if (sanitized) {
        try {
          return JSON.parse(sanitized);
        } catch (_sanitizedError) {
          // Falls through to the structured error below.
        }
      }

      const finishReason = String(
        response?.candidates?.[0]?.finishReason || '',
      ).trim();
      if (finishReason === 'MAX_TOKENS') {
        throw new BadGatewayException(
          'Gemini interrompeu a resposta antes de concluir o JSON estruturado. Ajuste maxOutputTokens ou thinkingBudget.',
        );
      }

      throw new BadGatewayException(
        'Gemini retornou uma resposta JSON inválida para saída estruturada.',
      );
    }
  }

  private sanitizeJsonCandidate(text: string) {
    const normalized = String(text || '').trim();
    if (!normalized) {
      return null;
    }

    const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      return fencedMatch[1].trim();
    }

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

  private summarizeUsage(usageMetadata?: Record<string, unknown>) {
    if (!usageMetadata) {
      return '';
    }

    const promptTokens = Number(usageMetadata.promptTokenCount || 0) || 0;
    const candidateTokens =
      Number(usageMetadata.candidatesTokenCount || 0) || 0;
    const totalTokens = Number(usageMetadata.totalTokenCount || 0) || 0;
    const thoughtsTokens = Number(usageMetadata.thoughtsTokenCount || 0) || 0;

    return `tokens(prompt=${promptTokens}, candidate=${candidateTokens}, total=${totalTokens}, thoughts=${thoughtsTokens})`;
  }
}
