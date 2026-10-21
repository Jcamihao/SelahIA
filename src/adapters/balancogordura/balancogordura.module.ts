import { Module } from '@nestjs/common';
import { InternalApiKeyGuard } from '../../common/auth/internal-api-key.guard';
import { ProvidersModule } from '../../providers/providers.module';
import { MealPhotoController } from './meal-photo/meal-photo.controller';
import { MealPhotoService } from './meal-photo/meal-photo.service';

@Module({
  imports: [ProvidersModule],
  controllers: [MealPhotoController],
  providers: [MealPhotoService, InternalApiKeyGuard],
})
export class BalancoGorduraModule {}
