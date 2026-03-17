import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ConsolidationAiService } from './consolidation-ai.service';
import { InternalApiKeyGuard } from '../../../common/auth/internal-api-key.guard';

@Controller('v1/adapters/praiseapp/consolidation')
@UseGuards(InternalApiKeyGuard)
export class ConsolidationAiController {
  constructor(private readonly consolidationAiService: ConsolidationAiService) {}

  @Post('sentiment-analysis')
  async analyzeSentiment(@Body() body: any) {
    return this.consolidationAiService.analyzeSentiment(body);
  }

  @Post('playbook')
  async generatePlaybook(@Body() body: any) {
    return this.consolidationAiService.generatePlaybook(body);
  }
}
