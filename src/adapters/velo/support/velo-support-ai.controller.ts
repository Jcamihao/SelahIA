import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../../common/auth/internal-api-key.guard';
import { GenerateVeloSupportResponseDto } from './dto/generate-velo-support-response.dto';
import { VeloSupportAiService } from './velo-support-ai.service';

@UseGuards(InternalApiKeyGuard)
@Controller('v1/adapters/velo/support')
export class VeloSupportAiController {
  constructor(private readonly veloSupportAiService: VeloSupportAiService) {}

  @Post('chat')
  @HttpCode(200)
  async chat(@Body() dto: GenerateVeloSupportResponseDto) {
    return this.veloSupportAiService.chat(dto);
  }
}
