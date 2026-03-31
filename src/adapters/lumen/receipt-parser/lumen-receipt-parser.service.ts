import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { RequestContextService } from '../../../common/logging/request-context.service';
import { GeminiProvider } from '../../../providers/gemini/gemini.provider';
import { ParseLumenReceiptDto } from './dto/parse-lumen-receipt.dto';
import { buildLumenReceiptParserPrompt } from './lumen-receipt-parser.prompt';
import {
  LumenReceiptParseResponse,
  validateLumenReceiptParseResponse,
} from './lumen-receipt-parser.schemas';

@Injectable()
export class LumenReceiptParserService {
  private readonly logger = new Logger(LumenReceiptParserService.name);

  constructor(
    private readonly geminiProvider: GeminiProvider,
    private readonly requestContext: RequestContextService,
  ) {}

  private responseMeta(model: string) {
    return {
      provider: 'gemini-developer-api',
      version: String(process.env.SELAH_PUBLIC_VERSION || 'v1').trim() || 'v1',
      model,
      generatedAt: new Date().toISOString(),
    };
  }

  async parse(
    input: ParseLumenReceiptDto,
  ): Promise<
    {
      provider: string;
      version: string;
      model: string;
      generatedAt: string;
    } & LumenReceiptParseResponse
  > {
    const requestId = this.requestContext.getRequestId();
    const baseContents = [
      {
        parts: [
          {
            text: buildLumenReceiptParserPrompt(input),
          },
          {
            inline_data: {
              mime_type: input.mimeType,
              data: input.imageBase64,
            },
          },
        ],
      },
    ];

    this.logger.log(
      `[${requestId}] Lumen receipt parser started file="${String(input.fileName || '').trim() || 'unknown'}" mime=${String(input.mimeType || '').trim() || 'unknown'}`,
    );

    const result = await this.geminiProvider.generateTextFromContents({
      systemInstruction:
        'Voce e Selah IA, motor multimodal do LUMEN para leitura de notas fiscais e comprovantes. Extraia dados somente da imagem enviada e responda em JSON valido, sem markdown e sem comentarios extras fora do objeto JSON.',
      contents: baseContents,
      temperature: 0.05,
      topP: 0.8,
      maxOutputTokens: 2200,
      thinkingBudget: 0,
      promptChars:
        String(input.fileName || '').length +
        String(input.mimeType || '').length +
        String(input.imageBase64 || '').length,
    });
    const parsed = this.parseJsonCandidate(result.text);
    let data = validateLumenReceiptParseResponse(parsed);

    if (this.shouldRetryForDetails(data)) {
      this.logger.log(
        `[${requestId}] Lumen receipt parser retrying with brazilian merchant/items focus`,
      );

      const retryResult = await this.geminiProvider.generateTextFromContents({
        systemInstruction:
          'Voce e Selah IA, especialista em notas fiscais brasileiras. Responda somente com JSON valido. Priorize identificar estabelecimento, CNPJ, QR Code, chave de acesso, tipo do documento e itens reais da compra.',
        contents: [
          {
            parts: [
              {
                text: buildLumenReceiptParserPrompt(input, 'merchant_items'),
              },
              {
                inline_data: {
                  mime_type: input.mimeType,
                  data: input.imageBase64,
                },
              },
            ],
          },
        ],
        temperature: 0.02,
        topP: 0.75,
        maxOutputTokens: 2200,
        thinkingBudget: 0,
        promptChars:
          String(input.fileName || '').length +
          String(input.mimeType || '').length +
          String(input.imageBase64 || '').length,
      });

      const retryParsed = this.parseJsonCandidate(retryResult.text);
      const retryData = validateLumenReceiptParseResponse(retryParsed);
      data = this.pickBetterResult(data, retryData);
    }

    this.logger.log(
      `[${requestId}] Lumen receipt parser completed merchant="${data.merchantName || 'unknown'}" items=${data.items.length} confidence=${data.confidence} documentType=${data.documentType || 'unknown'} qr=${data.qrCodeDetected ? 'yes' : 'no'}`,
    );

    return {
      ...this.responseMeta(result.model),
      ...data,
    };
  }

  private parseJsonCandidate(text: string) {
    try {
      return JSON.parse(text);
    } catch (_error) {
      const normalized = String(text || '').trim();
      const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const candidate = fencedMatch?.[1]?.trim() || normalized;
      const firstObjectIndex = candidate.indexOf('{');
      const lastObjectIndex = candidate.lastIndexOf('}');

      if (firstObjectIndex !== -1 && lastObjectIndex > firstObjectIndex) {
        try {
          return JSON.parse(candidate.slice(firstObjectIndex, lastObjectIndex + 1));
        } catch (_nestedError) {
          // Falls through to the final error below.
        }
      }

      throw new BadGatewayException(
        'Gemini retornou um JSON invalido para leitura de nota fiscal.',
      );
    }
  }

  private shouldRetryForDetails(data: LumenReceiptParseResponse) {
    return !data.merchantName || data.items.length === 0 || !data.documentType;
  }

  private pickBetterResult(
    primary: LumenReceiptParseResponse,
    candidate: LumenReceiptParseResponse,
  ) {
    return this.score(candidate) > this.score(primary)
      ? this.mergeReceiptData(primary, candidate)
      : this.mergeReceiptData(candidate, primary);
  }

  private mergeReceiptData(
    weaker: LumenReceiptParseResponse,
    stronger: LumenReceiptParseResponse,
  ): LumenReceiptParseResponse {
    return {
      merchantName: stronger.merchantName || weaker.merchantName,
      merchantTaxId: stronger.merchantTaxId || weaker.merchantTaxId,
      documentNumber: stronger.documentNumber || weaker.documentNumber,
      documentType: stronger.documentType || weaker.documentType,
      accessKey: stronger.accessKey || weaker.accessKey,
      purchaseDate: stronger.purchaseDate || weaker.purchaseDate,
      totalAmount: stronger.totalAmount || weaker.totalAmount,
      subtotalAmount: stronger.subtotalAmount ?? weaker.subtotalAmount,
      taxAmount: stronger.taxAmount ?? weaker.taxAmount,
      currency: stronger.currency || weaker.currency,
      confidence:
        this.scoreConfidence(stronger.confidence) >= this.scoreConfidence(weaker.confidence)
          ? stronger.confidence
          : weaker.confidence,
      qrCodeDetected: stronger.qrCodeDetected || weaker.qrCodeDetected,
      qrCodeText: stronger.qrCodeText || weaker.qrCodeText,
      notes: Array.from(new Set([...stronger.notes, ...weaker.notes])).slice(0, 6),
      rawTextExcerpt: stronger.rawTextExcerpt || weaker.rawTextExcerpt,
      items: stronger.items.length ? stronger.items : weaker.items,
    };
  }

  private score(data: LumenReceiptParseResponse) {
    return (
      (data.merchantName ? 3 : 0) +
      (data.merchantTaxId ? 2 : 0) +
      (data.documentType ? 2 : 0) +
      (data.accessKey ? 2 : 0) +
      (data.qrCodeDetected ? 1 : 0) +
      Math.min(data.items.length, 8) * 2 +
      this.scoreConfidence(data.confidence)
    );
  }

  private scoreConfidence(confidence: LumenReceiptParseResponse['confidence']) {
    if (confidence === 'high') {
      return 3;
    }

    if (confidence === 'medium') {
      return 2;
    }

    return 1;
  }
}
