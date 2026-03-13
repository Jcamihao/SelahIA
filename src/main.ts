import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
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
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'X-Requested-With',
      'X-Selah-Api-Key',
      'X-Source-App',
      'X-Request-Id',
    ],
  });
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
}
bootstrap();
