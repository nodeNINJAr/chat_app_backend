import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { UserDocument } from './schemas/user.schema';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get my own profile' })
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const me = await this.usersService.findByIdOrThrow(user.userId);
    return this.toOwnProfile(me);
  }

  @ApiOperation({ summary: 'Update my profile' })
  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.usersService.updateProfile(user.userId, dto);
    return this.toOwnProfile(updated);
  }

  @ApiOperation({ summary: 'Search users by username/display name' })
  @Get('search')
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') query: string,
  ) {
    const results = await this.usersService.search(query, user.userId);
    return results.map((u) => this.toPublicProfile(u));
  }

  @ApiOperation({
    summary: 'Register/refresh a push-notification device token',
  })
  @Post('devices')
  async registerDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceDto,
  ) {
    await this.usersService.registerDevice(user.userId, dto);
    return { success: true };
  }

  @ApiOperation({ summary: 'List users I have blocked' })
  @Get('blocked')
  async listBlocked(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listBlocked(user.userId);
  }

  @ApiOperation({ summary: "Get a user's public profile" })
  @Get(':id')
  async getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const target = await this.usersService.findByIdOrThrow(id);
    const blocked = await this.usersService.isBlocked(user.userId, id);
    return this.toPublicProfile(target, blocked);
  }

  @ApiOperation({ summary: 'Block a user' })
  @Post(':id/block')
  async blockUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.usersService.block(user.userId, id);
    return { success: true };
  }

  @ApiOperation({ summary: 'Unblock a user' })
  @Delete(':id/block')
  async unblockUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.usersService.unblock(user.userId, id);
    return { success: true };
  }

  private toOwnProfile(user: UserDocument) {
    return {
      id: user.id,
      username: user.username,
      email: user.email ?? null,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      privacy: user.privacy,
      status: user.status,
      lastSeenAt: user.lastSeenAt,
    };
  }

  private toPublicProfile(user: UserDocument, isBlocked = false) {
    const showLastSeen =
      user.privacy.lastSeenVisibility === 'everyone' && !isBlocked;
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      status: isBlocked ? 'offline' : user.status,
      lastSeenAt: showLastSeen ? user.lastSeenAt : null,
    };
  }
}
