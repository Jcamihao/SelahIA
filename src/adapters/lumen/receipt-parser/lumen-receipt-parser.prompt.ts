import { ParseLumenReceiptDto } from './dto/parse-lumen-receipt.dto';

const categoryHintList = (input: ParseLumenReceiptDto) => {
  const categories = (input.knownCategories || [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  if (!categories.length) {
    return 'Nenhuma categoria local foi enviada pela aplicacao.';
  }

  return categories.join(', ');
};

type ReceiptPromptMode = 'default' | 'merchant_items';

const outputShape = `{
  "merchant": string | null,
  "merchantTaxId": string | null,
  "doc": string | null,
  "documentType": string | null,
  "accessKey": string | null,
  "date": string | null,
  "total": number,
  "subtotal": number | null,
  "tax": number | null,
  "currency": string,
  "confidence": "low" | "medium" | "high" | number,
  "qrCodeDetected": boolean,
  "qrCodeText": string | null,
  "notes": string[],
  "rawText": string | null,
  "purchaseSummary": string | null,
  "purchaseMission": string | null,
  "spendingSignals": string[],
  "followUpActions": string[],
  "items": [
    {
      "name": string,
      "qty": number,
      "unit": number | null,
      "total": number,
      "category": string | null
    }
  ]
}`;

const focusBlock = (mode: ReceiptPromptMode) => {
  if (mode !== 'merchant_items') {
    return '';
  }

  return `
Modo de releitura:
- Releia a imagem priorizando CABECALHO, CNPJ/CPF emitente, tipo de documento, QR Code, chave de acesso e tabela de itens.
- Em notas brasileiras, procure sequencias tipicas como: DANFE NFC-e, NFC-e, SAT, CFe, COO, CCF, CHAVE DE ACESSO, CNPJ, VALOR TOTAL, ITEM, COD, DESC, QTD, UN, VL UN, VL ITEM.
- Se houver tabela de produtos, devolva o maximo de itens confiaveis possivel.
- Nao trate linhas de pagamento, troco, cartao, bandeira ou resumo fiscal como se fossem itens.
`.trim();
};

export const buildLumenReceiptParserPrompt = (
  input: ParseLumenReceiptDto,
  mode: ReceiptPromptMode = 'default',
) => `
Contexto:
- Produto: LUMEN
- Tarefa: ler uma foto de nota fiscal, cupom ou comprovante de compra e devolver dados estruturados para registro financeiro.
- Idioma alvo: pt-BR
- Moeda preferida: ${String(input.preferredCurrency || 'BRL').trim() || 'BRL'}
- Locale sugerido: ${String(input.localeHint || 'pt-BR').trim() || 'pt-BR'}
- Arquivo: ${String(input.fileName || '').trim()}

Categorias financeiras conhecidas no app:
- ${categoryHintList(input)}

Objetivo da resposta:
- Extrair estabelecimento, data, numero do documento quando visivel, total, subtotal, tributos quando visiveis e itens da compra.
- Para cada item, extrair descricao, quantidade, valor unitario quando possivel e valor total.
- Identificar sinais tipicos de documentos brasileiros como DANFE NFC-e, SAT, CF-e, NFe, CNPJ e QR Code.
- Se houver QR Code ou URL fiscal visivel, extrair o texto legivel em qrCodeText e marcar qrCodeDetected=true.
- Se houver chave de acesso visivel, extrair os 44 digitos em accessKey.
- Montar uma leitura curta da compra em purchaseSummary, explicando o que parece ser a cesta.
- Se der para inferir a intenção principal da compra, devolver em purchaseMission algo como reposicao da casa, compra rapida, farmacia, mercado do mes, conveniencia ou null.
- spendingSignals deve listar ate 5 sinais financeiros concretos da compra, por exemplo concentracao em limpeza, gasto pulverizado, ticket alto, compra essencial ou itens sem categoria clara.
- followUpActions deve listar ate 5 proximos passos curtos e uteis para o usuario dentro do LUMEN, como revisar categoria, checar duplicidade ou observar ticket medio.
- Gerar JSON estritamente no schema solicitado.

Formato de saida esperado:
${outputShape}

Regras obrigatorias:
- Use somente o que estiver visivel na imagem.
- Nao invente campos, produtos, quantidades ou valores.
- Se um campo nao estiver legivel, devolva null ou use notes para explicar a limitacao.
- Preferir data em formato ISO yyyy-mm-dd quando possivel.
- Normalizar valores monetarios como numero decimal, sem simbolo de moeda.
- quantity deve ser numerica. Quando a quantidade nao estiver explicita, use 1.
- total de cada item deve refletir o total visivel do item ou, se so houver unitario e quantidade, o valor calculado.
- unit pode ser null se a imagem nao permitir inferencia confiavel.
- category deve ser uma sugestao curta em pt-BR como Alimentacao, Limpeza, Bebidas, Hortifruti, Higiene, Farmacia, Pet, Bebes, Casa, Eletronicos, Vestuario, Servicos ou null.
- confidence deve refletir a qualidade geral da leitura da nota.
- notes deve listar ambiguidades importantes, divergencia entre soma dos itens e total, ou campos ausentes relevantes.
- rawText deve trazer um trecho curto do texto reconhecido, sem markdown, quando isso ajudar na auditoria.
- purchaseSummary deve ser curto, claro e fiel ao que aparece na compra, sem inventar contexto externo.
- spendingSignals e followUpActions devem ser pragmáticos e úteis para controle financeiro, nunca genéricos demais.
- Foque em notas fiscais e cupons brasileiros, inclusive supermercados, farmacias e lojas.
- Ignore publicidade, rodapes irrelevantes e textos nao ligados a compra.
- merchantTaxId deve trazer CNPJ ou CPF do emitente quando visivel.
- documentType deve ser algo curto como nfce, nfe, sat, coupon, receipt ou null.
- Se houver mais de um candidato para estabelecimento, prefira o nome fantasia ou cabecalho principal.
- Para itens, prefira linhas com padrao de produto real. Ignore subtotal, total, forma de pagamento, troco, desconto geral, taxa, operadora de cartao e tributos.

${focusBlock(mode)}
`.trim();
