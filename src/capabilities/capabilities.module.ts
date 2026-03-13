import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module';
import { TextGenerationService } from './text/text-generation.service';
import { StructuredOutputService } from './structured-output/structured-output.service';

@Module({
  imports: [ProvidersModule],
  providers: [TextGenerationService, StructuredOutputService],
  exports: [TextGenerationService, StructuredOutputService],
})
export class CapabilitiesModule {}

