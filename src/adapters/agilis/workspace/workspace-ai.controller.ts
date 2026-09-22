import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../../common/auth/internal-api-key.guard';
import {
  AgilisActionPlanDto,
  AgilisBottlenecksDto,
  AgilisChatDto,
  AgilisProjectSummaryDto,
  AgilisStrategicBriefDto,
  AgilisSuggestAssigneeDto,
  AgilisTaskSummaryDto,
  AgilisWorkloadRedistributionDto,
} from './dto/agilis-workspace.dto';
import { AgilisWorkspaceAiService } from './workspace-ai.service';

@UseGuards(InternalApiKeyGuard)
@Controller('v1/adapters/agilis/workspace')
export class AgilisWorkspaceAiController {
  constructor(private readonly service: AgilisWorkspaceAiService) {}

  @Post('chat')
  @HttpCode(200)
  chat(@Body() dto: AgilisChatDto) {
    return this.service.chat(dto);
  }

  @Post('project-summary')
  @HttpCode(200)
  projectSummary(@Body() dto: AgilisProjectSummaryDto) {
    return this.service.summarizeProject(dto);
  }

  @Post('task-summary')
  @HttpCode(200)
  taskSummary(@Body() dto: AgilisTaskSummaryDto) {
    return this.service.summarizeTask(dto);
  }

  @Post('action-plan')
  @HttpCode(200)
  actionPlan(@Body() dto: AgilisActionPlanDto) {
    return this.service.generateActionPlan(dto);
  }

  @Post('bottlenecks')
  @HttpCode(200)
  bottlenecks(@Body() dto: AgilisBottlenecksDto) {
    return this.service.identifyBottlenecks(dto);
  }

  @Post('suggest-assignee')
  @HttpCode(200)
  suggestAssignee(@Body() dto: AgilisSuggestAssigneeDto) {
    return this.service.suggestAssignee(dto);
  }

  @Post('workload-redistribution')
  @HttpCode(200)
  workloadRedistribution(@Body() dto: AgilisWorkloadRedistributionDto) {
    return this.service.suggestRedistribution(dto);
  }

  @Post('strategic-brief')
  @HttpCode(200)
  strategicBrief(@Body() dto: AgilisStrategicBriefDto) {
    return this.service.generateStrategicBrief(dto);
  }
}
