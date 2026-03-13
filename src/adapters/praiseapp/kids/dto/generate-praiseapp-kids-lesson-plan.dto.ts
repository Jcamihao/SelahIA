import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class GeneratePraiseAppKidsLessonPlanDto {
  @IsString()
  @MaxLength(160)
  biblicalReference: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ageRangeLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  theme?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  lessonObjective?: string;

  @IsOptional()
  @IsInt()
  @Min(10)
  durationMin?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  additionalContext?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  recentTemplateTitles?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  recentLessonTitles?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  activeWeeklyVerseReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  activeWeeklyVerseText?: string;
}

