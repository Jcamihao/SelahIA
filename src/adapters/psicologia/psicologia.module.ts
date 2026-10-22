import { Module } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';
import { ProvidersModule } from '../../providers/providers.module';
import { RascunhoClinicoController } from './rascunho/rascunho-clinico.controller';
import { RascunhoClinicoService } from './rascunho/rascunho-clinico.service';

@Module({
  imports: [ProvidersModule],
  controllers: [RascunhoClinicoController],
  providers: [RascunhoClinicoService, InternalApiKeyGuard],
})
export class PsicologiaModule {}
