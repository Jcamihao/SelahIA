import { Global, Module } from '@nestjs/common';
import { ApiKeyRegistry } from './api-key-registry.service';
import { RateLimiterService } from './rate-limiter.service';

@Global()
@Module({
  providers: [ApiKeyRegistry, RateLimiterService],
  exports: [ApiKeyRegistry, RateLimiterService],
})
export class AuthModule {}
