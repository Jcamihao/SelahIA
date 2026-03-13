import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class GeneratePraiseAppKidsCheckinDailySummaryDto {
  @IsString()
  @MaxLength(16)
  date: string;

  @IsInt()
  @Min(0)
  totalCheckins: number;

  @IsInt()
  @Min(0)
  totalCheckedOut: number;

  @IsInt()
  @Min(0)
  totalOpenCheckins: number;

  @IsInt()
  @Min(0)
  firstVisits: number;

  @IsInt()
  @Min(0)
  guardianCheckoutRequests: number;

  @IsInt()
  @Min(0)
  totalVolunteers: number;

  @IsInt()
  @Min(0)
  volunteerShortage: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  overallAlertLevel?: string;

  @IsArray()
  @ArrayMaxSize(16)
  classSummaries: Array<Record<string, unknown>>;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  additionalContext?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;
}
