import { Injectable } from '@nestjs/common';
import { StructuredOutputService } from '../../../capabilities/structured-output/structured-output.service';
import {
  WORSHIP_SETLIST_SUGGESTION_SCHEMA,
  WORSHIP_REHEARSAL_NOTES_SCHEMA,
  validateWorshipSetlistSuggestion,
  validateWorshipRehearsalNotes,
} from './worship-ai.schemas';
import {
  buildWorshipSetlistSuggestionPrompt,
  buildWorshipRehearsalNotesPrompt,
} from './worship-ai.prompt';

@Injectable()
export class WorshipAiService {
  constructor(private readonly structuredOutputService: StructuredOutputService) {}

  async getSetlistSuggestions(input: any) {
    const prompt = buildWorshipSetlistSuggestionPrompt(input);
    const result = await this.structuredOutputService.generate({
      userPrompt: prompt,
      systemInstruction: 'Você é Selah IA, curador teológico e musical especializado em adoração cristã.',
      responseSchema: WORSHIP_SETLIST_SUGGESTION_SCHEMA,
      validate: validateWorshipSetlistSuggestion,
    });
    return result.data;
  }

  async generateRehearsalNotes(input: any) {
    const prompt = buildWorshipRehearsalNotesPrompt(input);
    const result = await this.structuredOutputService.generate({
      userPrompt: prompt,
      systemInstruction: 'Você é Selah IA, diretor musical e especialista em dinâmicas de banda e vocal para louvor corporativo.',
      responseSchema: WORSHIP_REHEARSAL_NOTES_SCHEMA,
      validate: validateWorshipRehearsalNotes,
    });
    return result.data;
  }
}
