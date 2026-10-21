import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../../common/auth/internal-api-key.guard';
import { AnalyzeMealPhotoDto } from './dto/analyze-meal-photo.dto';
import { MealPhotoService } from './meal-photo.service';

@UseGuards(InternalApiKeyGuard)
@Controller('v1/adapters/balancogordura/meal-photo')
export class MealPhotoController {
  constructor(private readonly mealPhotoService: MealPhotoService) {}

  @Post('analyze')
  @HttpCode(200)
  async analyze(@Body() dto: AnalyzeMealPhotoDto) {
    return this.mealPhotoService.analyze(dto);
  }
}
