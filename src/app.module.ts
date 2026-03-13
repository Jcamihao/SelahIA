import { Module } from '@nestjs/common';
import { PraiseAppModule } from './adapters/praiseapp/praiseapp.module';
import { HealthModule } from './health/health.module';
import { ProvidersModule } from './providers/providers.module';
import { CapabilitiesModule } from './capabilities/capabilities.module';

@Module({
  imports: [HealthModule, ProvidersModule, CapabilitiesModule, PraiseAppModule],
})
export class AppModule {}
