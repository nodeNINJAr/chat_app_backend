import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PresenceService } from './presence.service';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        }),
    },
    RedisService,
    PresenceService,
  ],
  exports: [REDIS_CLIENT, RedisService, PresenceService],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(private readonly redisService: RedisService) {}

  async onApplicationShutdown() {
    await this.redisService.client.quit();
  }
}
