import { Module } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';
import { SelahCoderAgentService } from './selah-coder-agent.service';
import { SelahCoderOllamaClient } from './selah-coder-ollama.client';
import { SelahCoderToolExecutorService } from './selah-coder-tool-executor.service';
import { SelahCoderController } from './selah-coder.controller';
import { SelahCoderUiController } from './selah-coder-ui.controller';

@Module({
  controllers: [SelahCoderController, SelahCoderUiController],
  providers: [
    SelahCoderAgentService,
    SelahCoderOllamaClient,
    SelahCoderToolExecutorService,
    InternalApiKeyGuard,
  ],
})
export class SelahCoderModule {}
