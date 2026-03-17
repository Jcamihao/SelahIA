import { Injectable } from '@nestjs/common';
import { StructuredOutputService } from '../../../capabilities/structured-output/structured-output.service';
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
  constructor(private readonly structuredOutputService: StructuredOutputService) {}

  async analyzeSentiment(input: any) {
    const prompt = buildConsolidationSentimentPrompt(input);
    const result = await this.structuredOutputService.generate({
      userPrompt: prompt,
      systemInstruction: 'Você é Selah IA, assistente de acolhimento ministerial.',
      responseSchema: CONSOLIDATION_SENTIMENT_SCHEMA,
      validate: validateConsolidationSentiment,
    });
    return result.data;
  }

  async generatePlaybook(input: any) {
    const prompt = buildConsolidationPlaybookPrompt(input);
    const result = await this.structuredOutputService.generate({
      userPrompt: prompt,
      systemInstruction: 'Você é Selah IA, mentor de pastoreio e especialista em acolhimento e maturidade cristã.',
      responseSchema: CONSOLIDATION_PLAYBOOK_SCHEMA,
      validate: validateConsolidationPlaybook,
    });
    return result.data;
  }
}
