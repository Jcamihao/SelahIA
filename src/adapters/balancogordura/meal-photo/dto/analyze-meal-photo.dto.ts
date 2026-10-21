import { IsBase64, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const MEAL_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MEAL_PHOTO_MEAL_TYPES = ['cafe', 'almoco', 'jantar', 'lanche'] as const;

export class AnalyzeMealPhotoDto {
  @IsIn(MEAL_PHOTO_MIME_TYPES)
  mimeType: (typeof MEAL_PHOTO_MIME_TYPES)[number];

  @IsBase64()
  @MaxLength(2_800_000)
  imageBase64: string;

  @IsOptional()
  @IsIn(MEAL_PHOTO_MEAL_TYPES)
  mealType?: (typeof MEAL_PHOTO_MEAL_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(16)
  localeHint?: string;
}
