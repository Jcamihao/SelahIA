import { Module } from '@nestjs/common';
import { GeminiProvider } from './gemini/gemini.provider';
import { LLM_PROVIDER_TOKEN } from './provider.tokens';

@Module({
  providers: [
    GeminiProvider,
    {
      provide: LLM_PROVIDER_TOKEN,
      useExisting: GeminiProvider,
    },
  ],
  exports: [GeminiProvider, LLM_PROVIDER_TOKEN],
})
export class ProvidersModule {}

