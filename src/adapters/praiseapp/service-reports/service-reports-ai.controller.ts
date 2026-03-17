import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../../common/auth/internal-api-key.guard';
import { ServiceReportsAiService } from './service-reports-ai.service';
import { GenerateServiceReportsMonthlySummaryDto } from './dto/generate-monthly-summary.dto';

@UseGuards(InternalApiKeyGuard)
@Controller('v1/adapters/praiseapp/service-reports')
export class ServiceReportsAiController {
  constructor(private readonly serviceReportsAiService: ServiceReportsAiService) {}

  @Post('monthly-summary')
  @HttpCode(200)
  async generateMonthlySummary(
    @Body() dto: GenerateServiceReportsMonthlySummaryDto,
  ) {
    const response = await this.serviceReportsAiService.generateMonthlySummary(dto);
    return {
      message: 'Sumário executivo mensal gerado com Selah IA.',
      response,
    };
  }

  @Post('health-analysis')
  @HttpCode(200)
  async analyzeHealth(@Body() body: any) {
    const response = await this.serviceReportsAiService.analyzeHealth(body);
    return {
      message: 'Análise de saúde da igreja gerada com Selah IA.',
      response,
    };
  }
}
