import { Module } from '@nestjs/common';
import { CapabilitiesModule } from '../../capabilities/capabilities.module';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';
import { ProvidersModule } from '../../providers/providers.module';
import { LumenLifeAssistantController } from './life-assistant/lumen-life-assistant.controller';
import { LumenLifeAssistantService } from './life-assistant/lumen-life-assistant.service';
import { LumenReceiptParserController } from './receipt-parser/lumen-receipt-parser.controller';
import { LumenReceiptParserService } from './receipt-parser/lumen-receipt-parser.service';

@Module({
  imports: [CapabilitiesModule, ProvidersModule],
  controllers: [LumenLifeAssistantController, LumenReceiptParserController],
  providers: [
    LumenLifeAssistantService,
    LumenReceiptParserService,
    InternalApiKeyGuard,
  ],
})
export class LumenModule {}
