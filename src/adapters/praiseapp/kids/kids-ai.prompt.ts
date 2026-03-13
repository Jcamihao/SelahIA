import { GeneratePraiseAppKidsLessonPlanDto } from './dto/generate-praiseapp-kids-lesson-plan.dto';
import { GeneratePraiseAppKidsCheckinDailySummaryDto } from './dto/generate-praiseapp-kids-checkin-daily-summary.dto';
import { GeneratePraiseAppKidsNextSequenceDto } from './dto/generate-praiseapp-kids-next-sequence.dto';
import { GeneratePraiseAppKidsWeeklyVerseExpansionDto } from './dto/generate-praiseapp-kids-weekly-verse-expansion.dto';
import { GeneratePraiseAppKidsOperationalAssistantDto } from './dto/generate-praiseapp-kids-operational-assistant.dto';
import { GeneratePraiseAppKidsAgeAdaptationsDto } from './dto/generate-praiseapp-kids-age-adaptations.dto';

const listBlock = (title: string, items?: string[]) => {
  const normalizedItems = (items || []).map((item) => String(item || '').trim()).filter(Boolean);
  if (!normalizedItems.length) {
    return `${title}: nenhum item relevante informado.`;
  }
  return `${title}:\n- ${normalizedItems.join('\n- ')}`;
};

const keyedListBlock = (
  title: string,
  items?: Array<Record<string, unknown>>,
  itemFormatter?: (item: Record<string, unknown>, index: number) => string,
) => {
  const normalizedItems = (items || []).filter(
    (item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)),
  );
  if (!normalizedItems.length) {
    return `${title}: nenhum item relevante informado.`;
  }

  const lines = normalizedItems
    .map((item, index) => {
      if (itemFormatter) {
        return itemFormatter(item, index);
      }
      return Object.entries(item)
        .map(([key, value]) => `${key}: ${String(value || '').trim() || 'n/a'}`)
        .join(', ');
    })
    .filter(Boolean);

  if (!lines.length) {
    return `${title}: nenhum item relevante informado.`;
  }

  return `${title}:\n- ${lines.join('\n- ')}`;
};

const lessonBlock = (title: string, lesson?: Record<string, unknown>) => {
  const payload =
    lesson && typeof lesson === 'object' && !Array.isArray(lesson)
      ? lesson
      : {};
  const lessonFlow = Array.isArray(payload.lessonFlow)
    ? payload.lessonFlow.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const supplies = Array.isArray(payload.supplies)
    ? payload.supplies.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const leaderTips = Array.isArray(payload.leaderTips)
    ? payload.leaderTips.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  return `
${title}:
- Título: ${String(payload.suggestedTitle || '').trim() || 'não informado'}
- Referência bíblica: ${String(payload.biblicalReference || '').trim() || 'não informado'}
- Faixa etária: ${String(payload.ageRange || '').trim() || 'não informado'}
- Objetivo: ${String(payload.mainObjective || '').trim() || 'não informado'}
- Resumo: ${String(payload.lessonSummary || '').trim() || 'não informado'}
- Quebra-gelo: ${String(payload.iceBreaker || '').trim() || 'não informado'}
- Atividade principal: ${String(payload.activity || '').trim() || 'não informado'}
- Fluxo atual: ${lessonFlow.length ? lessonFlow.join(' | ') : 'não informado'}
- Materiais atuais: ${supplies.length ? supplies.join(', ') : 'não informado'}
- Dicas ao líder: ${leaderTips.length ? leaderTips.join(' | ') : 'não informado'}
- Oração: ${String(payload.prayer || '').trim() || 'não informado'}
- Mensagem para pais: ${String(payload.messageToParents || '').trim() || 'não informado'}
  `.trim();
};

export const buildPraiseAppKidsLessonPlanPrompt = (
  input: GeneratePraiseAppKidsLessonPlanDto,
) => {
  const locale = String(input.locale || process.env.SELAH_DEFAULT_LOCALE || 'pt-BR').trim();
  const ageRange = String(input.ageRangeLabel || '5-7 anos').trim();
  const biblicalReference = String(input.biblicalReference || '').trim();
  const theme = String(input.theme || '').trim();
  const lessonObjective = String(input.lessonObjective || '').trim();
  const durationMin = Number(input.durationMin || 35);
  const additionalContext = String(input.additionalContext || '').trim();
  const weeklyVerseReference = String(input.activeWeeklyVerseReference || '').trim();
  const weeklyVerseText = String(input.activeWeeklyVerseText || '').trim();

  return `
Contexto do produto:
- Produto consumidor: PraiseApp
- Módulo: Kids
- Idioma alvo: ${locale}
- Faixa etária: ${ageRange}
- Duração aproximada: ${durationMin} minutos
- Referência bíblica principal: ${biblicalReference}
- Tema sugerido: ${theme || 'não informado'}
- Objetivo pedagógico sugerido: ${lessonObjective || 'não informado'}

Regras de geração:
- Gere conteúdo prático para líderes de ministério infantil em igreja local.
- Seja fiel à referência bíblica informada.
- Use linguagem simples, acolhedora e aplicável.
- Não invente citações literais extensas da Bíblia.
- Não gere URLs. Para vídeo, entregue apenas um texto de busca em "youtubeSearchQuery".
- Atividade e quebra-gelo devem ser seguros e baratos.
- "messageToParents" deve vir pronta para WhatsApp, em um único bloco de texto.
- "lessonFlow" deve ser uma sequência objetiva de 4 a 7 passos.
- Se faltar contexto, faça suposições conservadoras.

Sinais do histórico do ministério:
${listBlock('Templates recentes', input.recentTemplateTitles)}
${listBlock('Aulas recentes', input.recentLessonTitles)}

Versículo ativo para pais:
- Referência: ${weeklyVerseReference || 'não informado'}
- Texto/resumo: ${weeklyVerseText || 'não informado'}

Observações do líder para a IA considerar:
${additionalContext || 'nenhuma observação adicional informada.'}
`.trim();
};

export const buildPraiseAppKidsCheckinDailySummaryPrompt = (
  input: GeneratePraiseAppKidsCheckinDailySummaryDto,
) => {
  const locale = String(input.locale || process.env.SELAH_DEFAULT_LOCALE || 'pt-BR').trim();
  const date = String(input.date || '').trim();
  const additionalContext = String(input.additionalContext || '').trim();

  return `
Contexto do produto:
- Produto consumidor: PraiseApp
- Módulo: Kids
- Idioma alvo: ${locale}
- Data da operação: ${date}

Objetivo:
- Gerar um resumo executivo curto e acionável para a equipe Kids sobre o check-in do dia.
- O texto deve soar como um coordenador experiente, claro e direto.

Indicadores operacionais do dia:
- Total de check-ins: ${Number(input.totalCheckins || 0)}
- Total de check-outs concluídos: ${Number(input.totalCheckedOut || 0)}
- Crianças ainda abertas no sistema: ${Number(input.totalOpenCheckins || 0)}
- Primeiras visitas: ${Number(input.firstVisits || 0)}
- Solicitações de responsável por WhatsApp: ${Number(input.guardianCheckoutRequests || 0)}
- Total de voluntários em apoio: ${Number(input.totalVolunteers || 0)}
- Déficit estimado de voluntários: ${Number(input.volunteerShortage || 0)}
- Nível geral de atenção: ${String(input.overallAlertLevel || 'ok').trim() || 'ok'}

Resumo por turma:
${keyedListBlock('Turmas do dia', input.classSummaries, (item) => {
  const className = String(item.className || '').trim() || 'Turma sem nome';
  const presentCount = Number(item.presentCount || 0);
  const assignedVolunteers = Number(item.assignedVolunteers || 0);
  const ratio = item.ratio !== null && item.ratio !== undefined ? Number(item.ratio) : null;
  const shortage = Number(item.volunteerShortage || 0);
  const alertLevel = String(item.ratioAlertLevel || 'ok').trim() || 'ok';
  return `${className}: presentes=${presentCount}, voluntários=${assignedVolunteers}, proporção=${ratio ?? 'n/a'}, alerta=${alertLevel}, déficit=${shortage}`;
})}

Regras de geração:
- Produza um headline curto, um resumo em 2 ou 3 frases, highlights objetivos e ações práticas.
- Se houver primeiras visitas, destaque acolhimento.
- Se houver crianças abertas ou déficit operacional, destaque acompanhamento imediato.
- Não invente números. Use apenas o contexto fornecido.

Observações adicionais:
${additionalContext || 'nenhuma observação adicional.'}
  `.trim();
};

export const buildPraiseAppKidsNextSequencePrompt = (
  input: GeneratePraiseAppKidsNextSequenceDto,
) => {
  const locale = String(input.locale || process.env.SELAH_DEFAULT_LOCALE || 'pt-BR').trim();
  const ageRange = String(input.ageRangeLabel || '5-7 anos').trim();
  const additionalContext = String(input.additionalContext || '').trim();

  return `
Contexto do produto:
- Produto consumidor: PraiseApp
- Módulo: Kids
- Idioma alvo: ${locale}
- Faixa etária alvo: ${ageRange}

Aula base ou atual:
- Título atual: ${String(input.currentTitle || '').trim() || 'não informado'}
- Referência atual: ${String(input.currentBiblicalReference || '').trim() || 'não informado'}
- Tema atual: ${String(input.currentTheme || '').trim() || 'não informado'}
- Objetivo atual: ${String(input.currentObjective || '').trim() || 'não informado'}
- Resumo atual: ${String(input.currentLessonSummary || '').trim() || 'não informado'}

Histórico recente do ministério:
${keyedListBlock('Aulas recentes', input.recentLessons, (item) => {
  const title = String(item.title || '').trim() || 'sem título';
  const reference = String(item.biblicalReference || '').trim() || 'sem referência';
  const objective = String(item.mainObjective || '').trim() || 'sem objetivo';
  return `${title} (${reference}) - objetivo: ${objective}`;
})}

Versículo ativo para pais:
- Referência: ${String(input.activeWeeklyVerseReference || '').trim() || 'não informado'}
- Texto/resumo: ${String(input.activeWeeklyVerseText || '').trim() || 'não informado'}

Regras de geração:
- Sugira a próxima aula com continuidade pedagógica.
- Evite repetir o mesmo foco imediato das últimas aulas.
- Busque equilíbrio entre verdade bíblica, memorização, brincadeira e aplicação prática.
- Considere alternância saudável entre Antigo e Novo Testamento quando fizer sentido.
- Entregue algo que ajude um líder a entender "por que essa é a próxima aula".

Observações do líder:
${additionalContext || 'nenhuma observação adicional.'}
  `.trim();
};

export const buildPraiseAppKidsWeeklyVerseExpansionPrompt = (
  input: GeneratePraiseAppKidsWeeklyVerseExpansionDto,
) => {
  const locale = String(input.locale || process.env.SELAH_DEFAULT_LOCALE || 'pt-BR').trim();
  const ageRange = String(input.ageRangeLabel || '3-11 anos').trim();

  return `
Contexto do produto:
- Produto consumidor: PraiseApp
- Módulo: Kids
- Idioma alvo: ${locale}
- Faixa etária abrangida: ${ageRange}

Versículo da semana:
- Referência: ${String(input.reference || '').trim()}
- Texto: ${String(input.text || '').trim()}

Objetivo:
- Expandir esse versículo para uso do ministério infantil e comunicação com pais.

Regras de geração:
- A explicação infantil deve ser simples, fiel e acolhedora.
- O gesto de memorização deve ser fácil para crianças repetirem em sala.
- A frase para pais deve ser curta, repetível e natural.
- A ideia de aplicação precisa ser simples e possível em casa ou na igreja.
- A oração deve ser curta.
- Não invente contexto bíblico fora do que o versículo permite.
  `.trim();
};

export const buildPraiseAppKidsOperationalAssistantPrompt = (
  input: GeneratePraiseAppKidsOperationalAssistantDto,
) => {
  const locale = String(input.locale || process.env.SELAH_DEFAULT_LOCALE || 'pt-BR').trim();
  const operationalContext = String(input.operationalContext || '').trim();

  return `
Contexto do produto:
- Produto consumidor: PraiseApp
- Módulo: Kids
- Idioma alvo: ${locale}

${lessonBlock('Plano base da aula', input.baseLesson)}

Situação operacional atual:
- Restrição principal: ${operationalContext || 'nenhuma informada'}
- Duração desejada: ${Number(input.desiredDurationMin || 0) || 'não informada'} minutos

Objetivo:
- Adaptar operacionalmente a aula para o contexto descrito, sem perder a verdade principal.

Regras de geração:
- Seja muito prático.
- Ajuste fluxo, ritmo, materiais e condução do líder.
- Se não houver TV ou tela, proponha alternativa realista.
- Inclua estratégias de retomada de atenção para turma agitada quando fizer sentido.
- A resposta deve ajudar o líder a executar a mesma aula em condições diferentes.
  `.trim();
};

export const buildPraiseAppKidsAgeAdaptationsPrompt = (
  input: GeneratePraiseAppKidsAgeAdaptationsDto,
) => {
  const locale = String(input.locale || process.env.SELAH_DEFAULT_LOCALE || 'pt-BR').trim();
  const targetAgeRanges = (input.targetAgeRanges || [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  return `
Contexto do produto:
- Produto consumidor: PraiseApp
- Módulo: Kids
- Idioma alvo: ${locale}

${lessonBlock('Plano base da aula', input.baseLesson)}

Faixas etárias a adaptar:
${listBlock('Faixas alvo', targetAgeRanges.length ? targetAgeRanges : ['3-5 anos', '6-8 anos', '9-11 anos'])}

Objetivo:
- Adaptar a mesma lição para diferentes faixas etárias, mudando linguagem, dinâmica, aplicação e tempo.

Regras de geração:
- Mantenha a verdade principal da aula.
- Ajuste complexidade verbal e atividade física conforme a idade.
- Traga diferenças reais entre as faixas, não apenas texto reescrito.
- Cada versão deve ajudar um professor a entender como conduzir aquela faixa específica.
  `.trim();
};
