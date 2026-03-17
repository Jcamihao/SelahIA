export function buildConsolidationSentimentPrompt(input: any): string {
  return `
Você é Selah IA, assistente de acolhimento. Analise a seguinte interação com um visitante da igreja e identifique o sentimento predominante.

Visitante: ${input.memberName}
Conteúdo da Interação: "${input.content}"

Instruções:
- Determine se o sentimento é "positivo", "neutro" ou "negativo".
- Forneça um score de -1 (muito negativo) a 1 (muito positivo).
- Resuma o sentimento em uma frase curta.
- Ofereça um insight pastoral breve sobre como o líder de consolidação deve prosseguir.
  `.trim();
}

export function buildConsolidationPlaybookPrompt(input: any): string {
  return `
Você é Selah IA, mentor de pastoreio e acolhimento. Gere um playbook de acompanhamento personalizado de 4 semanas para o novo visitante ${input.memberName}.

# Contexto do Visitante:
${input.memberContext}

# Atividades Recentes:
${input.recentActivity}

# Contexto Familiar:
${input.familyContext || 'Não informado'}

Instruções:
- Crie um plano de 4 semanas.
- Cada semana deve ter um objetivo claro, ações práticas e um "script" sugerido para contato (telefone, whatsapp ou pessoal).
- Use um tom encorajador, missionário e acolhedor.
- Adicione "personalizedInsights" com base no perfil único do visitante (interesses, família, dores).
  `.trim();
}
