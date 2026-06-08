import { Module } from '@nestjs/common';
import { OllamaProvider } from './ollama/ollama.provider';
import { LLM_PROVIDER_TOKEN } from './provider.tokens';

@Module({
  providers: [
    OllamaProvider,
    {
      provide: LLM_PROVIDER_TOKEN,
      useExisting: OllamaProvider,
    },
  ],
  exports: [OllamaProvider, LLM_PROVIDER_TOKEN],
})
export class ProvidersModule {}

