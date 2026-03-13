import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../../common/auth/internal-api-key.guard';
import { GeneratePraiseAppKidsLessonPlanDto } from './dto/generate-praiseapp-kids-lesson-plan.dto';
import { GeneratePraiseAppKidsCheckinDailySummaryDto } from './dto/generate-praiseapp-kids-checkin-daily-summary.dto';
import { GeneratePraiseAppKidsNextSequenceDto } from './dto/generate-praiseapp-kids-next-sequence.dto';
import { GeneratePraiseAppKidsWeeklyVerseExpansionDto } from './dto/generate-praiseapp-kids-weekly-verse-expansion.dto';
import { GeneratePraiseAppKidsOperationalAssistantDto } from './dto/generate-praiseapp-kids-operational-assistant.dto';
import { GeneratePraiseAppKidsAgeAdaptationsDto } from './dto/generate-praiseapp-kids-age-adaptations.dto';
import { KidsAiService } from './kids-ai.service';

@UseGuards(InternalApiKeyGuard)
@Controller('v1/adapters/praiseapp/kids')
export class KidsAiController {
  constructor(private readonly kidsAiService: KidsAiService) {}

  @Post('lesson-plan/generate')
  @HttpCode(200)
  async generateLessonPlan(
    @Body() dto: GeneratePraiseAppKidsLessonPlanDto,
  ) {
    const response = await this.kidsAiService.generateLessonPlan(dto);
    return {
      message: 'Sugestão de aula gerada com Selah IA.',
      response,
    };
  }

  @Post('checkins/daily-summary')
  @HttpCode(200)
  async generateDailyCheckinSummary(
    @Body() dto: GeneratePraiseAppKidsCheckinDailySummaryDto,
  ) {
    const response = await this.kidsAiService.generateDailyCheckinSummary(dto);
    return {
      message: 'Resumo diário de check-in gerado com Selah IA.',
      response,
    };
  }

  @Post('lesson-plan/next-sequence')
  @HttpCode(200)
  async generateNextSequence(@Body() dto: GeneratePraiseAppKidsNextSequenceDto) {
    const response = await this.kidsAiService.generateNextSequence(dto);
    return {
      message: 'Sequência pedagógica sugerida com Selah IA.',
      response,
    };
  }

  @Post('weekly-verse/expand')
  @HttpCode(200)
  async expandWeeklyVerse(
    @Body() dto: GeneratePraiseAppKidsWeeklyVerseExpansionDto,
  ) {
    const response = await this.kidsAiService.expandWeeklyVerse(dto);
    return {
      message: 'Expansão do versículo gerada com Selah IA.',
      response,
    };
  }

  @Post('lesson-plan/operational-assistant')
  @HttpCode(200)
  async generateOperationalAssistant(
    @Body() dto: GeneratePraiseAppKidsOperationalAssistantDto,
  ) {
    const response = await this.kidsAiService.generateOperationalAssistant(dto);
    return {
      message: 'Assistente operacional gerado com Selah IA.',
      response,
    };
  }

  @Post('lesson-plan/adapt-age-ranges')
  @HttpCode(200)
  async generateAgeAdaptations(
    @Body() dto: GeneratePraiseAppKidsAgeAdaptationsDto,
  ) {
    const response = await this.kidsAiService.generateAgeAdaptations(dto);
    return {
      message: 'Adaptação por faixas etárias gerada com Selah IA.',
      response,
    };
  }
}
