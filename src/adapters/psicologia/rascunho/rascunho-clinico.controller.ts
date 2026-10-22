import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../../common/auth/internal-api-key.guard';
import { GerarRascunhoDto } from './dto/gerar-rascunho.dto';
import { RascunhoClinicoService } from './rascunho-clinico.service';

@UseGuards(InternalApiKeyGuard)
@Controller('v1/adapters/psicologia/rascunho')
export class RascunhoClinicoController {
  constructor(private readonly rascunhoClinicoService: RascunhoClinicoService) {}

  @Post('gerar')
  @HttpCode(200)
  async gerar(@Body() dto: GerarRascunhoDto) {
    return this.rascunhoClinicoService.gerar(dto);
  }
}
