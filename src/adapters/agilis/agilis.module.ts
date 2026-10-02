import { Module } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';
import { ProvidersModule } from '../../providers/providers.module';
import { AgilisWorkspaceAiController } from './workspace/workspace-ai.controller';
import { AgilisWorkspaceAiService } from './workspace/workspace-ai.service';

@Module({
  imports: [ProvidersModule],
  controllers: [AgilisWorkspaceAiController],
  providers: [AgilisWorkspaceAiService, InternalApiKeyGuard],
})
export class AgilisModule {}
