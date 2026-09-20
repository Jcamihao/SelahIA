import { Controller, Get } from '@nestjs/common';

const resolveActiveProvider = () => {
  const selected = String(process.env.LLM_PROVIDER || 'ollama')
    .trim()
    .toLowerCase();

  if (selected === 'gemini') {
    return {
      provider: 'gemini-developer-api',
      model: String(process.env.GEMINI_MODEL || 'gemini-2.5-flash'),
    };
  }

  return {
    provider: 'ollama',
    model: String(process.env.OLLAMA_MODEL || 'gemma4:e4b'),
  };
};

@Controller()
export class HealthController {
  @Get()
  root() {
    return {
      status: 'ok',
      service: String(process.env.SELAH_SERVICE_NAME || 'selah-ia'),
    };
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: String(process.env.SELAH_SERVICE_NAME || 'selah-ia'),
      ...resolveActiveProvider(),
    };
  }
}
