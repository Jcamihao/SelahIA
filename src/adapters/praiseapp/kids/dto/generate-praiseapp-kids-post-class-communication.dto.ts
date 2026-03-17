import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class GeneratePraiseAppKidsPostClassCommunicationDto {
  @IsObject()
  lessonPlan: Record<string, unknown>;

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
