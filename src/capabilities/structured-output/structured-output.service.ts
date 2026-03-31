import { Inject, Injectable } from '@nestjs/common';
import {
  LlmProvider,
  StructuredGenerationFromContentsInput,
  StructuredGenerationInput,
  StructuredGenerationResult,
} from '../../providers/llm-provider.interface';
import { LLM_PROVIDER_TOKEN } from '../../providers/provider.tokens';

@Injectable()
export class StructuredOutputService {
  constructor(
    @Inject(LLM_PROVIDER_TOKEN) private readonly provider: LlmProvider,
  ) {}

  generate<T>(
    input: StructuredGenerationInput<T>,
  ): Promise<StructuredGenerationResult<T>> {
    return this.provider.generateStructured(input);
  }

  generateFromContents<T>(
    input: StructuredGenerationFromContentsInput<T>,
  ): Promise<StructuredGenerationResult<T>> {
    return this.provider.generateStructuredFromContents(input);
  }
}
