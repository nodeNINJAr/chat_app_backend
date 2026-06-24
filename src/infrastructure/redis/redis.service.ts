import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_CLIENT) readonly client: Redis) {}

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  del(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  exists(key: string): Promise<number> {
    return this.client.exists(key);
  }
}
