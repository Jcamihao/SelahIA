import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json } from 'express';
import * as request from 'supertest';
import { InternalApiKeyGuard } from '../../../common/auth/internal-api-key.guard';
import { RequestContextService } from '../../../common/logging/request-context.service';
import { LLM_PROVIDER_TOKEN } from '../../../providers/provider.tokens';
import { MEAL_PHOTO_FOOD_KEYS, MEAL_PHOTO_FOOD_PREPAROS } from './meal-photo.food-keys';
import { MealPhotoController } from './meal-photo.controller';
import { MealPhotoService } from './meal-photo.service';

const KEY = MEAL_PHOTO_FOOD_KEYS[0];
const okParsed = {
  status: 'ok',
  items: [
    {
      foodKey: KEY,
      otherLabel: null,
      preparo: MEAL_PHOTO_FOOD_PREPAROS[KEY][0],
      grams: { low: 80, mid: 120, high: 160 },
      confidence: 'media',
    },
  ],
  questions: [],
};

const body = (overrides: Record<string, unknown> = {}) => ({
  mimeType: 'image/jpeg',
  imageBase64: 'aGVsbG8=',
  mealType: 'almoco',
  localeHint: 'pt-BR',
  ...overrides,
});

describe('POST /v1/adapters/balancogordura/meal-photo/analyze', () => {
  let app: INestApplication;
  let parsedByModel: unknown;
  const generateStructuredFromContents = jest.fn(async (call: any) => ({
    data: call.validate(parsedByModel),
    text: '',
    model: 'test-model',
    raw: {},
  }));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MealPhotoController],
      providers: [
        MealPhotoService,
        { provide: LLM_PROVIDER_TOKEN, useValue: { generateStructuredFromContents } },
        { provide: RequestContextService, useValue: { getRequestId: () => 'req-http' } },
      ],
    })
      .overrideGuard(InternalApiKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication({ bodyParser: false });
    app.use(json({ limit: '20mb' }));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    parsedByModel = okParsed;
    generateStructuredFromContents.mockClear();
  });

  const post = (payload: unknown) =>
    request(app.getHttpServer()).post('/v1/adapters/balancogordura/meal-photo/analyze').send(payload as object);

  it('responde 200 com status, items e questions e sem calorias', async () => {
    const res = await post(body());

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.questions).toEqual([]);
    expect(res.body.model).toBe('test-model');
    expect(JSON.stringify(res.body)).not.toMatch(/calor|kcal/i);
  });

  it('foto invalida e 400 e o modelo nem e chamado (Review Focus 5)', async () => {
    const invalid = [
      body({ imageBase64: 'isto nao e base64 !!!' }),
      body({ imageBase64: 'A'.repeat(2_800_004) }),
      body({ mimeType: 'image/gif' }),
      body({ mimeType: undefined }),
      body({ imageBase64: undefined }),
      body({ mealType: 'ceia' }),
      body({ campoExtra: 'x' }),
    ];

    for (const payload of invalid) {
      const res = await post(payload);
      expect(res.status).toBe(400);
    }
    expect(generateStructuredFromContents).not.toHaveBeenCalled();
  });

  it('foto sem comida ou borrada e 200, nao erro', async () => {
    for (const status of ['nao_e_comida', 'qualidade_baixa']) {
      parsedByModel = { status, items: [], questions: [] };
      const res = await post(body());

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
      expect(res.body.items).toEqual([]);
    }
  });

  it('preparo fora da tabela daquele alimento vira "outro" e a resposta continua 200 com os demais itens', async () => {
    const forbidden = ['frito', 'cozido', 'cru', 'refogado', 'empanado', 'assado', 'grelhado'].find(
      (p) => !MEAL_PHOTO_FOOD_PREPAROS[KEY].includes(p),
    );
    parsedByModel = {
      ...okParsed,
      items: [okParsed.items[0], { ...okParsed.items[0], preparo: forbidden, confidence: 'alta' }],
    };

    const res = await post(body());

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].foodKey).toBe(KEY);
    expect(res.body.items[1].foodKey).toBe('outro');
    expect(res.body.items[1].confidence).toBe('media');
    expect(res.body.items[1].otherLabel).toContain(`(${forbidden})`);
  });

  it('resposta invalida do modelo (foodKey inventado) e 502, nunca 500', async () => {
    parsedByModel = {
      ...okParsed,
      items: [{ ...okParsed.items[0], foodKey: 'chave_inventada_xyz' }],
    };

    const res = await post(body());

    expect(res.status).toBe(502);
  });
});
