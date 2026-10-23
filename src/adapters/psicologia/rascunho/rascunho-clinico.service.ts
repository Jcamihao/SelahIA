import { Inject, Injectable, Logger } from '@nestjs/common';
import { RequestContextService } from '../../../common/logging/request-context.service';
import { LlmProvider } from '../../../providers/llm-provider.interface';
import { LLM_PROVIDER_TOKEN } from '../../../providers/provider.tokens';
import { resolveActiveProviderLabel } from '../../../providers/provider-selection';
import { GerarRascunhoDto } from './dto/gerar-rascunho.dto';
import {
  buildRascunhoClinicoSystemInstruction,
  buildRascunhoClinicoUserPrompt,
} from './rascunho-clinico.prompt';
import {
  RASCUNHO_CLINICO_SCHEMA,
  RascunhoClinicoResponse,
  validateRascunhoClinicoResponse,
} from './rascunho-clinico.schemas';

@Injectable()
export class RascunhoClinicoService {
  private readonly logger = new Logger(RascunhoClinicoService.name);

  constructor(
    @Inject(LLM_PROVIDER_TOKEN) private readonly llmProvider: LlmProvider,
    private readonly requestContext: RequestContextService,
  ) {}

  private responseMeta(model: string) {
    return {
      provider: resolveActiveProviderLabel(),
      version: String(process.env.SELAH_PUBLIC_VERSION || 'v1').trim() || 'v1',
      model,
      generatedAt: new Date().toISOString(),
    };
  }

  async gerar(
    dto: GerarRascunhoDto,
  ): Promise<
    {
      provider: string;
      version: string;
      model: string;
      generatedAt: string;
    } & RascunhoClinicoResponse
  > {
    const requestId = this.requestContext.getRequestId();
    const startedAt = Date.now();

    // Dado clinico: so metadados vao para o log. Nunca a nota, o prompt nem a saida do modelo.
    this.logger.log(
      `[${requestId}] Rascunho clinico started tipoDocumento=${dto.tipoDocumento} abordagem=${dto.abordagem} inputChars=${dto.textoAnonimizado.length}`,
    );

    try {
      const result = await this.llmProvider.generateStructured({
        systemInstruction: buildRascunhoClinicoSystemInstruction(
          dto.abordagem,
          dto.tipoDocumento,
        ),
        userPrompt: buildRascunhoClinicoUserPrompt(dto),
        responseSchema: RASCUNHO_CLINICO_SCHEMA,
        validate: validateRascunhoClinicoResponse,
        temperature: 0.2,
        // 4096 e estimativa (anamnese de 8000 chars de entrada): medir com saida real do Gemini.
        maxOutputTokens: 4096,
        thinkingBudget: 0,
      });

      this.logger.log(
        `[${requestId}] Rascunho clinico completed outputChars=${result.data.rascunho.length} latencyMs=${Date.now() - startedAt}`,
      );

      return { ...this.responseMeta(result.model), ...result.data };
    } catch (error) {
      this.logger.warn(
        `[${requestId}] Rascunho clinico failed error=${error instanceof Error ? error.name : 'unknown'} latencyMs=${Date.now() - startedAt}`,
      );
      throw error;
    }
  }
}
