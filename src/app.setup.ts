import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { ApiKeyRegistry } from './common/auth/api-key-registry.service';
import { createPreAuthGate } from './common/auth/pre-auth.gate';
import { parseTrustProxy } from './common/http/trust-proxy';

// Configuracao HTTP compartilhada entre o main.ts e os testes e2e. A ordem importa: o portao de
// autenticacao vem antes do parser de corpo. Precisa de `bodyParser: false` no NestFactory.create.
export const configureApp = (app: NestExpressApplication) => {
  const bodySizeLimit =
    String(process.env.SELAH_BODY_SIZE_LIMIT || '').trim() || '20mb';

  // SIGTERM/SIGINT (docker stop, deploy) deixam de cortar requisicoes em andamento: o Nest para de
  // aceitar conexoes novas e espera as atuais terminarem antes de sair.
  app.enableShutdownHooks();

  const trustProxy = parseTrustProxy(process.env.SELAH_TRUST_PROXY);
  if (trustProxy instanceof Error) {
    throw trustProxy;
  }
  app.set('trust proxy', trustProxy);

  // API servidor-a-servidor: nenhum navegador fala com o Selah, entao nao ha CORS.
  app.use(helmet());
  app.use(createPreAuthGate(app.get(ApiKeyRegistry)));
  app.use(json({ limit: bodySizeLimit }));
  app.use(urlencoded({ extended: true, limit: bodySizeLimit }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  return { bodySizeLimit };
};
