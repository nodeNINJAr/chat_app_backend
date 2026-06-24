import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import { Model } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Block, BlockDocument } from './schemas/block.schema';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Block.name) private readonly blockModel: Model<BlockDocument>,
  ) {}

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.userModel.findOne({
      $or: [
        { username: dto.username.toLowerCase() },
        ...(dto.email ? [{ email: dto.email.toLowerCase() }] : []),
      ],
    });
    if (existing) {
      throw new ConflictException('username or email already in use');
    }

    const passwordHash = await argon2.hash(dto.password);
    return this.userModel.create({
      username: dto.username.toLowerCase(),
      email: dto.email?.toLowerCase(),
      passwordHash,
      displayName: dto.displayName,
    });
  }

  findByIdOrThrow(id: string): Promise<UserDocument> {
    return this.findOneOrThrow({ _id: id });
  }

  findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ username: username.toLowerCase() })
      .select('+passwordHash')
      .exec();
  }

  /** Login identifier may be a username or an email. */
  findByIdentifier(identifier: string): Promise<UserDocument | null> {
    const value = identifier.toLowerCase();
    return this.userModel
      .findOne({ $or: [{ username: value }, { email: value }] })
      .select('+passwordHash')
      .exec();
  }

  async verifyPassword(user: UserDocument, password: string): Promise<boolean> {
    return argon2.verify(user.passwordHash, password);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(userId, dto, {
      returnDocument: 'after',
    });
    if (!user) {
      throw new NotFoundException('user not found');
    }
    return user;
  }

  async search(
    query: string,
    excludeUserId: string,
    limit = 20,
  ): Promise<UserDocument[]> {
    return this.userModel
      .find({
        _id: { $ne: excludeUserId },
        $text: { $search: query },
      })
      .limit(limit)
      .exec();
  }

  async registerDevice(userId: string, dto: RegisterDeviceDto): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId, 'devices.deviceId': dto.deviceId },
      {
        $set: {
          'devices.$.pushToken': dto.pushToken,
          'devices.$.platform': dto.platform,
          'devices.$.lastActiveAt': new Date(),
        },
      },
    );
    await this.userModel.updateOne(
      { _id: userId, 'devices.deviceId': { $ne: dto.deviceId } },
      {
        $push: {
          devices: { ...dto, lastActiveAt: new Date() },
        },
      },
    );
  }

  async block(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new ConflictException('cannot block yourself');
    }
    await this.blockModel.updateOne(
      { blockerId, blockedId },
      { blockerId, blockedId },
      { upsert: true },
    );
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.blockModel.deleteOne({ blockerId, blockedId });
  }

  async listBlocked(blockerId: string): Promise<BlockDocument[]> {
    return this.blockModel.find({ blockerId }).exec();
  }

  async setOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: isOnline
          ? { status: 'online' }
          : { status: 'offline', lastSeenAt: new Date() },
      },
    );
  }

  /** Checks both directions — either user having blocked the other should prevent interaction. */
  async isBlocked(userIdA: string, userIdB: string): Promise<boolean> {
    const count = await this.blockModel.countDocuments({
      $or: [
        { blockerId: userIdA, blockedId: userIdB },
        { blockerId: userIdB, blockedId: userIdA },
      ],
    });
    return count > 0;
  }

  private async findOneOrThrow(
    filter: Record<string, unknown>,
  ): Promise<UserDocument> {
    const user = await this.userModel.findOne(filter).exec();
    if (!user) {
      throw new NotFoundException('user not found');
    }
    return user;
  }
}
