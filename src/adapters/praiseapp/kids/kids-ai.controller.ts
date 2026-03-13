import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../../common/auth/internal-api-key.guard';
import { GeneratePraiseAppKidsLessonPlanDto } from './dto/generate-praiseapp-kids-lesson-plan.dto';
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
}

