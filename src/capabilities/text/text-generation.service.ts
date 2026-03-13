import { Inject, Injectable } from '@nestjs/common';
import {
  GenerateTextInput,
  GenerateTextResult,
  LlmProvider,
} from '../../providers/llm-provider.interface';
import { LLM_PROVIDER_TOKEN } from '../../providers/provider.tokens';

@Injectable()
export class TextGenerationService {
  constructor(
    @Inject(LLM_PROVIDER_TOKEN) private readonly provider: LlmProvider,
  ) {}

  generate(input: GenerateTextInput): Promise<GenerateTextResult> {
    return this.provider.generateText(input);
  }
}

