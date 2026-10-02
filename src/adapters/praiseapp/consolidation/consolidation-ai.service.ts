import { Inject, Injectable } from '@nestjs/common';
import { LlmProvider } from '../../../providers/llm-provider.interface';
import { LLM_PROVIDER_TOKEN } from '../../../providers/provider.tokens';
import {
  CONSOLIDATION_SENTIMENT_SCHEMA,
  CONSOLIDATION_PLAYBOOK_SCHEMA,
  validateConsolidationSentiment,
  validateConsolidationPlaybook,
} from './consolidation-ai.schemas';
import {
  buildConsolidationSentimentPrompt,
  buildConsolidationPlaybookPrompt,
} from './consolidation-ai.prompt';

@Injectable()
export class ConsolidationAiService {
  constructor(@Inject(LLM_PROVIDER_TOKEN) private readonly llmProvider: LlmProvider) {}

  async analyzeSentiment(input: any) {
    const prompt = buildConsolidationSentimentPrompt(input);
    const result = await this.llmProvider.generateStructured({
      userPrompt: prompt,
      systemInstruction: 'Você é Selah IA, assistente de acolhimento ministerial.',
      responseSchema: CONSOLIDATION_SENTIMENT_SCHEMA,
      validate: validateConsolidationSentiment,
    });
    return result.data;
  }

  async generatePlaybook(input: any) {
    const prompt = buildConsolidationPlaybookPrompt(input);
    const result = await this.llmProvider.generateStructured({
      userPrompt: prompt,
      systemInstruction: 'Você é Selah IA, mentor de pastoreio e especialista em acolhimento e maturidade cristã.',
      responseSchema: CONSOLIDATION_PLAYBOOK_SCHEMA,
      validate: validateConsolidationPlaybook,
    });
    return result.data;
  }
}
