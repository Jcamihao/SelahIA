import { Controller, Get } from '@nestjs/common';

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
      provider: 'ollama',
      model: String(process.env.OLLAMA_MODEL || 'gemma4:e4b'),
    };
  }
}

