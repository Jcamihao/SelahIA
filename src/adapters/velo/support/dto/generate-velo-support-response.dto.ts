import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class VeloSupportHistoryItemDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @MaxLength(2000)
  content: string;
}

export class GenerateVeloSupportResponseDto {
  @IsString()
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => VeloSupportHistoryItemDto)
  conversationHistory?: VeloSupportHistoryItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  userRole?: string;

  @IsOptional()
  @IsBoolean()
  isAuthenticated?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  currentRoute?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  screenLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  supportContextSummary?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @IsString({ each: true })
  @MaxLength(240, { each: true })
  featureCatalog?: string[];
}
