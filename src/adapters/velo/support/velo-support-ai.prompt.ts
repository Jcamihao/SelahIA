import { GenerateVeloSupportResponseDto } from './dto/generate-velo-support-response.dto';

const listBlock = (title: string, items?: string[]) => {
  const normalizedItems = (items || [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  if (!normalizedItems.length) {
    return `${title}: nenhuma informação adicional fornecida.`;
  }

  return `${title}:\n- ${normalizedItems.join('\n- ')}`;
};

const historyBlock = (
  items?: GenerateVeloSupportResponseDto['conversationHistory'],
) => {
  const normalizedItems = (items || []).filter(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof item.role === 'string' &&
      typeof item.content === 'string' &&
      item.content.trim(),
  );

  if (!normalizedItems.length) {
    return 'Histórico recente: nenhuma mensagem anterior relevante.';
  }

  return `Histórico recente:\n${normalizedItems
    .map(
      (item) =>
        `- ${item.role === 'assistant' ? 'Assistente' : 'Usuário'}: ${String(item.content || '').trim()}`,
    )
    .join('\n')}`;
};

export const buildVeloSupportPrompt = (
  input: GenerateVeloSupportResponseDto,
) => `
Contexto do produto:
- Produto consumidor: Velo
- Função desta IA: suporte ao usuário dentro do app
- Idioma alvo: pt-BR
- Papel desta IA: explicar somente o que existe no Velo hoje e orientar o usuário dentro do produto

Sessão atual:
- Usuário autenticado: ${input.isAuthenticated ? 'sim' : 'não'}
- Role percebida: ${String(input.userRole || 'GUEST').trim() || 'GUEST'}
- Tela de origem: ${String(input.screenLabel || 'não informada').trim() || 'não informada'}
- Rota de origem: ${String(input.currentRoute || 'não informada').trim() || 'não informada'}

Contexto resumido vindo do Velo:
${String(input.supportContextSummary || 'nenhum contexto adicional informado.').trim()}

${listBlock('Catálogo oficial de funcionalidades do Velo', input.featureCatalog)}

${historyBlock(input.conversationHistory)}

Pergunta atual do usuário:
${String(input.message || '').trim()}

Regras obrigatórias:
- Responda somente dentro do contexto do Velo e do que o app realmente entrega hoje.
- Nunca invente funcionalidade, política, integração ou fluxo que não esteja no catálogo ou no contexto recebido.
- Se o usuário perguntar sobre algo que ainda não existe no app, deixe isso explícito.
- Se o usuário perguntar algo fora do escopo do produto, diga que você só atende suporte do Velo.
- Não diga que tem acesso ao código-fonte. Apenas responda como suporte do produto.
- Seja acolhedor, direto e prático.
- Prefira orientar com passos curtos dentro do app.
- Se faltar contexto para afirmar algo com segurança, admita a limitação.
- suggestedActions deve trazer ações curtas e úteis ao usuário, não títulos genéricos.
- disclaimer deve ser usado somente quando houver limitação importante ou indisponibilidade; caso contrário, retorne null.
`.trim();
