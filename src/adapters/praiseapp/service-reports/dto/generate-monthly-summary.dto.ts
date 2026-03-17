import { IsArray, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ServiceReportItemDto {
  @IsString()
  date: string;

  @IsString()
  ministry: string;

  @IsInt()
  @Min(0)
  attendanceCount: number;

  @IsInt()
  @Min(0)
  visitorCount: number;

  @IsOptional()
  offeringValue?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class GenerateServiceReportsMonthlySummaryDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2000)
  year: number;

  @IsOptional()
  @IsString()
  orgName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceReportItemDto)
  reports: ServiceReportItemDto[];
}
