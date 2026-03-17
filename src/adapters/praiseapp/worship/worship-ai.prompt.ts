export function buildWorshipSetlistSuggestionPrompt(input: any): string {
  const repertoireList = (input.repertoire || [])
    .map((s: any) => `- ID: ${s.id} | Título: ${s.title} | Autor: ${s.author} | Tom: ${s.key}`)
    .join('\n');

  return `
Você é Selah IA, curador teológico e musical. Sua tarefa é sugerir uma lista de músicas para um culto baseada no tema fornecido.

# Restrição Obrigatória:
Você só pode sugerir músicas que estão na lista de REPERTÓRIO fornecida abaixo. NÃO sugira músicas de fora deste repertório.

# Tema do Culto:
"${input.theme}"

# Observações Adicionais:
"${input.notes || 'Nenhuma'}"

# Repertório Disponível:
${repertoireList}

Instruções:
- Selecione de 3 a 5 músicas do repertório que melhor se alinham ao tema.
- Para cada música, forneça o songId original e uma "matchReason" explicando a conexão teológica ou emocional com o tema.
- Determine a posição ideal no culto (Abertura, Celebração, Adoração, Encerramento).
- Forneça um "flowInsight" geral sobre como conduzir a adoração nesse setlist.
  `.trim();
}

export function buildWorshipRehearsalNotesPrompt(input: any): string {
  const songsList = (input.songs || [])
    .map((s: any) => `- ${s.title} (${s.key}) | Notas do Líder: ${s.notes || 'Nenhuma'}`)
    .join('\n');

  return `
Você é Selah IA, diretor musical e mestre de adoração. Sua tarefa é gerar notas de dinâmica para o ensaio da equipe de louvor.

# Tema da Mensagem:
"${input.messageTheme || 'A definir'}"

# Setlist Atual:
${songsList}

Instruções:
- Divida a análise em seções de acordo com as músicas ou momentos do culto.
- Para cada seção, forneça "focusHighlights" (pontos de atenção), "vocalDynamics" (orientação para vozes) e "instrumentalNotes" (dicas para banda, ex: piano pads, guitarras ambientais, entradas de bateria).
- Termine com uma "overallDynamics" sobre a atmosfera geral do setlist.
  `.trim();
}
