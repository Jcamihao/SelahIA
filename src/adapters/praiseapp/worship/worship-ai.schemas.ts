export interface WorshipSetlistSuggestion {
  suggestions: Array<{
    songId: number;
    matchReason: string;
    position: 'Abertura' | 'Celebração' | 'Adoração' | 'Encerramento';
  }>;
  flowInsight: string;
}

export const WORSHIP_SETLIST_SUGGESTION_SCHEMA = {
  type: 'object',
  required: ['suggestions', 'flowInsight'],
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['songId', 'matchReason', 'position'],
        properties: {
          songId: { type: 'number' },
          matchReason: { type: 'string' },
          position: { type: 'string', enum: ['Abertura', 'Celebração', 'Adoração', 'Encerramento'] },
        },
      },
    },
    flowInsight: { type: 'string' },
  },
  additionalProperties: false,
};

export interface WorshipRehearsalNotes {
  sections: Array<{
    title: string;
    focusHighlights: string[];
    vocalDynamics: string;
    instrumentalNotes: string;
  }>;
  overallDynamics: string;
}

export const WORSHIP_REHEARSAL_NOTES_SCHEMA = {
  type: 'object',
  required: ['sections', 'overallDynamics'],
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'focusHighlights', 'vocalDynamics', 'instrumentalNotes'],
        properties: {
          title: { type: 'string' },
          focusHighlights: { type: 'array', items: { type: 'string' } },
          vocalDynamics: { type: 'string' },
          instrumentalNotes: { type: 'string' },
        },
      },
    },
    overallDynamics: { type: 'string' },
  },
  additionalProperties: false,
};

export function validateWorshipSetlistSuggestion(data: any): data is WorshipSetlistSuggestion {
  return !!data && Array.isArray(data.suggestions) && typeof data.flowInsight === 'string';
}

export function validateWorshipRehearsalNotes(data: any): data is WorshipRehearsalNotes {
  return !!data && Array.isArray(data.sections) && typeof data.overallDynamics === 'string';
}
