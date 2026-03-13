import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { ProvidersModule } from './providers/providers.module';
import { CapabilitiesModule } from './capabilities/capabilities.module';

@Module({
  imports: [HealthModule, ProvidersModule, CapabilitiesModule],
})
export class AppModule {}
