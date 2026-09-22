import { Module } from '@nestjs/common';
import { CapabilitiesModule } from '../../capabilities/capabilities.module';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';
import { ProvidersModule } from '../../providers/providers.module';
import { AgilisWorkspaceAiController } from './workspace/workspace-ai.controller';
import { AgilisWorkspaceAiService } from './workspace/workspace-ai.service';

@Module({
  imports: [CapabilitiesModule, ProvidersModule],
  controllers: [AgilisWorkspaceAiController],
  providers: [AgilisWorkspaceAiService, InternalApiKeyGuard],
})
export class AgilisModule {}
