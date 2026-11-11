import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { InternalApiKeyGuard } from '../auth/internal-api-key.guard';
import { MetricsService } from './metrics.service';

// Exige X-Selah-Api-Key como as demais rotas. Prometheus: crie uma chave propria
// (ex.: SELAH_APP_KEYS=...,Prometheus:<chave>) e envie no header do scrape. O nginx de producao
// tambem nao expoe esta rota na internet (deploy/nginx/selah.conf).
@Controller('metrics')
@UseGuards(InternalApiKeyGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  scrape() {
    return this.metrics.render();
  }
}
