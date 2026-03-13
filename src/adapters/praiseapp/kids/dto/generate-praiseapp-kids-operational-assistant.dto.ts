import { IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class GeneratePraiseAppKidsOperationalAssistantDto {
  @IsObject()
  baseLesson: Record<string, unknown>;

  @IsString()
  @MaxLength(2000)
  operationalContext: string;

  @IsOptional()
  @IsInt()
  @Min(10)
  desiredDurationMin?: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;
}
