export type LumenReceiptParseConfidence = 'low' | 'medium' | 'high';

export interface LumenReceiptLineItem {
  description: string;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number;
  categoryHint: string | null;
}

export interface LumenReceiptParseResponse {
  merchantName: string | null;
  merchantTaxId: string | null;
  documentNumber: string | null;
  documentType: string | null;
  accessKey: string | null;
  purchaseDate: string | null;
  totalAmount: number;
  subtotalAmount: number | null;
  taxAmount: number | null;
  currency: string;
  confidence: LumenReceiptParseConfidence;
  qrCodeDetected: boolean;
  qrCodeText: string | null;
  notes: string[];
  rawTextExcerpt: string | null;
  purchaseSummary: string | null;
  purchaseMission: string | null;
  spendingSignals: string[];
  followUpActions: string[];
  items: LumenReceiptLineItem[];
}

export const LUMEN_RECEIPT_PARSE_SCHEMA = {
  type: 'object',
  required: [
    'merchant',
    'merchantTaxId',
    'doc',
    'documentType',
    'accessKey',
    'date',
    'total',
    'subtotal',
    'tax',
    'currency',
    'confidence',
    'qrCodeDetected',
    'qrCodeText',
    'notes',
    'rawText',
    'items',
  ],
  properties: {
    merchant: {
      type: ['string', 'null'],
    },
    merchantTaxId: {
      type: ['string', 'null'],
    },
    doc: {
      type: ['string', 'null'],
    },
    documentType: {
      type: ['string', 'null'],
    },
    accessKey: {
      type: ['string', 'null'],
    },
    date: {
      type: ['string', 'null'],
    },
    total: {
      type: 'number',
    },
    subtotal: {
      type: ['number', 'null'],
    },
    tax: {
      type: ['number', 'null'],
    },
    currency: {
      type: 'string',
    },
    confidence: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
    },
    qrCodeDetected: {
      type: 'boolean',
    },
    qrCodeText: {
      type: ['string', 'null'],
    },
    notes: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6,
    },
    rawText: {
      type: ['string', 'null'],
    },
    purchaseSummary: {
      type: ['string', 'null'],
    },
    purchaseMission: {
      type: ['string', 'null'],
    },
    spendingSignals: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5,
    },
    followUpActions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5,
    },
    items: {
      type: 'array',
      maxItems: 100,
      items: {
        type: 'object',
        required: ['name', 'qty', 'unit', 'total', 'category'],
        properties: {
          name: { type: 'string' },
          qty: { type: 'number' },
          unit: { type: ['number', 'null'] },
          total: { type: 'number' },
          category: { type: ['string', 'null'] },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};

export function validateLumenReceiptParseResponse(
  payload: unknown,
): LumenReceiptParseResponse {
  const p = payload as Record<string, unknown>;

  if (!p || typeof p !== 'object') {
    throw new Error('Resposta invalida do Selah IA: payload nao e um objeto.');
  }

  const confidence = normalizeReceiptConfidence(p.confidence);

  const totalAmount = Number(p.total);
  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    throw new Error('Campo obrigatorio ausente ou invalido: totalAmount');
  }

  const items = Array.isArray(p.items) ? p.items : [];

  return {
    merchantName:
      p.merchant === null || p.merchant === undefined
        ? null
        : String(p.merchant).trim() || null,
    merchantTaxId: normalizeMerchantTaxId(p.merchantTaxId),
    documentNumber:
      p.doc === null || p.doc === undefined
        ? null
        : String(p.doc).trim() || null,
    documentType: normalizeDocumentType(p.documentType),
    accessKey: normalizeAccessKey(p.accessKey),
    purchaseDate:
      p.date === null || p.date === undefined
        ? null
        : String(p.date).trim() || null,
    totalAmount,
    subtotalAmount:
      p.subtotal === null || p.subtotal === undefined
        ? null
        : Number(p.subtotal),
    taxAmount:
      p.tax === null || p.tax === undefined
        ? null
        : Number(p.tax),
    currency: String(p.currency || 'BRL').trim() || 'BRL',
    confidence,
    qrCodeDetected: Boolean(p.qrCodeDetected || normalizeQrCodeText(p.qrCodeText)),
    qrCodeText: normalizeQrCodeText(p.qrCodeText),
    notes: (Array.isArray(p.notes) ? p.notes : [])
      .filter((item): item is string => typeof item === 'string' && !!item.trim())
      .slice(0, 6),
    rawTextExcerpt:
      p.rawText === null || p.rawText === undefined
        ? null
        : String(p.rawText).trim() || null,
    purchaseSummary:
      p.purchaseSummary === null || p.purchaseSummary === undefined
        ? null
        : String(p.purchaseSummary).trim() || null,
    purchaseMission:
      p.purchaseMission === null || p.purchaseMission === undefined
        ? null
        : String(p.purchaseMission).trim() || null,
    spendingSignals: (Array.isArray(p.spendingSignals) ? p.spendingSignals : [])
      .filter((item): item is string => typeof item === 'string' && !!item.trim())
      .slice(0, 5),
    followUpActions: (Array.isArray(p.followUpActions) ? p.followUpActions : [])
      .filter((item): item is string => typeof item === 'string' && !!item.trim())
      .slice(0, 5),
    items: items
      .map((item) => item as Record<string, unknown>)
      .filter((item) => typeof item.name === 'string' && !!String(item.name).trim())
      .slice(0, 100)
      .map((item) => ({
        description: normalizeItemDescription(String(item.name).trim()),
        quantity: Math.max(0, Number(item.qty || 0) || 0),
        unitPrice:
          item.unit === null || item.unit === undefined
            ? null
            : Number(item.unit),
        totalPrice: Math.max(0, Number(item.total || 0) || 0),
        categoryHint:
          item.category === null || item.category === undefined
            ? null
            : String(item.category).trim() || null,
      })),
  };
}

function normalizeReceiptConfidence(value: unknown): LumenReceiptParseConfidence {
  const raw = value === null || value === undefined ? '' : String(value).trim().toLowerCase();

  if (raw === 'low' || raw === 'medium' || raw === 'high') {
    return raw;
  }

  if (['baixa', 'baixo', 'low confidence'].includes(raw)) {
    return 'low';
  }

  if (['media', 'média', 'medio', 'médio', 'moderate'].includes(raw)) {
    return 'medium';
  }

  if (['alta', 'alto', 'very high', 'strong'].includes(raw)) {
    return 'high';
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric <= 1) {
      if (numeric >= 0.8) {
        return 'high';
      }

      if (numeric >= 0.45) {
        return 'medium';
      }

      return 'low';
    }

    if (numeric >= 80) {
      return 'high';
    }

    if (numeric >= 45) {
      return 'medium';
    }

    return 'low';
  }

  return 'medium';
}

function normalizeMerchantTaxId(value: unknown) {
  const digits = String(value || '').replace(/\D+/g, '');

  if (digits.length === 14) {
    return digits.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    );
  }

  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }

  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeAccessKey(value: unknown) {
  const digits = String(value || '').replace(/\D+/g, '');
  return digits.length >= 36 ? digits.slice(0, 44) : null;
}

function normalizeDocumentType(value: unknown) {
  const raw = String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

  if (!raw) {
    return null;
  }

  if (raw.includes('nfce') || raw.includes('danfe') || raw.includes('nfc-e')) {
    return 'nfce';
  }

  if (raw.includes('sat') || raw.includes('cfe') || raw.includes('cf-e')) {
    return 'sat';
  }

  if (raw.includes('nfe') || raw.includes('nf-e')) {
    return 'nfe';
  }

  if (raw.includes('cupom')) {
    return 'coupon';
  }

  if (raw.includes('recibo') || raw.includes('comprovante')) {
    return 'receipt';
  }

  return raw || null;
}

function normalizeQrCodeText(value: unknown) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeItemDescription(value: string) {
  const normalized = String(value || '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\d.\-]+\s+/, '')
    .trim();

  return normalized || 'Item';
}
