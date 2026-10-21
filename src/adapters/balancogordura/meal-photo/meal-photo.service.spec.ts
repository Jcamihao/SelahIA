import { BadGatewayException } from '@nestjs/common';
import {
  MEAL_PHOTO_FOOD_KEYS,
  MEAL_PHOTO_FOOD_PREPAROS,
} from './meal-photo.food-keys';
import { buildMealPhotoPrompt } from './meal-photo.prompt';
import { MEAL_PHOTO_SCHEMA } from './meal-photo.schemas';
import { MealPhotoService } from './meal-photo.service';

const KEY = MEAL_PHOTO_FOOD_KEYS[0];
const PREPARO = MEAL_PHOTO_FOOD_PREPAROS[KEY][0];

const validParsed = {
  status: 'ok',
  items: [
    {
      foodKey: KEY,
      otherLabel: null,
      preparo: PREPARO,
      grams: { low: 80, mid: 120, high: 160 },
      confidence: 'media',
    },
  ],
  questions: [],
};

const input = {
  mimeType: 'image/jpeg' as const,
  imageBase64: 'aGVsbG8=',
  mealType: 'almoco' as const,
  localeHint: 'pt-BR',
};

// Espelha o contrato real do provedor: `data` e o retorno de `validate(parsed)`.
const createService = (parsed: unknown) => {
  const generateStructuredFromContents = jest.fn(async (call: any) => ({
    data: call.validate(parsed),
    text: JSON.stringify(parsed),
    model: 'test-model',
    raw: {},
  }));
  const service = new MealPhotoService(
    { generateStructuredFromContents } as any,
    { getRequestId: () => 'test-request' } as any,
  );
  return { service, generateStructuredFromContents };
};

describe('MealPhotoService', () => {
  it('chama o provedor uma vez com um conteudo que traz inline_data (mime e base64)', async () => {
    const { service, generateStructuredFromContents } = createService(validParsed);

    await service.analyze(input);

    expect(generateStructuredFromContents).toHaveBeenCalledTimes(1);
    const call = generateStructuredFromContents.mock.calls[0][0];
    const parts = call.contents[0].parts;
    expect(parts[0].text).toContain('BalancoGordura');
    expect(parts[1].inline_data).toEqual({ mime_type: 'image/jpeg', data: 'aGVsbG8=' });
    expect(call.responseSchema).toBe(MEAL_PHOTO_SCHEMA);
    expect(call.temperature).toBeLessThanOrEqual(0.2);
  });

  it('devolve a resposta validada com provider, version, model e generatedAt', async () => {
    const { service } = createService(validParsed);

    const result = await service.analyze(input);

    expect(result.provider).toEqual(expect.any(String));
    expect(result.version).toEqual(expect.any(String));
    expect(result.model).toBe('test-model');
    expect(new Date(result.generatedAt).toISOString()).toBe(result.generatedAt);
    expect(result.status).toBe('ok');
    expect(result.items).toEqual(validParsed.items);
    expect(result.questions).toEqual([]);
  });

  it('resposta com foodKey inventado vira BadGatewayException', async () => {
    const { service } = createService({
      ...validParsed,
      items: [{ ...validParsed.items[0], foodKey: 'chave_inventada_xyz' }],
    });

    await expect(service.analyze(input)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('status nao_e_comida e qualidade_baixa nao geram erro e vem sem itens', async () => {
    for (const status of ['nao_e_comida', 'qualidade_baixa']) {
      const { service } = createService({ status, items: [], questions: [] });

      const result = await service.analyze(input);

      expect(result.status).toBe(status);
      expect(result.items).toEqual([]);
    }
  });

  it('a resposta nao tem campo de calorias', async () => {
    const { service } = createService({ ...validParsed, calories: 700 });

    const result = await service.analyze(input);

    expect(JSON.stringify(result)).not.toMatch(/calor|kcal/i);
  });

  it('perguntas viram status precisa_esclarecer e mantem o itemIndex', async () => {
    const { service } = createService({
      ...validParsed,
      questions: [{ id: 'oleo_preparo', itemIndex: 0 }],
    });

    const result = await service.analyze(input);

    expect(result.status).toBe('precisa_esclarecer');
    expect(result.questions).toEqual([{ id: 'oleo_preparo', itemIndex: 0 }]);
  });
});

describe('buildMealPhotoPrompt', () => {
  it('lista todas as foodKeys da lista fechada, os preparos permitidos e as perguntas', () => {
    const prompt = buildMealPhotoPrompt({});

    for (const key of MEAL_PHOTO_FOOD_KEYS) {
      expect(prompt).toContain(key);
    }
    expect(prompt).toContain(`${KEY}`);
    expect(prompt).toContain(MEAL_PHOTO_FOOD_PREPAROS[KEY][0]);
    for (const id of ['oleo_preparo', 'molho', 'tempero_salada', 'queijo_extra']) {
      expect(prompt).toContain(id);
    }
    expect(prompt).toContain('"outro"');
  });

  it('e especifico do app: comida brasileira em prato, perguntar em vez de adivinhar, sem opiniao de saude nem calorias', () => {
    const prompt = buildMealPhotoPrompt({});

    expect(prompt).toContain('BalancoGordura');
    expect(prompt).toContain('prato');
    expect(prompt).toMatch(/pergunte em vez de adivinhar/i);
    expect(prompt).toMatch(/nao estime calorias/i);
    expect(prompt).toMatch(/nenhuma opiniao de saude/i);
    expect(prompt).toMatch(/somente json/i);
    expect(prompt).toMatch(/portugues do Brasil/i);
  });

  it('manda usar "outro" quando o preparo visto nao esta entre os permitidos, em vez de forcar um permitido', () => {
    const prompt = buildMealPhotoPrompt({});

    expect(prompt).toMatch(/preparo que voce ve nao esta entre os permitidos/i);
    expect(prompt).toMatch(/nao force/i);
    expect(prompt).not.toMatch(/escolha o permitido mais provavel/i);
  });

  it('trata texto escrito na foto como dado, nunca como instrucao', () => {
    expect(buildMealPhotoPrompt({})).toMatch(/texto.*foto.*nunca.*instrucao/is);
  });

  it('usa o tipo de refeicao so como contexto e omite o bloco quando ele nao vem', () => {
    expect(buildMealPhotoPrompt({ mealType: 'jantar' })).toContain('jantar');
    expect(buildMealPhotoPrompt({})).not.toContain('Tipo de refeicao informado');
  });
});
