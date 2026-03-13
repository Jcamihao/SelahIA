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
  StructuredGenerationInput,
  StructuredGenerationResult,
} from '../llm-provider.interface';

type GeminiCandidate = {
  content?: {
    parts?: Array<{
      text?: string;
    }>;
  };
  finishReason?: string;
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
  usageMetadata?: Record<string, unknown>;
  promptFeedback?: Record<string, unknown>;
};

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
    5000,
    Number(process.env.GEMINI_TIMEOUT_MS || 20000),
  );
  private readonly httpClient: AxiosInstance = axios.create({
    timeout: this.timeoutMs,
    headers: {
      'Content-Type': 'application/json',
    },
  });

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
    const response = await this.request(model, {
      system_instruction: this.toSystemInstruction(input.systemInstruction),
      contents: [
        {
          parts: [{ text: input.userPrompt }],
        },
      ],
      generationConfig: {
        ...this.toGenerationConfig(input),
        responseMimeType: 'application/json',
        responseJsonSchema: input.responseSchema,
      },
    });

    const text = this.extractText(response);
    const parsed = this.parseJson(text);
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
    return config;
  }

  private async request(model: string, payload: Record<string, unknown>) {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY não configurada no Selah IA.',
      );
    }

    const url = `${this.baseUrl}/models/${model}:generateContent`;

    try {
      const response = await this.httpClient.post<GeminiResponse>(url, payload, {
        headers: {
          'x-goog-api-key': this.apiKey,
        },
      });

      return response.data;
    } catch (error: any) {
      const status = Number(error?.response?.status || 0);
      const apiMessage =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Falha ao chamar Gemini Developer API.';

      this.logger.error(
        `Gemini request failed (status=${status || 'n/a'}): ${apiMessage}`,
      );
      throw new BadGatewayException(`Gemini request failed: ${apiMessage}`);
    }
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

  private parseJson(text: string) {
    try {
      return JSON.parse(text);
    } catch (_error) {
      throw new BadGatewayException(
        'Gemini retornou uma resposta JSON inválida para saída estruturada.',
      );
    }
  }
}

