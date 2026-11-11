import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { RetryAfterExceptionFilter } from './common/http/retry-after.filter';
import { AgilisModule } from './adapters/agilis/agilis.module';
import { BalancoGorduraModule } from './adapters/balancogordura/balancogordura.module';
import { LumenModule } from './adapters/lumen/lumen.module';
import { PraiseAppModule } from './adapters/praiseapp/praiseapp.module';
import { PsicologiaModule } from './adapters/psicologia/psicologia.module';
import { HealthModule } from './health/health.module';
import { ProvidersModule } from './providers/providers.module';
import { AuthModule } from './common/auth/auth.module';
import { LoggingModule } from './common/logging/logging.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { RequestLoggingMiddleware } from './common/logging/request-logging.middleware';

@Module({
  imports: [
    LoggingModule,
    MetricsModule,
    AuthModule,
    HealthModule,
    ProvidersModule,
    AgilisModule,
    BalancoGorduraModule,
    LumenModule,
    PraiseAppModule,
    PsicologiaModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: RetryAfterExceptionFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
