import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LumenModule } from './adapters/lumen/lumen.module';
import { PraiseAppModule } from './adapters/praiseapp/praiseapp.module';
import { HealthModule } from './health/health.module';
import { ProvidersModule } from './providers/providers.module';
import { CapabilitiesModule } from './capabilities/capabilities.module';
import { AuthModule } from './common/auth/auth.module';
import { LoggingModule } from './common/logging/logging.module';
import { RequestLoggingMiddleware } from './common/logging/request-logging.middleware';

@Module({
  imports: [
    LoggingModule,
    AuthModule,
    HealthModule,
    ProvidersModule,
    CapabilitiesModule,
    LumenModule,
    PraiseAppModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
