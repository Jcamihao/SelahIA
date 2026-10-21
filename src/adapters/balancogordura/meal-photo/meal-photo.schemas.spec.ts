import 'reflect-metadata';
import { BadGatewayException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AnalyzeMealPhotoDto } from './dto/analyze-meal-photo.dto';
import {
  MEAL_PHOTO_FOOD_KEYS,
  MEAL_PHOTO_FOOD_LABELS,
  MEAL_PHOTO_FOOD_PREPAROS,
} from './meal-photo.food-keys';
import { MEAL_PHOTO_SCHEMA, validateMealPhotoResponse } from './meal-photo.schemas';

const KEY = MEAL_PHOTO_FOOD_KEYS[0];
const KEY_PREPARO = MEAL_PHOTO_FOOD_PREPAROS[KEY][0];
const INVENTED_KEY = 'chave_inventada_xyz';

const item = (overrides: Record<string, unknown> = {}) => ({
  foodKey: KEY,
  otherLabel: null,
  preparo: KEY_PREPARO,
  grams: { low: 80, mid: 120, high: 160 },
  confidence: 'media',
  ...overrides,
});

const response = (overrides: Record<string, unknown> = {}) => ({
  status: 'ok',
  items: [item()],
  questions: [],
  ...overrides,
});

describe('validateMealPhotoResponse', () => {
  it('aceita resposta valida e devolve o objeto, nunca boolean', () => {
    const result = validateMealPhotoResponse(response());

    expect(typeof result).toBe('object');
    expect(result.status).toBe('ok');
    expect(result.items).toEqual([item()]);
    expect(result.questions).toEqual([]);
  });

  it('rejeita foodKey fora da lista (Review Focus 4)', () => {
    expect(() =>
      validateMealPhotoResponse(response({ items: [item({ foodKey: INVENTED_KEY })] })),
    ).toThrow(BadGatewayException);
  });

  it('aceita foodKey "outro" com otherLabel e confianca menor que alta', () => {
    const result = validateMealPhotoResponse(
      response({
        items: [
          item({
            foodKey: 'outro',
            otherLabel: '  prato tipico regional  ',
            preparo: 'cozido',
            confidence: 'baixa',
          }),
        ],
      }),
    );

    expect(result.items[0].foodKey).toBe('outro');
    expect(result.items[0].otherLabel).toBe('prato tipico regional');
  });

  it('"outro" sem otherLabel e rejeitado', () => {
    for (const otherLabel of [null, '', '   ']) {
      expect(() =>
        validateMealPhotoResponse(
          response({ items: [item({ foodKey: 'outro', otherLabel, confidence: 'baixa' })] }),
        ),
      ).toThrow(BadGatewayException);
    }
  });

  it('"outro" com otherLabel acima de 80 caracteres ou confianca alta e rejeitado', () => {
    expect(() =>
      validateMealPhotoResponse(
        response({
          items: [item({ foodKey: 'outro', otherLabel: 'x'.repeat(81), confidence: 'baixa' })],
        }),
      ),
    ).toThrow(BadGatewayException);
    expect(() =>
      validateMealPhotoResponse(
        response({
          items: [item({ foodKey: 'outro', otherLabel: 'sopa de abobora', confidence: 'alta' })],
        }),
      ),
    ).toThrow(BadGatewayException);
  });

  it('descarta otherLabel quando o alimento e da lista', () => {
    const result = validateMealPhotoResponse(
      response({ items: [item({ otherLabel: 'texto solto do modelo' })] }),
    );

    expect(result.items[0].otherLabel).toBeNull();
  });

  describe('preparo fora dos permitidos para o alimento (decisao B)', () => {
    const forbiddenFor = (key: string) =>
      ['grelhado', 'frito', 'cozido', 'cru', 'refogado', 'empanado', 'assado'].find(
        (p) => !MEAL_PHOTO_FOOD_PREPAROS[key].includes(p),
      ) as string;

    it('vira "outro" com o nome do alimento e o preparo, sem derrubar a resposta', () => {
      const forbidden = forbiddenFor(KEY);

      const result = validateMealPhotoResponse(
        response({ items: [item({ preparo: forbidden, confidence: 'alta' })] }),
      );

      expect(forbidden).toBeDefined();
      expect(result.status).toBe('ok');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].foodKey).toBe('outro');
      expect(result.items[0].otherLabel).toContain(`(${forbidden})`);
      expect(result.items[0].otherLabel).toContain(MEAL_PHOTO_FOOD_LABELS[KEY]);
      expect(result.items[0].preparo).toBe(forbidden);
      expect(result.items[0].grams).toEqual({ low: 80, mid: 120, high: 160 });
    });

    it('rebaixa a confianca "alta" para "media" e mantem "baixa" e "media"', () => {
      const forbidden = forbiddenFor(KEY);
      const confidenceOf = (confidence: string) =>
        validateMealPhotoResponse(
          response({ items: [item({ preparo: forbidden, confidence })] }),
        ).items[0].confidence;

      expect(confidenceOf('alta')).toBe('media');
      expect(confidenceOf('media')).toBe('media');
      expect(confidenceOf('baixa')).toBe('baixa');
    });

    it('mantem os outros itens intactos e a posicao de cada um (itemIndex continua valido)', () => {
      const result = validateMealPhotoResponse(
        response({
          items: [item(), item({ preparo: forbiddenFor(KEY) }), item()],
          questions: [{ id: 'oleo_preparo', itemIndex: 1 }],
        }),
      );

      expect(result.items.map((i) => i.foodKey)).toEqual([KEY, 'outro', KEY]);
      expect(result.items[0]).toEqual(item());
      expect(result.items[2]).toEqual(item());
      expect(result.status).toBe('precisa_esclarecer');
      expect(result.questions).toEqual([{ id: 'oleo_preparo', itemIndex: 1 }]);
    });

    it('nao repete o preparo "nao_se_aplica" no nome e respeita o limite de 80 caracteres', () => {
      const withoutNa = MEAL_PHOTO_FOOD_KEYS.find(
        (k) => !MEAL_PHOTO_FOOD_PREPAROS[k].includes('nao_se_aplica'),
      ) as string;
      const result = validateMealPhotoResponse(
        response({ items: [item({ foodKey: withoutNa, preparo: 'nao_se_aplica' })] }),
      );

      expect(result.items[0].foodKey).toBe('outro');
      expect(result.items[0].otherLabel).toBe(MEAL_PHOTO_FOOD_LABELS[withoutNa]);
      for (const i of result.items) {
        expect((i.otherLabel ?? '').length).toBeLessThanOrEqual(80);
      }
    });

    it('preparo permitido continua passando sem alteracao', () => {
      const result = validateMealPhotoResponse(response());

      expect(result.items[0].foodKey).toBe(KEY);
      expect(result.items[0].preparo).toBe(KEY_PREPARO);
    });
  });

  it('rejeita preparo que nem esta na lista geral, inclusive para "outro"', () => {
    expect(() =>
      validateMealPhotoResponse(response({ items: [item({ preparo: 'flambado' })] })),
    ).toThrow(BadGatewayException);
    expect(() =>
      validateMealPhotoResponse(
        response({
          items: [item({ foodKey: 'outro', otherLabel: 'x', preparo: 'flambado', confidence: 'baixa' })],
        }),
      ),
    ).toThrow(BadGatewayException);
  });

  it('rejeita gramas 0, negativas ou acima de 3000', () => {
    const bad = [
      { low: 0, mid: 100, high: 150 },
      { low: -5, mid: 100, high: 150 },
      { low: 10, mid: 0, high: 150 },
      { low: 100, mid: 3001, high: 3500 },
      { low: 100, mid: 200, high: 50000 },
      { low: Number.NaN, mid: 100, high: 150 },
    ];

    for (const grams of bad) {
      expect(() =>
        validateMealPhotoResponse(response({ items: [item({ grams })] })),
      ).toThrow(BadGatewayException);
    }
  });

  it('rejeita gramas que nao sao numero', () => {
    expect(() =>
      validateMealPhotoResponse(
        response({ items: [item({ grams: { low: '80', mid: 120, high: 160 } })] }),
      ),
    ).toThrow(BadGatewayException);
  });

  it('rejeita faixa invertida (low > mid ou mid > high)', () => {
    for (const grams of [
      { low: 200, mid: 100, high: 300 },
      { low: 50, mid: 300, high: 100 },
    ]) {
      expect(() =>
        validateMealPhotoResponse(response({ items: [item({ grams })] })),
      ).toThrow(BadGatewayException);
    }
  });

  it('aceita faixa com valores iguais', () => {
    const result = validateMealPhotoResponse(
      response({ items: [item({ grams: { low: 100, mid: 100, high: 100 } })] }),
    );

    expect(result.items[0].grams).toEqual({ low: 100, mid: 100, high: 100 });
  });

  it('rejeita mais de 12 itens', () => {
    expect(() =>
      validateMealPhotoResponse(response({ items: Array.from({ length: 13 }, () => item()) })),
    ).toThrow(BadGatewayException);
    expect(
      validateMealPhotoResponse(response({ items: Array.from({ length: 12 }, () => item()) })).items,
    ).toHaveLength(12);
  });

  it('rejeita mais de 2 perguntas', () => {
    const questions = [
      { id: 'oleo_preparo', itemIndex: 0 },
      { id: 'molho', itemIndex: 0 },
      { id: 'queijo_extra', itemIndex: 0 },
    ];

    expect(() => validateMealPhotoResponse(response({ questions }))).toThrow(BadGatewayException);
  });

  it('rejeita pergunta com id fora da lista e itemIndex inexistente', () => {
    expect(() =>
      validateMealPhotoResponse(response({ questions: [{ id: 'quer_sobremesa', itemIndex: 0 }] })),
    ).toThrow(BadGatewayException);
    for (const itemIndex of [1, -1, 0.5, '0']) {
      expect(() =>
        validateMealPhotoResponse(response({ questions: [{ id: 'molho', itemIndex }] })),
      ).toThrow(BadGatewayException);
    }
  });

  it('perguntas presentes normalizam o status para precisa_esclarecer', () => {
    const result = validateMealPhotoResponse(
      response({ status: 'ok', questions: [{ id: 'oleo_preparo', itemIndex: 0 }] }),
    );

    expect(result.status).toBe('precisa_esclarecer');
    expect(result.questions).toEqual([{ id: 'oleo_preparo', itemIndex: 0 }]);
  });

  it('nao_e_comida e qualidade_baixa devolvem items e perguntas vazios', () => {
    for (const status of ['nao_e_comida', 'qualidade_baixa']) {
      const result = validateMealPhotoResponse(
        response({ status, questions: [{ id: 'molho', itemIndex: 0 }] }),
      );

      expect(result.status).toBe(status);
      expect(result.items).toEqual([]);
      expect(result.questions).toEqual([]);
    }
  });

  it('status ok sem nenhum item e erro: nao ha refeicao para registrar', () => {
    expect(() => validateMealPhotoResponse(response({ items: [] }))).toThrow(BadGatewayException);
  });

  it('rejeita status desconhecido, payload que nao e objeto e campos faltando', () => {
    expect(() => validateMealPhotoResponse(response({ status: 'talvez' }))).toThrow(BadGatewayException);
    for (const payload of [null, undefined, 'texto', 42, [], true]) {
      expect(() => validateMealPhotoResponse(payload)).toThrow(BadGatewayException);
    }
    expect(() => validateMealPhotoResponse({ status: 'ok' })).toThrow(BadGatewayException);
    expect(() =>
      validateMealPhotoResponse(response({ items: [{ ...item(), confidence: 'certeza' }] })),
    ).toThrow(BadGatewayException);
  });

  it('a mensagem de erro nao repete texto vindo do modelo', () => {
    const secret = 'SEGREDO_NA_MENSAGEM';

    try {
      validateMealPhotoResponse(response({ items: [item({ foodKey: secret })] }));
      throw new Error('deveria ter lancado');
    } catch (error) {
      expect(error).toBeInstanceOf(BadGatewayException);
      expect(JSON.stringify((error as BadGatewayException).getResponse())).not.toContain(secret);
    }
  });

  it('nunca devolve campo de calorias', () => {
    const result = validateMealPhotoResponse(
      response({ items: [item({ calories: 999, kcal: 999 })], calories: 999 }),
    );

    expect(JSON.stringify(result)).not.toMatch(/calor|kcal/i);
  });
});

describe('MEAL_PHOTO_SCHEMA', () => {
  it('e leve o bastante para o Gemini: sem a lista de chaves, sem limites de array nem de numero', () => {
    // O Gemini recusou (400 "too many states") o schema com enum de 125 chaves, maxItems e minimum/maximum.
    // A lista fechada e imposta pelo prompt e por validateMealPhotoResponse.
    const itemSchema = (MEAL_PHOTO_SCHEMA as any).properties.items.items;
    const json = JSON.stringify(MEAL_PHOTO_SCHEMA);

    expect(itemSchema.properties.foodKey.enum).toBeUndefined();
    expect(itemSchema.properties.foodKey.type).toBe('string');
    expect(json).not.toContain(MEAL_PHOTO_FOOD_KEYS[0]);
    expect(json).not.toMatch(/maxItems|minimum|maximum|exclusiveMinimum/);
    expect(json.length).toBeLessThan(2500);
  });

  it('continua sem campo de calorias e mantem so enums curtos', () => {
    const itemSchema = (MEAL_PHOTO_SCHEMA as any).properties.items.items;

    expect(JSON.stringify(MEAL_PHOTO_SCHEMA)).not.toMatch(/calor|kcal/i);
    expect(itemSchema.properties.preparo.enum).toHaveLength(8);
    expect((MEAL_PHOTO_SCHEMA as any).properties.status.enum).toHaveLength(4);
  });
});

describe('AnalyzeMealPhotoDto', () => {
  const build = (overrides: Record<string, unknown> = {}) =>
    plainToInstance(AnalyzeMealPhotoDto, {
      mimeType: 'image/jpeg',
      imageBase64: 'aGVsbG8=',
      ...overrides,
    });

  it('aceita entrada valida com e sem campos opcionais', async () => {
    expect(await validate(build())).toHaveLength(0);
    expect(
      await validate(build({ mealType: 'almoco', localeHint: 'pt-BR', mimeType: 'image/webp' })),
    ).toHaveLength(0);
  });

  it('rejeita base64 invalido', async () => {
    const errors = await validate(build({ imageBase64: 'isto nao e base64 !!!' }));

    expect(errors.map((e) => e.property)).toContain('imageBase64');
  });

  it('rejeita imageBase64 acima de 2.800.000 caracteres e aceita no limite', async () => {
    const over = await validate(build({ imageBase64: 'A'.repeat(2_800_004) }));
    const limit = await validate(build({ imageBase64: 'A'.repeat(2_800_000) }));

    expect(over.map((e) => e.property)).toContain('imageBase64');
    expect(limit).toHaveLength(0);
  });

  it('rejeita mime fora da lista', async () => {
    for (const mimeType of ['image/gif', 'application/pdf', 'image/jpeg; charset=x', '']) {
      const errors = await validate(build({ mimeType }));
      expect(errors.map((e) => e.property)).toContain('mimeType');
    }
  });

  it('rejeita mealType desconhecido', async () => {
    const errors = await validate(build({ mealType: 'ceia' }));

    expect(errors.map((e) => e.property)).toContain('mealType');
  });
});
