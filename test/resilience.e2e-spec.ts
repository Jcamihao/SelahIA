import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { GeminiProvider } from './../src/providers/gemini/gemini.provider';
import { ProviderUpstreamException } from './../src/providers/provider-errors';

const APP_KEY = 'a'.repeat(32);
const PROM_KEY = 'p'.repeat(32);
const ROTA = '/v1/adapters/psicologia/rascunho/gerar';
const corpo = {
  tipoDocumento: 'evolucao',
  abordagem: 'TCC',
  textoAnonimizado: 'texto',
};
const respostaOk = (totalTokens = 150) => ({
  data: { rascunho: 'ok' },
  text: '{}',
  model: 'fake',
  raw: {
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: totalTokens - 100,
      totalTokenCount: totalTokens,
    },
  },
});

// Sobe o app com o MESMO configureApp do main.ts (portao de auth, parser, trust proxy) e o
// ResilientLlmProvider real; so o GeminiProvider e falso.
const buildApp = async (
  env: Record<string, string>,
  generateStructured: jest.Mock,
) => {
  const previous: Record<string, string | undefined> = {};
  const all = {
    SELAH_APP_KEYS: `NottaPsiBack:${APP_KEY},Prometheus:${PROM_KEY}`,
    ...env,
  };
  for (const [name, value] of Object.entries(all)) {
    previous[name] = process.env[name];
    process.env[name] = value;
  }
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(GeminiProvider)
    .useValue({ generateStructured })
    .compile();
  const app = moduleFixture.createNestApplication<NestExpressApplication>({
    bodyParser: false,
  });
  configureApp(app);
  await app.init();

  return {
    app,
    close: async () => {
      await app.close();
      for (const [name, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    },
  };
};

const gerar = (app: NestExpressApplication, key = APP_KEY) =>
  request(app.getHttpServer()).post(ROTA).set('x-selah-api-key', key);

describe('portao de autenticacao antes do corpo (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof buildApp>>;
  const generateStructured = jest.fn().mockResolvedValue(respostaOk());

  beforeAll(async () => {
    ctx = await buildApp({ SELAH_BODY_SIZE_LIMIT: '1kb' }, generateStructured);
  });
  afterAll(() => ctx.close());

  const grande = { ...corpo, textoAnonimizado: 'x'.repeat(5000) };

  it('sem chave, corpo gigante e recusado com 401 sem ser lido (nao 413)', async () => {
    const response = await request(ctx.app.getHttpServer())
      .post(ROTA)
      .send(grande);
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      message: 'Invalid Selah IA API key.',
    });
  });

  it('com chave valida o limite de corpo continua valendo (413)', async () => {
    const response = await gerar(ctx.app).send(grande);
    expect(response.status).toBe(413);
  });

  it('com chave valida e corpo pequeno funciona normalmente', async () => {
    const response = await gerar(ctx.app).send(corpo);
    expect(response.status).toBe(200);
    expect(response.body.rascunho).toBe('ok');
  });

  it('/health continua aberto, sem chave', async () => {
    const response = await request(ctx.app.getHttpServer()).get('/health');
    expect(response.status).toBe(200);
  });
});

describe('metricas (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof buildApp>>;
  const generateStructured = jest.fn().mockResolvedValue(respostaOk());

  beforeAll(async () => {
    ctx = await buildApp({}, generateStructured);
  });
  afterAll(() => ctx.close());

  it('/metrics exige chave', async () => {
    const response = await request(ctx.app.getHttpServer()).get('/metrics');
    expect(response.status).toBe(401);
  });

  it('expoe requisicoes HTTP (rota pelo padrao, nao pelo path cru), chamadas e tokens do LLM', async () => {
    await gerar(ctx.app).send(corpo).expect(200);
    await request(ctx.app.getHttpServer())
      .get('/rota-que-nao-existe/123')
      .expect(404);

    const response = await request(ctx.app.getHttpServer())
      .get('/metrics')
      .set('x-selah-api-key', PROM_KEY);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    const text = response.text;
    expect(text).toContain(
      `selah_http_requests_total{app="NottaPsiBack",method="POST",route="${ROTA}",status="200"} 1`,
    );
    expect(text).toContain('route="unmatched"');
    expect(text).not.toContain('/rota-que-nao-existe');
    expect(text).toContain(
      'selah_llm_calls_total{app="NottaPsiBack",mode="structured",outcome="ok"} 1',
    );
    expect(text).toContain(
      'selah_llm_tokens_total{app="NottaPsiBack",type="total"} 150',
    );
    expect(text).toContain('selah_llm_circuit_state 0');
    expect(text).not.toContain(APP_KEY);
    expect(text).not.toContain('texto');
  });
});

describe('circuit breaker de ponta a ponta (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof buildApp>>;
  const generateStructured = jest
    .fn()
    .mockRejectedValue(new ProviderUpstreamException('falhou', true));

  beforeAll(async () => {
    ctx = await buildApp(
      { LLM_CIRCUIT_FAILURE_THRESHOLD: '2', LLM_CIRCUIT_OPEN_MS: '60000' },
      generateStructured,
    );
  });
  afterAll(() => ctx.close());

  it('502 nas falhas, depois 503 PROVIDER_UNAVAILABLE com Retry-After sem chamar o provedor', async () => {
    expect((await gerar(ctx.app).send(corpo)).status).toBe(502);
    expect((await gerar(ctx.app).send(corpo)).status).toBe(502);
    expect(generateStructured).toHaveBeenCalledTimes(2);

    const aberto = await gerar(ctx.app).send(corpo);
    expect(aberto.status).toBe(503);
    expect(aberto.body.reason).toBe('PROVIDER_UNAVAILABLE');
    expect(Number(aberto.headers['retry-after'])).toBeGreaterThan(0);
    expect(generateStructured).toHaveBeenCalledTimes(2);
  });
});

describe('teto diario de tokens de ponta a ponta (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof buildApp>>;
  const generateStructured = jest.fn().mockResolvedValue(respostaOk(150));

  beforeAll(async () => {
    ctx = await buildApp(
      { SELAH_DAILY_TOKEN_BUDGET: '100' },
      generateStructured,
    );
  });
  afterAll(() => ctx.close());

  it('200 ate estourar o teto, depois 429 com Retry-After ate a virada do dia', async () => {
    expect((await gerar(ctx.app).send(corpo)).status).toBe(200);

    const bloqueado = await gerar(ctx.app).send(corpo);
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.reason).toBe('DAILY_TOKEN_BUDGET_EXCEEDED');
    expect(Number(bloqueado.headers['retry-after'])).toBeGreaterThan(0);
    expect(generateStructured).toHaveBeenCalledTimes(1);
  });
});

describe('IP no log atras do proxy (e2e)', () => {
  let ctx: Awaited<ReturnType<typeof buildApp>>;
  const logged: string[] = [];

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation((m: any) => {
      logged.push(String(m));
    });
    ctx = await buildApp({}, jest.fn());
  });
  afterAll(async () => {
    jest.restoreAllMocks();
    await ctx.close();
  });

  it('o nginx anexa o IP real no fim do X-Forwarded-For; o que o cliente forjou antes nao vale', async () => {
    await request(ctx.app.getHttpServer())
      .get('/health')
      .set('x-forwarded-for', '6.6.6.6, 203.0.113.9')
      .expect(200);

    expect(logged.some((line) => line.includes('ip=203.0.113.9'))).toBe(true);
    expect(logged.some((line) => line.includes('6.6.6.6'))).toBe(false);
  });
});
