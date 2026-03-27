import { Module } from '@nestjs/common';
import { CapabilitiesModule } from '../../capabilities/capabilities.module';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';
import { ProvidersModule } from '../../providers/providers.module';
import { VeloSupportAiController } from './support/velo-support-ai.controller';
import { VeloSupportAiService } from './support/velo-support-ai.service';

@Module({
  imports: [CapabilitiesModule, ProvidersModule],
  controllers: [VeloSupportAiController],
  providers: [VeloSupportAiService, InternalApiKeyGuard],
})
export class VeloModule {}
