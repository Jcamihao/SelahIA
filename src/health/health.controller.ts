import { Controller, Get } from '@nestjs/common';
import {
  resolveActiveLlmProvider,
  resolveActiveProviderLabel,
} from '../providers/provider-selection';

const resolveActiveProvider = () => ({
  provider: resolveActiveProviderLabel(),
  model:
    resolveActiveLlmProvider() === 'gemini'
      ? String(process.env.GEMINI_MODEL || 'gemini-2.5-flash')
      : String(process.env.OLLAMA_MODEL || 'gemma4:e4b'),
});

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
