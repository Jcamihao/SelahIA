import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../../common/auth/internal-api-key.guard';
import { GenerateLumenLifeAssistantResponseDto } from './dto/generate-lumen-life-assistant-response.dto';
import { LumenLifeAssistantService } from './lumen-life-assistant.service';

@UseGuards(InternalApiKeyGuard)
@Controller('v1/adapters/lumen/life-assistant')
export class LumenLifeAssistantController {
  constructor(
    private readonly lumenLifeAssistantService: LumenLifeAssistantService,
  ) {}

  @Post('chat')
  @HttpCode(200)
  async chat(@Body() dto: GenerateLumenLifeAssistantResponseDto) {
    return this.lumenLifeAssistantService.chat(dto);
  }
}
