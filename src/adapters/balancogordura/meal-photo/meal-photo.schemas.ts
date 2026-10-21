import { BadGatewayException } from '@nestjs/common';
import { JsonSchema } from '../../../providers/llm-provider.interface';
import {
  MEAL_PHOTO_FOOD_KEYS,
  MEAL_PHOTO_FOOD_LABELS,
  MEAL_PHOTO_FOOD_PREPAROS,
  MEAL_PHOTO_PREPAROS,
} from './meal-photo.food-keys';

export const MEAL_PHOTO_STATUSES = [
  'ok',
  'precisa_esclarecer',
  'nao_e_comida',
  'qualidade_baixa',
] as const;
export const MEAL_PHOTO_QUESTION_IDS = [
  'oleo_preparo',
  'molho',
  'tempero_salada',
  'queijo_extra',
] as const;
export const MEAL_PHOTO_CONFIDENCES = ['baixa', 'media', 'alta'] as const;
export const MEAL_PHOTO_OTHER_KEY = 'outro';

const MAX_ITEMS = 12;
const MAX_QUESTIONS = 2;
const MAX_GRAMS = 3000;
const MAX_OTHER_LABEL = 80;

export type MealPhotoStatus = (typeof MEAL_PHOTO_STATUSES)[number];
export type MealPhotoPreparo = (typeof MEAL_PHOTO_PREPAROS)[number];
export type MealPhotoConfidence = (typeof MEAL_PHOTO_CONFIDENCES)[number];
export type MealPhotoQuestionId = (typeof MEAL_PHOTO_QUESTION_IDS)[number];

export interface MealPhotoItem {
  foodKey: string;
  otherLabel: string | null;
  preparo: MealPhotoPreparo;
  grams: { low: number; mid: number; high: number };
  confidence: MealPhotoConfidence;
}

export interface MealPhotoQuestion {
  id: MealPhotoQuestionId;
  itemIndex: number;
}

export interface MealPhotoResponse {
  status: MealPhotoStatus;
  items: MealPhotoItem[];
  questions: MealPhotoQuestion[];
}

// Schema ENXUTO de proposito: o Gemini recusou (400 "too many states") a versao com enum de 125
// chaves, maxItems e minimum/maximum. A lista fechada, os limites e as gramas sao impostos pelo
// prompt e, de forma estrita, por validateMealPhotoResponse.
export const MEAL_PHOTO_SCHEMA: JsonSchema = {
  type: 'object',
  required: ['status', 'items', 'questions'],
  properties: {
    status: {
      type: 'string',
      enum: [...MEAL_PHOTO_STATUSES],
      description:
        'ok = alimentos identificados; precisa_esclarecer = ha perguntas; nao_e_comida = a foto nao mostra comida; qualidade_baixa = imagem borrada, escura ou cortada demais para identificar.',
    },
    items: {
      type: 'array',
      description: 'Alimentos visiveis no prato. Vazio quando status e nao_e_comida ou qualidade_baixa.',
      items: {
        type: 'object',
        required: ['foodKey', 'otherLabel', 'preparo', 'grams', 'confidence'],
        properties: {
          foodKey: {
            type: 'string',
            description: `Chave EXATA da lista fechada do prompt, ou "${MEAL_PHOTO_OTHER_KEY}" quando o alimento nao esta na lista.`,
          },
          otherLabel: {
            type: ['string', 'null'],
            description: `Nome curto do alimento (ate ${MAX_OTHER_LABEL} caracteres) quando foodKey e "${MEAL_PHOTO_OTHER_KEY}"; null caso contrario.`,
          },
          preparo: { type: 'string', enum: [...MEAL_PHOTO_PREPAROS] },
          grams: {
            type: 'object',
            required: ['low', 'mid', 'high'],
            properties: {
              low: { type: 'number' },
              mid: { type: 'number' },
              high: { type: 'number' },
            },
            additionalProperties: false,
          },
          confidence: { type: 'string', enum: [...MEAL_PHOTO_CONFIDENCES] },
        },
        additionalProperties: false,
      },
    },
    questions: {
      type: 'array',
      description: 'Perguntas sobre gordura escondida (oleo, molho, tempero, queijo), so quando a resposta muda muito o que ha no prato.',
      items: {
        type: 'object',
        required: ['id', 'itemIndex'],
        properties: {
          id: { type: 'string', enum: [...MEAL_PHOTO_QUESTION_IDS] },
          itemIndex: { type: 'integer', description: 'Posicao do alimento em items, a partir de 0.' },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};

const FOOD_KEY_SET: ReadonlySet<string> = new Set(MEAL_PHOTO_FOOD_KEYS);

const fail = (reason: string): never => {
  throw new BadGatewayException(`Resposta da IA invalida para meal-photo: ${reason}.`);
};

const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const describeUncoveredPreparo = (foodKey: string, preparo: MealPhotoPreparo) => {
  const name = MEAL_PHOTO_FOOD_LABELS[foodKey] ?? foodKey;
  const text = preparo === 'nao_se_aplica' ? name : `${name} (${preparo})`;
  return text.slice(0, MAX_OTHER_LABEL);
};

const validateGrams = (value: unknown, index: number) => {
  if (!isRecord(value)) return fail(`gramas ausentes no item ${index}`);
  const { low, mid, high } = value;
  for (const grams of [low, mid, high]) {
    if (typeof grams !== 'number' || !Number.isFinite(grams) || grams <= 0 || grams > MAX_GRAMS) {
      return fail(`gramas fora de (0, ${MAX_GRAMS}] no item ${index}`);
    }
  }
  if (!((low as number) <= (mid as number) && (mid as number) <= (high as number))) {
    return fail(`faixa de gramas invertida no item ${index}`);
  }
  return { low: low as number, mid: mid as number, high: high as number };
};

const validateItem = (value: unknown, index: number): MealPhotoItem => {
  if (!isRecord(value)) return fail(`item ${index} nao e objeto`);

  const { foodKey, otherLabel, preparo, confidence } = value;
  const isOther = foodKey === MEAL_PHOTO_OTHER_KEY;
  if (typeof foodKey !== 'string' || (!isOther && !FOOD_KEY_SET.has(foodKey))) {
    return fail(`foodKey fora da lista no item ${index}`);
  }
  if (!oneOf(MEAL_PHOTO_CONFIDENCES, confidence)) return fail(`confianca invalida no item ${index}`);
  if (!oneOf(MEAL_PHOTO_PREPAROS, preparo)) return fail(`preparo invalido no item ${index}`);

  let label: string | null = null;
  if (isOther) {
    label = typeof otherLabel === 'string' ? otherLabel.trim() : '';
    if (label.length < 1 || label.length > MAX_OTHER_LABEL) {
      return fail(`otherLabel precisa ter de 1 a ${MAX_OTHER_LABEL} caracteres no item ${index}`);
    }
    if (confidence === 'alta') return fail(`item "outro" nao pode ter confianca alta (item ${index})`);
  } else if (!MEAL_PHOTO_FOOD_PREPAROS[foodKey]?.includes(preparo)) {
    // Preparo que a tabela do consumidor nao cobre (ex.: batata assada): em vez de derrubar a
    // refeicao inteira, o item vira "outro" e o usuario registra as calorias a mao.
    return {
      foodKey: MEAL_PHOTO_OTHER_KEY,
      otherLabel: describeUncoveredPreparo(foodKey, preparo),
      preparo,
      grams: validateGrams(value.grams, index),
      confidence: confidence === 'alta' ? 'media' : confidence,
    };
  }

  return {
    foodKey,
    otherLabel: label,
    preparo,
    grams: validateGrams(value.grams, index),
    confidence,
  };
};

const validateQuestion = (value: unknown, itemCount: number): MealPhotoQuestion => {
  if (!isRecord(value) || !oneOf(MEAL_PHOTO_QUESTION_IDS, value.id)) {
    return fail('pergunta com id fora da lista');
  }
  const { itemIndex } = value;
  if (
    typeof itemIndex !== 'number' ||
    !Number.isInteger(itemIndex) ||
    itemIndex < 0 ||
    itemIndex >= itemCount
  ) {
    return fail('pergunta aponta para item inexistente');
  }
  return { id: value.id, itemIndex };
};

export const validateMealPhotoResponse = (payload: unknown): MealPhotoResponse => {
  if (!isRecord(payload)) return fail('payload nao e objeto');

  const { status, items: rawItems, questions: rawQuestions } = payload;
  if (!oneOf(MEAL_PHOTO_STATUSES, status)) return fail('status desconhecido');
  if (!Array.isArray(rawItems)) return fail('items ausente');
  if (!Array.isArray(rawQuestions)) return fail('questions ausente');

  if (status === 'nao_e_comida' || status === 'qualidade_baixa') {
    return { status, items: [], questions: [] };
  }

  if (rawItems.length === 0) return fail('nenhum alimento identificado');
  if (rawItems.length > MAX_ITEMS) return fail(`mais de ${MAX_ITEMS} itens`);
  if (rawQuestions.length > MAX_QUESTIONS) return fail(`mais de ${MAX_QUESTIONS} perguntas`);

  const items = rawItems.map(validateItem);
  const questions = rawQuestions.map((question) => validateQuestion(question, items.length));

  return {
    status: questions.length > 0 ? 'precisa_esclarecer' : status,
    items,
    questions,
  };
};
