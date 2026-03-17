import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { WorshipAiService } from './worship-ai.service';
import { InternalApiKeyGuard } from '../../../common/auth/internal-api-key.guard';

@Controller('v1/adapters/praiseapp/worship')
@UseGuards(InternalApiKeyGuard)
export class WorshipAiController {
  constructor(private readonly worshipAiService: WorshipAiService) {}

  @Post('setlist-suggestion')
  async getSetlistSuggestions(@Body() body: any) {
    return this.worshipAiService.getSetlistSuggestions(body);
  }

  @Post('rehearsal-notes')
  async generateRehearsalNotes(@Body() body: any) {
    return this.worshipAiService.generateRehearsalNotes(body);
  }
}
