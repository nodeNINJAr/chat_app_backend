import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

const PRESENCE_TTL_SECONDS = 45;

@Injectable()
export class PresenceService {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  private key(userId: string): string {
    return `presence:${userId}`;
  }

  /** Returns true if this is the user's first connected device (online transition). */
  async addConnection(userId: string, socketId: string): Promise<boolean> {
    const key = this.key(userId);
    const countBefore = await this.client.hlen(key);
    await this.client.hset(key, socketId, Date.now().toString());
    await this.client.expire(key, PRESENCE_TTL_SECONDS);
    return countBefore === 0;
  }

  /** Returns true if the user has no remaining connected devices (offline transition). */
  async removeConnection(userId: string, socketId: string): Promise<boolean> {
    const key = this.key(userId);
    await this.client.hdel(key, socketId);
    const remaining = await this.client.hlen(key);
    return remaining === 0;
  }

  async refresh(userId: string, socketId: string): Promise<void> {
    const key = this.key(userId);
    await this.client.hset(key, socketId, Date.now().toString());
    await this.client.expire(key, PRESENCE_TTL_SECONDS);
  }

  async isOnline(userId: string): Promise<boolean> {
    const count = await this.client.hlen(this.key(userId));
    return count > 0;
  }

  /** Subset of userIds that are currently online, checked in one round trip. */
  async filterOnline(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const pipeline = this.client.pipeline();
    for (const userId of userIds) {
      pipeline.hlen(this.key(userId));
    }
    const results = await pipeline.exec();
    if (!results) return [];
    return userIds.filter((_, i) => {
      const count = results[i]?.[1] as number | undefined;
      return !!count && count > 0;
    });
  }
}
