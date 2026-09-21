import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

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
  const bodySizeLimit =
    String(process.env.SELAH_BODY_SIZE_LIMIT || '').trim() || '20mb';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  // API servidor-a-servidor: nenhum navegador fala com o Selah, entao nao ha CORS.
  app.use(helmet());
  app.use(json({ limit: bodySizeLimit }));
  app.use(urlencoded({ extended: true, limit: bodySizeLimit }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.PORT || 3010);
  await app.listen(port);
  Logger.log(
    `Selah IA running on port ${port}`,
    String(process.env.SELAH_SERVICE_NAME || 'SelahIA'),
  );
  Logger.log(
    `HTTP body size limit configured as ${bodySizeLimit}`,
    String(process.env.SELAH_SERVICE_NAME || 'SelahIA'),
  );
}
bootstrap();
