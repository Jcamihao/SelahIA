import { Module } from '@nestjs/common';
import { CapabilitiesModule } from '../../capabilities/capabilities.module';
import { KidsAiController } from './kids/kids-ai.controller';
import { KidsAiService } from './kids/kids-ai.service';
import { ServiceReportsAiController } from './service-reports/service-reports-ai.controller';
import { ServiceReportsAiService } from './service-reports/service-reports-ai.service';
import { ConsolidationAiController } from './consolidation/consolidation-ai.controller';
import { ConsolidationAiService } from './consolidation/consolidation-ai.service';
import { WorshipAiController } from './worship/worship-ai.controller';
import { WorshipAiService } from './worship/worship-ai.service';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';
import { ProvidersModule } from '../../providers/providers.module';

@Module({
  imports: [CapabilitiesModule, ProvidersModule],
  controllers: [
    KidsAiController,
    ServiceReportsAiController,
    ConsolidationAiController,
    WorshipAiController,
  ],
  providers: [
    KidsAiService,
    ServiceReportsAiService,
    ConsolidationAiService,
    WorshipAiService,
    InternalApiKeyGuard,
  ],
})
export class PraiseAppModule {}
