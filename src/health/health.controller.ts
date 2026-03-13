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
      provider: 'gemini-developer-api',
      model: String(process.env.GEMINI_MODEL || 'gemini-2.5-flash'),
    };
  }
}

