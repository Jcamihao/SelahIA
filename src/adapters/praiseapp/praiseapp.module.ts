import { Module } from '@nestjs/common';
import { CapabilitiesModule } from '../../capabilities/capabilities.module';
import { KidsAiController } from './kids/kids-ai.controller';
import { KidsAiService } from './kids/kids-ai.service';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';

@Module({
  imports: [CapabilitiesModule],
  controllers: [KidsAiController],
  providers: [KidsAiService, InternalApiKeyGuard],
})
export class PraiseAppModule {}

