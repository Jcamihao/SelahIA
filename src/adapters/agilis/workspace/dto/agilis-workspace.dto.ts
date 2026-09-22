import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AgilisOverdueUserDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsInt()
  @Min(0)
  count: number;
}

export class AgilisWorkspaceContextDto {
  @IsInt()
  @Min(0)
  totalTasks: number;

  @IsInt()
  @Min(0)
  overdueTasks: number;

  @IsInt()
  @Min(0)
  completedTasks: number;

  @IsInt()
  @Min(0)
  backlogCount: number;

  @IsInt()
  @Min(0)
  activeProjects: number;

  @IsInt()
  @Min(0)
  teamCount: number;

  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => AgilisOverdueUserDto)
  topOverdueUsers: AgilisOverdueUserDto[];
}

export class AgilisChatMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @MaxLength(4000)
  content: string;
}

export class AgilisChatDto {
  @IsString()
  @MaxLength(4000)
  message: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AgilisChatMessageDto)
  history?: AgilisChatMessageDto[];

  @ValidateNested()
  @Type(() => AgilisWorkspaceContextDto)
  workspace: AgilisWorkspaceContextDto;
}

export class AgilisProjectSummaryDto {
  @IsString()
  @MaxLength(200)
  projectName: string;

  @IsInt()
  @Min(0)
  totalTasks: number;

  @IsInt()
  @Min(0)
  doneTasks: number;

  @IsInt()
  @Min(0)
  overdueTasks: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  overdueTaskTitles?: string[];
}

export class AgilisTaskCommentDto {
  @IsString()
  @MaxLength(120)
  authorName: string;

  @IsString()
  @MaxLength(1000)
  content: string;
}

export class AgilisTaskSummaryDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(40)
  status: string;

  @IsString()
  @MaxLength(40)
  priority: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assigneeName?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => AgilisTaskCommentDto)
  comments?: AgilisTaskCommentDto[];
}

export class AgilisActionPlanTaskDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(40)
  priority: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assigneeName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  dueDateLabel?: string | null;
}

export class AgilisActionPlanDto {
  @IsString()
  @MaxLength(200)
  projectName: string;

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AgilisActionPlanTaskDto)
  tasks: AgilisActionPlanTaskDto[];
}

export class AgilisStagnantTaskDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(40)
  status: string;

  @IsString()
  @MaxLength(200)
  projectName: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assigneeName?: string | null;
}

export class AgilisBottlenecksDto {
  @ValidateNested()
  @Type(() => AgilisWorkspaceContextDto)
  workspace: AgilisWorkspaceContextDto;

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AgilisStagnantTaskDto)
  stagnantTasks: AgilisStagnantTaskDto[];
}

export class AgilisAssigneeCandidateDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsInt()
  @Min(0)
  pendingTasks: number;
}

export class AgilisSuggestAssigneeDto {
  @IsString()
  @MaxLength(200)
  taskTitle: string;

  @IsString()
  @MaxLength(40)
  taskPriority: string;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => AgilisAssigneeCandidateDto)
  members: AgilisAssigneeCandidateDto[];
}

export class AgilisBriefMetricsDto {
  @IsInt()
  @Min(0)
  totalTasks: number;

  @IsInt()
  @Min(0)
  doneTasks: number;

  @IsInt()
  @Min(0)
  overdueTasks: number;

  @IsInt()
  @Min(0)
  backlogTasks: number;

  @IsInt()
  @Min(0)
  activeProjects: number;

  @IsInt()
  @Min(0)
  members: number;

  @IsNumber()
  @Min(0)
  completionRate: number;

  @IsNumber()
  @Min(0)
  weeklyVelocity: number;
}

export class AgilisBriefInsightDto {
  @IsString()
  @MaxLength(40)
  severity: string;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(600)
  description: string;
}

export class AgilisStrategicBriefDto {
  @ValidateNested()
  @Type(() => AgilisBriefMetricsDto)
  metrics: AgilisBriefMetricsDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => AgilisBriefInsightDto)
  insights?: AgilisBriefInsightDto[];
}

export class AgilisWorkloadMemberDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsInt()
  @Min(0)
  openTasks: number;

  @IsInt()
  @Min(0)
  overdueTasks: number;

  @IsNumber()
  @Min(0)
  capacityScore: number;
}

export class AgilisWorkloadRedistributionDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => AgilisWorkloadMemberDto)
  overloaded: AgilisWorkloadMemberDto[];

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => AgilisWorkloadMemberDto)
  available: AgilisWorkloadMemberDto[];
}

