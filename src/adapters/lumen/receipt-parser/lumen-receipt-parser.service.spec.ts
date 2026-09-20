import { BadGatewayException } from '@nestjs/common';
import { LumenReceiptParserService } from './lumen-receipt-parser.service';
import { buildLumenReceiptParserPrompt } from './lumen-receipt-parser.prompt';
import { validateLumenReceiptParseResponse } from './lumen-receipt-parser.schemas';

const input = {
  fileName: 'nota.jpg',
  mimeType: 'image/jpeg',
  imageBase64: 'aGVsbG8=',
  preferredCurrency: 'BRL',
  knownCategories: ['Alimentacao', 'Limpeza'],
};

const completeReceipt = {
  merchant: 'Mercado Bom Preco',
  merchantTaxId: '12345678000199',
  doc: '000123',
  documentType: 'NFC-e',
  accessKey: null,
  date: '2026-09-18',
  total: 42.5,
  subtotal: 42.5,
  tax: null,
  currency: 'BRL',
  confidence: 'high',
  qrCodeDetected: false,
  qrCodeText: null,
  notes: [],
  rawText: null,
  purchaseSummary: 'Compra de mercado.',
  purchaseMission: null,
  spendingSignals: [],
  followUpActions: [],
  items: [
    { name: 'Arroz 5kg', qty: 1, unit: 25, total: 25, category: 'Alimentacao' },
    { name: 'Detergente', qty: 2, unit: 8.75, total: 17.5, category: 'Limpeza' },
  ],
};

const createService = (responses: string[]) => {
  const generateTextFromContents = jest.fn();
  responses.forEach((text) =>
    generateTextFromContents.mockResolvedValueOnce({ text, model: 'test-model' }),
  );
  const service = new LumenReceiptParserService(
    { generateTextFromContents } as any,
    { getRequestId: () => 'test-request' } as any,
  );
  return { service, generateTextFromContents };
};

describe('LumenReceiptParserService', () => {
  it('parses a complete receipt in a single call and normalizes fields', async () => {
    const { service, generateTextFromContents } = createService([
      JSON.stringify(completeReceipt),
    ]);

    const result = await service.parse(input as any);

    expect(generateTextFromContents).toHaveBeenCalledTimes(1);
    expect(result.merchantName).toBe('Mercado Bom Preco');
    expect(result.merchantTaxId).toBe('12.345.678/0001-99');
    expect(result.documentType).toBe('nfce');
    expect(result.totalAmount).toBe(42.5);
    expect(result.items).toHaveLength(2);
    expect(result.provider).toBe('gemini-developer-api');
    expect(result.model).toBe('test-model');
  });

  it('sends the image inline together with the prompt', async () => {
    const { service, generateTextFromContents } = createService([
      JSON.stringify(completeReceipt),
    ]);

    await service.parse(input as any);

    const parts = generateTextFromContents.mock.calls[0][0].contents[0].parts;
    expect(parts[0].text).toContain('Produto: LUMEN');
    expect(parts[1].inline_data).toEqual({
      mime_type: 'image/jpeg',
      data: 'aGVsbG8=',
    });
  });

  it('retries with the merchant/items focus when the first pass is incomplete and merges both', async () => {
    const weakFirstPass = {
      ...completeReceipt,
      merchant: null,
      documentType: null,
      items: [],
      confidence: 'low',
    };
    const { service, generateTextFromContents } = createService([
      JSON.stringify(weakFirstPass),
      JSON.stringify(completeReceipt),
    ]);

    const result = await service.parse(input as any);

    expect(generateTextFromContents).toHaveBeenCalledTimes(2);
    const retryPrompt =
      generateTextFromContents.mock.calls[1][0].contents[0].parts[0].text;
    expect(retryPrompt).toContain('Modo de releitura');
    expect(result.merchantName).toBe('Mercado Bom Preco');
    expect(result.items).toHaveLength(2);
    expect(result.confidence).toBe('high');
  });

  it('accepts JSON wrapped in a markdown fence', async () => {
    const { service } = createService([
      '```json\n' + JSON.stringify(completeReceipt) + '\n```',
    ]);

    const result = await service.parse(input as any);

    expect(result.merchantName).toBe('Mercado Bom Preco');
  });

  it('fails with a bad gateway error when the model returns no JSON', async () => {
    const { service } = createService(['nao consegui ler a imagem']);

    await expect(service.parse(input as any)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});

describe('validateLumenReceiptParseResponse', () => {
  it('rejects a payload without a valid total', () => {
    expect(() => validateLumenReceiptParseResponse({ items: [] })).toThrow(
      'totalAmount',
    );
    expect(() =>
      validateLumenReceiptParseResponse({ total: -5, items: [] }),
    ).toThrow('totalAmount');
  });

  it('maps confidence given as words or numbers, defaulting to medium', () => {
    const confidenceOf = (confidence: unknown) =>
      validateLumenReceiptParseResponse({ total: 1, confidence }).confidence;

    expect(confidenceOf('alta')).toBe('high');
    expect(confidenceOf('baixa')).toBe('low');
    expect(confidenceOf(0.9)).toBe('high');
    expect(confidenceOf(0.5)).toBe('medium');
    expect(confidenceOf(20)).toBe('low');
    expect(confidenceOf(85)).toBe('high');
    expect(confidenceOf('sei la')).toBe('medium');
  });

  it('formats CPF and CNPJ and keeps unrecognized tax ids as text', () => {
    const taxIdOf = (merchantTaxId: unknown) =>
      validateLumenReceiptParseResponse({ total: 1, merchantTaxId })
        .merchantTaxId;

    expect(taxIdOf('12345678000199')).toBe('12.345.678/0001-99');
    expect(taxIdOf('12345678901')).toBe('123.456.789-01');
    expect(taxIdOf('ISENTO')).toBe('ISENTO');
    expect(taxIdOf(null)).toBeNull();
  });

  it('keeps the access key only when it has at least 36 digits, trimmed to 44', () => {
    const keyOf = (accessKey: unknown) =>
      validateLumenReceiptParseResponse({ total: 1, accessKey }).accessKey;

    expect(keyOf('1234')).toBeNull();
    expect(keyOf('1'.repeat(44))).toBe('1'.repeat(44));
    expect(keyOf('1'.repeat(50))).toBe('1'.repeat(44));
  });

  it('drops nameless items, cleans leading codes and clamps negatives to zero', () => {
    const result = validateLumenReceiptParseResponse({
      total: 10,
      items: [
        { name: '  ', qty: 1, total: 1 },
        { total: 5 },
        { name: '00123  Leite   integral', qty: -2, unit: 4, total: -8 },
      ],
    });

    expect(result.items).toEqual([
      {
        description: 'Leite integral',
        quantity: 0,
        unitPrice: 4,
        totalPrice: 0,
        categoryHint: null,
      },
    ]);
  });

  it('normalizes document types from Brazilian fiscal vocabulary', () => {
    const typeOf = (documentType: unknown) =>
      validateLumenReceiptParseResponse({ total: 1, documentType }).documentType;

    expect(typeOf('DANFE NFC-e')).toBe('nfce');
    expect(typeOf('CF-e')).toBe('sat');
    expect(typeOf('Cupom Fiscal')).toBe('coupon');
    expect(typeOf('Comprovante')).toBe('receipt');
    expect(typeOf('')).toBeNull();
  });

  it('marks the QR code as detected when its text is present', () => {
    const result = validateLumenReceiptParseResponse({
      total: 1,
      qrCodeDetected: false,
      qrCodeText: 'https://sat.sef.sc.gov.br/nfce',
    });

    expect(result.qrCodeDetected).toBe(true);
  });
});

describe('buildLumenReceiptParserPrompt', () => {
  it('is specific to Lumen and lists the known categories and currency', () => {
    const prompt = buildLumenReceiptParserPrompt(input as any);

    expect(prompt).toContain('Produto: LUMEN');
    expect(prompt).toContain('Moeda preferida: BRL');
    expect(prompt).toContain('Alimentacao, Limpeza');
    expect(prompt).toContain('Use somente o que estiver visivel na imagem.');
    expect(prompt).not.toContain('Modo de releitura');
  });

  it('falls back to defaults when the app sends no hints', () => {
    const prompt = buildLumenReceiptParserPrompt({
      fileName: 'a.jpg',
      mimeType: 'image/jpeg',
      imageBase64: 'x',
    } as any);

    expect(prompt).toContain('Nenhuma categoria local foi enviada');
    expect(prompt).toContain('Locale sugerido: pt-BR');
  });

  it('adds the re-read block only in merchant_items mode', () => {
    expect(buildLumenReceiptParserPrompt(input as any, 'merchant_items')).toContain(
      'Modo de releitura',
    );
  });
});
