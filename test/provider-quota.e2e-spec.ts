import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { ProviderQuotaExceededException } from './../src/providers/provider-errors';
import { LLM_PROVIDER_TOKEN } from './../src/providers/provider.tokens';

// Cota do Gemini estourada vira 503 + Retry-After no HTTP real, nao 502.
describe('cota do provider (e2e)', () => {
  const CHAVE = 'a'.repeat(32);
  const corpo = {
    tipoDocumento: 'evolucao',
    abordagem: 'TCC',
    textoAnonimizado: 'texto',
  };
  const generateStructured = jest.fn();
  let app: INestApplication;
  let chavesAnteriores: string | undefined;

  beforeAll(async () => {
    chavesAnteriores = process.env.SELAH_APP_KEYS;
    process.env.SELAH_APP_KEYS = `NottaPsiBack:${CHAVE}`;
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LLM_PROVIDER_TOKEN)
      .useValue({ generateStructured })
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (chavesAnteriores === undefined) {
      delete process.env.SELAH_APP_KEYS;
    } else {
      process.env.SELAH_APP_KEYS = chavesAnteriores;
    }
    await app?.close();
  });

  it('responde 503 com Retry-After e corpo sem texto do upstream', async () => {
    generateStructured.mockRejectedValueOnce(
      new ProviderQuotaExceededException(30),
    );

    const response = await request(app.getHttpServer())
      .post('/v1/adapters/psicologia/rascunho/gerar')
      .set('x-selah-api-key', CHAVE)
      .send(corpo);

    expect(response.status).toBe(503);
    expect(response.headers['retry-after']).toBe('30');
    expect(response.body).toEqual({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'LLM provider quota exceeded. Retry later.',
      reason: 'PROVIDER_QUOTA_EXCEEDED',
      retryAfterSeconds: 30,
    });
  });

  it('o 429 do rate limit do Selah continua com seu Retry-After', async () => {
    const limitesAnteriores = process.env.SELAH_RATE_LIMITS;
    process.env.SELAH_RATE_LIMITS = 'NottaPsiBack:1';
    const limitedModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LLM_PROVIDER_TOKEN)
      .useValue({
        generateStructured: jest.fn().mockResolvedValue({
          data: { rascunho: 'ok' },
          text: '{}',
          model: 'fake',
          raw: {},
        }),
      })
      .compile();
    const limitedApp = limitedModule.createNestApplication();
    limitedApp.useGlobalPipes(new ValidationPipe({ transform: true }));
    await limitedApp.init();
    try {
      const send = () =>
        request(limitedApp.getHttpServer())
          .post('/v1/adapters/psicologia/rascunho/gerar')
          .set('x-selah-api-key', CHAVE)
          .send(corpo);
      expect((await send()).status).toBe(200);
      const limited = await send();
      expect(limited.status).toBe(429);
      expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    } finally {
      await limitedApp.close();
      if (limitesAnteriores === undefined) {
        delete process.env.SELAH_RATE_LIMITS;
      } else {
        process.env.SELAH_RATE_LIMITS = limitesAnteriores;
      }
    }
  });
});
