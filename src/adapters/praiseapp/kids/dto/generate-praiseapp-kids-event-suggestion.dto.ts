import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GeneratePraiseAppKidsEventSuggestionDto {
  @IsString()
  @MaxLength(180)
  theme: string;

  @IsString()
  @MaxLength(32)
  eventDate: string;

  @IsString()
  @MaxLength(180)
  targetAudience: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  purpose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  locationContext?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  additionalContext?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;
}
