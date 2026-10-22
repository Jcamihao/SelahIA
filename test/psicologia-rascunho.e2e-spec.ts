import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { LLM_PROVIDER_TOKEN } from './../src/providers/provider.tokens';

describe('POST /v1/adapters/psicologia/rascunho/gerar (e2e)', () => {
  const CHAVE = 'a'.repeat(32);
  const corpo = { tipoDocumento: 'evolucao', abordagem: 'TCC', textoAnonimizado: 'texto' };
  let app: INestApplication;
  let chavesAnteriores: string | undefined;

  beforeAll(async () => {
    // Sem chaves configuradas o guard libera tudo fora de producao.
    chavesAnteriores = process.env.SELAH_APP_KEYS;
    process.env.SELAH_APP_KEYS = `NottaPsiBack:${CHAVE}`;
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LLM_PROVIDER_TOKEN)
      .useValue({
        generateStructured: jest
          .fn()
          .mockResolvedValue({ data: { rascunho: 'ok' }, text: '{}', model: 'fake', raw: {} }),
      })
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (chavesAnteriores === undefined) {
      delete process.env.SELAH_APP_KEYS;
    } else {
      process.env.SELAH_APP_KEYS = chavesAnteriores;
    }
    await app.close();
  });

  it('rejeita chamada sem x-selah-api-key valida', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/adapters/psicologia/rascunho/gerar')
      .send(corpo);
    expect(response.status).toBe(401);
  });

  it('aceita a chave NottaPsiBack e devolve o rascunho', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/adapters/psicologia/rascunho/gerar')
      .set('x-selah-api-key', CHAVE)
      .send(corpo);
    expect(response.status).toBe(200);
    expect(response.body.rascunho).toBe('ok');
  });
});
