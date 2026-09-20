import { Module } from '@nestjs/common';
import { GeminiProvider } from './gemini/gemini.provider';
import { OllamaProvider } from './ollama/ollama.provider';
import { LLM_PROVIDER_TOKEN } from './provider.tokens';

@Module({
  providers: [
    OllamaProvider,
    GeminiProvider,
    {
      provide: LLM_PROVIDER_TOKEN,
      useFactory: (ollama: OllamaProvider, gemini: GeminiProvider) => {
        const selected = String(process.env.LLM_PROVIDER || 'ollama')
          .trim()
          .toLowerCase();
        return selected === 'gemini' ? gemini : ollama;
      },
      inject: [OllamaProvider, GeminiProvider],
    },
  ],
  exports: [OllamaProvider, GeminiProvider, LLM_PROVIDER_TOKEN],
})
export class ProvidersModule {}
