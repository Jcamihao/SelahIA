import { GeneratePraiseAppKidsLessonPlanDto } from './dto/generate-praiseapp-kids-lesson-plan.dto';

const listBlock = (title: string, items?: string[]) => {
  const normalizedItems = (items || []).map((item) => String(item || '').trim()).filter(Boolean);
  if (!normalizedItems.length) {
    return `${title}: nenhum item relevante informado.`;
  }
  return `${title}:\n- ${normalizedItems.join('\n- ')}`;
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

Contexto adicional do líder:
${additionalContext || 'nenhum contexto adicional informado.'}
`.trim();
};

