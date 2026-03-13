import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GeneratePraiseAppKidsWeeklyVerseExpansionDto {
  @IsString()
  @MaxLength(120)
  reference: string;

  @IsString()
  @MaxLength(2000)
  text: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  ageRangeLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;
}
