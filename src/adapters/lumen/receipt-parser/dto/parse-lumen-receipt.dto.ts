import {
  ArrayMaxSize,
  IsArray,
  IsBase64,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ParseLumenReceiptDto {
  @IsString()
  @MaxLength(200)
  fileName: string;

  @IsString()
  @MaxLength(120)
  mimeType: string;

  @IsBase64()
  @MaxLength(15_000_000)
  imageBase64: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  preferredCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  localeHint?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  knownCategories?: string[];
}
