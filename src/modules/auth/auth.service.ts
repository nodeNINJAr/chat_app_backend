import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { parseDurationToSeconds } from '../../common/helpers/duration';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import type { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface RefreshPayload {
  sub: string;
  tokenId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async register(
    dto: CreateUserDto,
  ): Promise<{ user: UserDocument; tokens: TokenPair }> {
    const user = await this.usersService.create(dto);
    const tokens = await this.issueTokenPair(user);
    return { user, tokens };
  }

  async login(
    dto: LoginDto,
  ): Promise<{ user: UserDocument; tokens: TokenPair }> {
    const user = await this.usersService.findByIdentifier(dto.identifier);
    if (!user) {
      throw new UnauthorizedException('invalid credentials');
    }
    const valid = await this.usersService.verifyPassword(user, dto.password);
    if (!valid) {
      throw new UnauthorizedException('invalid credentials');
    }
    const tokens = await this.issueTokenPair(user);
    return { user, tokens };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException('invalid refresh token');
    }

    const key = this.refreshKey(payload.sub, payload.tokenId);
    const storedHash = await this.redisService.get(key);
    if (!storedHash) {
      throw new UnauthorizedException('refresh token expired or already used');
    }
    const matches = await argon2.verify(storedHash, refreshToken);
    if (!matches) {
      throw new UnauthorizedException('invalid refresh token');
    }

    // Rotation: invalidate the used token before issuing a new pair.
    await this.redisService.del(key);

    const user = await this.usersService.findByIdOrThrow(payload.sub);
    return this.issueTokenPair(user);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshPayload>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
          ignoreExpiration: true,
        },
      );
      await this.redisService.del(
        this.refreshKey(payload.sub, payload.tokenId),
      );
    } catch {
      // already invalid/expired — nothing to revoke
    }
  }

  private async issueTokenPair(user: UserDocument): Promise<TokenPair> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, username: user.username },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: parseDurationToSeconds(
          this.configService.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN'),
        ),
      },
    );

    const tokenId = randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, tokenId },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.refreshTtlSeconds(),
      },
    );

    const refreshHash = await argon2.hash(refreshToken);
    await this.redisService.set(
      this.refreshKey(user.id, tokenId),
      refreshHash,
      this.refreshTtlSeconds(),
    );

    return { accessToken, refreshToken };
  }

  private refreshKey(userId: string, tokenId: string): string {
    return `refresh:${userId}:${tokenId}`;
  }

  private refreshTtlSeconds(): number {
    return parseDurationToSeconds(
      this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
    );
  }
}
