import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class LumenUserContextDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  @MaxLength(12)
  preferredCurrency: string;

  @IsOptional()
  @IsNumber()
  monthlyIncome?: number;
}

export class LumenTaskContextDto {
  @IsString()
  @MaxLength(160)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  priority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  dueDateLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsBoolean()
  hasFinancialImpact?: boolean;

  @IsOptional()
  @IsNumber()
  estimatedAmount?: number;
}

export class LumenTransactionContextDto {
  @IsString()
  @MaxLength(160)
  description: string;

  @IsString()
  @MaxLength(40)
  type: string;

  @IsNumber()
  amount: number;

  @IsString()
  @MaxLength(80)
  dateLabel: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;
}

export class LumenGoalContextDto {
  @IsString()
  @MaxLength(160)
  title: string;

  @IsString()
  @MaxLength(40)
  status: string;

  @IsNumber()
  progressPercent: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  targetDateLabel?: string;
}

export class LumenInsightContextDto {
  @IsString()
  @MaxLength(80)
  type: string;

  @IsString()
  @MaxLength(40)
  severity: string;

  @IsString()
  @MaxLength(400)
  message: string;
}

export class LumenForecastContextDto {
  @IsNumber()
  predictedBalance: number;

  @IsString()
  @MaxLength(40)
  riskLevel: string;
}

export class GenerateLumenLifeAssistantResponseDto {
  @IsString()
  @MaxLength(2000)
  message: string;

  @IsString()
  @IsIn(['today_overview', 'priorities', 'finance_overview', 'general'])
  intent: 'today_overview' | 'priorities' | 'finance_overview' | 'general';

  @IsString()
  @MaxLength(120)
  currentDateLabel: string;

  @ValidateNested()
  @Type(() => LumenUserContextDto)
  user: LumenUserContextDto;

  @IsString()
  @MaxLength(5000)
  lifeContextSummary: string;

  @IsString()
  @MaxLength(9000)
  applicationPromptContext: string;

  @IsString()
  @MaxLength(60)
  focusAreaHint: string;

  @IsNumber()
  tasksTodayCount: number;

  @IsNumber()
  tasksOverdueCount: number;

  @IsNumber()
  currentBalance: number;

  @IsNumber()
  monthlyExpenses: number;

  @IsNumber()
  monthlyIncome: number;

  @ValidateNested()
  @Type(() => LumenForecastContextDto)
  forecast: LumenForecastContextDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => LumenTaskContextDto)
  openTasks?: LumenTaskContextDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => LumenTransactionContextDto)
  recentTransactions?: LumenTransactionContextDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => LumenGoalContextDto)
  activeGoals?: LumenGoalContextDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => LumenInsightContextDto)
  activeInsights?: LumenInsightContextDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  reminderLabels?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  notificationLabels?: string[];
}
