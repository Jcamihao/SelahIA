import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { LLM_PROVIDER_TOKEN } from './../src/providers/provider.tokens';

describe('POST /v1/adapters/psicologia/rascunho/gerar (e2e)', () => {
  const CHAVE = 'a'.repeat(32);
  const corpo = { tipoDocumento: 'evolucao', abordagem: 'TCC', textoAnonimizado: 'texto' };
  const generateStructured = jest
    .fn()
    .mockResolvedValue({ data: { rascunho: 'ok' }, text: '{}', model: 'fake', raw: {} });
  let app: INestApplication;
  let chavesAnteriores: string | undefined;

  beforeAll(async () => {
    // Sem chaves configuradas o guard libera tudo fora de producao.
    chavesAnteriores = process.env.SELAH_APP_KEYS;
    process.env.SELAH_APP_KEYS = `NottaPsiBack:${CHAVE}`;
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LLM_PROVIDER_TOKEN)
      .useValue({ generateStructured })
      .compile();
    app = moduleFixture.createNestApplication();
    // Mesmo pipe global do main.ts: sem ele o 400 do DTO nao existe no teste.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  beforeEach(() => generateStructured.mockClear());

  afterAll(async () => {
    if (chavesAnteriores === undefined) {
      delete process.env.SELAH_APP_KEYS;
    } else {
      process.env.SELAH_APP_KEYS = chavesAnteriores;
    }
    await app?.close();
  });

  it('rejeita chamada sem x-selah-api-key', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/adapters/psicologia/rascunho/gerar')
      .send(corpo);
    expect(response.status).toBe(401);
  });

  it('rejeita chamada com chave errada', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/adapters/psicologia/rascunho/gerar')
      .set('x-selah-api-key', 'b'.repeat(32))
      .send(corpo);
    expect(response.status).toBe(401);
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it('aceita a chave NottaPsiBack e devolve o rascunho com os metadados do provider', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/adapters/psicologia/rascunho/gerar')
      .set('x-selah-api-key', CHAVE)
      .send(corpo);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      rascunho: 'ok',
      model: 'fake',
      provider: expect.any(String),
      version: expect.any(String),
      generatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it.each([
    ['abordagem invalida', { abordagem: 'GESTALT' }, 'abordagem'],
    ['textoAnonimizado vazio', { textoAnonimizado: '' }, 'textoAnonimizado'],
  ])('responde 400 sem chamar o modelo: %s', async (_nome, alteracao, campo) => {
    const response = await request(app.getHttpServer())
      .post('/v1/adapters/psicologia/rascunho/gerar')
      .set('x-selah-api-key', CHAVE)
      .send({ ...corpo, ...alteracao });
    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining(campo)]),
    );
    expect(generateStructured).not.toHaveBeenCalled();
  });
});
