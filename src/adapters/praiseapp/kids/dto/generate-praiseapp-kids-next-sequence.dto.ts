import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class GeneratePraiseAppKidsNextSequenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  currentTitle?: string;

  @IsString()
  @MaxLength(180)
  currentBiblicalReference: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  currentTheme?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  currentObjective?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  currentLessonSummary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ageRangeLabel?: string;

  @IsArray()
  @ArrayMaxSize(10)
  recentLessons: Array<Record<string, unknown>>;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  activeWeeklyVerseReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  activeWeeklyVerseText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  additionalContext?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;
}
