import { Module } from '@nestjs/common';
import { CapabilitiesModule } from '../../capabilities/capabilities.module';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';
import { ProvidersModule } from '../../providers/providers.module';
import { LumenLifeAssistantController } from './life-assistant/lumen-life-assistant.controller';
import { LumenLifeAssistantService } from './life-assistant/lumen-life-assistant.service';

@Module({
  imports: [CapabilitiesModule, ProvidersModule],
  controllers: [LumenLifeAssistantController],
  providers: [LumenLifeAssistantService, InternalApiKeyGuard],
})
export class LumenModule {}
