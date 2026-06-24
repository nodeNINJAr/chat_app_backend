import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac } from 'crypto';
import { Model } from 'mongoose';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { ConversationsService } from '../conversations/conversations.service';
import {
  Call,
  CallDocument,
  CallStatus,
  CallType,
} from './schemas/call.schema';

export interface TurnCredentials {
  username: string;
  password: string;
  ttlSeconds: number;
  urls: string[];
}

@Injectable()
export class CallsService {
  constructor(
    @InjectModel(Call.name) private readonly callModel: Model<CallDocument>,
    private readonly conversationsService: ConversationsService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async initiate(
    callerId: string,
    calleeId: string,
    type: CallType,
  ): Promise<CallDocument> {
    const conversation = await this.conversationsService.getOrCreateDirect(
      callerId,
      calleeId,
    );
    return this.callModel.create({
      conversationId: conversation._id,
      callerId,
      calleeId,
      type,
      status: 'ringing',
      startedAt: new Date(),
    });
  }

  async markActive(callId: string): Promise<CallDocument | null> {
    return this.callModel.findOneAndUpdate(
      { _id: callId, status: 'ringing' },
      { $set: { status: 'active', answeredAt: new Date() } },
      { returnDocument: 'after' },
    );
  }

  async markEnded(
    callId: string,
    status: Exclude<CallStatus, 'ringing' | 'active'>,
  ): Promise<CallDocument | null> {
    const call = await this.callModel.findById(callId);
    if (!call) return null;

    const endedAt = new Date();
    const durationSec = call.answeredAt
      ? Math.round((endedAt.getTime() - call.answeredAt.getTime()) / 1000)
      : 0;
    call.status = status;
    call.endedAt = endedAt;
    call.durationSec = durationSec;
    await call.save();
    return call;
  }

  findById(callId: string): Promise<CallDocument | null> {
    return this.callModel.findById(callId).exec();
  }

  async getHistory(
    userId: string,
    limit = 30,
    before?: string,
  ): Promise<CallDocument[]> {
    const filter: Record<string, unknown> = {
      $or: [{ callerId: userId }, { calleeId: userId }],
    };
    if (before) {
      filter._id = { $lt: before };
    }
    return this.callModel.find(filter).sort({ _id: -1 }).limit(limit).exec();
  }

  // --- "is this user already on a call" tracking, backs call:busy detection ---

  async setBusy(userId: string, callId: string): Promise<void> {
    await this.redisService.set(this.busyKey(userId), callId, 4 * 60 * 60);
  }

  async clearBusy(userId: string): Promise<void> {
    await this.redisService.del(this.busyKey(userId));
  }

  async isBusy(userId: string): Promise<boolean> {
    return (await this.redisService.exists(this.busyKey(userId))) === 1;
  }

  getBusyCallId(userId: string): Promise<string | null> {
    return this.redisService.get(this.busyKey(userId));
  }

  private busyKey(userId: string): string {
    return `call:busy:${userId}`;
  }

  // --- coturn ephemeral credentials (static-auth-secret / REST API mechanism) ---

  getTurnCredentials(userId: string): TurnCredentials {
    const ttlSeconds =
      this.configService.get<number>('TURN_CREDENTIAL_TTL_SECONDS') ?? 300;
    const secret = this.configService.getOrThrow<string>('TURN_SECRET');
    const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
    const username = `${expiry}:${userId}`;
    const password = createHmac('sha1', secret)
      .update(username)
      .digest('base64');
    const urls = this.configService
      .getOrThrow<string>('TURN_URLS')
      .split(',')
      .map((url) => url.trim());

    return { username, password, ttlSeconds, urls };
  }
}
