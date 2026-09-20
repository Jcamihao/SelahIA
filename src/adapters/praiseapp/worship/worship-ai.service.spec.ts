import { WorshipAiService } from './worship-ai.service';
import {
  buildWorshipRehearsalNotesPrompt,
  buildWorshipSetlistSuggestionPrompt,
} from './worship-ai.prompt';

const providerLikeStructuredOutput = (parsed: unknown) => ({
  generate: jest.fn(async (input: any) => ({
    data: input.validate(parsed),
    model: 'test-model',
  })),
});

describe('WorshipAiService', () => {
  const setlist = {
    suggestions: [
      { songId: 1, matchReason: 'Fala de graça.', position: 'Abertura' },
    ],
    flowInsight: 'Comece leve e cresça.',
  };
  const rehearsal = {
    sections: [
      {
        title: 'Música 1',
        focusHighlights: ['Entrada'],
        vocalDynamics: 'Vozes suaves',
        instrumentalNotes: 'Pad contínuo',
      },
    ],
    overallDynamics: 'Atmosfera de quebrantamento.',
  };

  it('returns the setlist object, not the validator boolean', async () => {
    const service = new WorshipAiService(
      providerLikeStructuredOutput(setlist) as any,
    );

    const result = await service.getSetlistSuggestions({
      theme: 'Graça',
      repertoire: [{ id: 1, title: 'Grande é o Senhor', author: 'X', key: 'G' }],
    });

    expect(result).toEqual(setlist);
  });

  it('returns the rehearsal notes object, not the validator boolean', async () => {
    const service = new WorshipAiService(
      providerLikeStructuredOutput(rehearsal) as any,
    );

    const result = await service.generateRehearsalNotes({
      messageTheme: 'Graça',
      songs: [{ title: 'Grande é o Senhor', key: 'G' }],
    });

    expect(result).toEqual(rehearsal);
  });

  it('rejects payloads missing the required top-level fields', async () => {
    const setlistService = new WorshipAiService(
      providerLikeStructuredOutput({ flowInsight: 'x' }) as any,
    );
    await expect(
      setlistService.getSetlistSuggestions({ theme: 'Graça', repertoire: [] }),
    ).rejects.toThrow();

    const rehearsalService = new WorshipAiService(
      providerLikeStructuredOutput({ sections: [] }) as any,
    );
    await expect(
      rehearsalService.generateRehearsalNotes({ songs: [] }),
    ).rejects.toThrow();
  });

  it('restricts the setlist prompt to the church repertoire and lists every song', () => {
    const prompt = buildWorshipSetlistSuggestionPrompt({
      theme: 'Graça',
      repertoire: [
        { id: 7, title: 'Grande é o Senhor', author: 'Adhemar', key: 'G' },
        { id: 9, title: 'Ele é Exaltado', author: 'Twila', key: 'D' },
      ],
    });

    expect(prompt).toContain('só pode sugerir músicas que estão na lista');
    expect(prompt).toContain('- ID: 7 | Título: Grande é o Senhor | Autor: Adhemar | Tom: G');
    expect(prompt).toContain('- ID: 9 | Título: Ele é Exaltado | Autor: Twila | Tom: D');
    expect(prompt).toContain('"Graça"');
    expect(prompt).toContain('"Nenhuma"');
  });

  it('builds a rehearsal prompt with leader notes and a default theme', () => {
    const prompt = buildWorshipRehearsalNotesPrompt({
      songs: [{ title: 'Grande é o Senhor', key: 'G', notes: 'Ponte em crescendo' }],
    });

    expect(prompt).toContain('"A definir"');
    expect(prompt).toContain('- Grande é o Senhor (G) | Notas do Líder: Ponte em crescendo');
  });
});
