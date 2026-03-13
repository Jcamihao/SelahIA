import { ArrayMaxSize, IsArray, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class GeneratePraiseAppKidsAgeAdaptationsDto {
  @IsObject()
  baseLesson: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  targetAgeRanges?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;
}
