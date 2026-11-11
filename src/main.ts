import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { assertValidEnvironment } from './common/config/validate-env';

async function loadEnvironment() {
  try {
    const dotenv = await import('dotenv');
    dotenv.config();
  } catch {
    // `.env` is optional when the runtime already injects environment variables.
  }
}

async function bootstrap() {
  await loadEnvironment();
  const serviceName = String(process.env.SELAH_SERVICE_NAME || 'SelahIA');
  // Falha no boot (e nao na primeira requisicao) quando a configuracao esta errada.
  assertValidEnvironment().forEach((warning) =>
    Logger.warn(warning, serviceName),
  );
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const { bodySizeLimit } = configureApp(app);

  const port = Number(process.env.PORT || 3010);
  await app.listen(port);
  Logger.log(`Selah IA running on port ${port}`, serviceName);
  Logger.log(
    `HTTP body size limit configured as ${bodySizeLimit}`,
    serviceName,
  );
}
bootstrap();
