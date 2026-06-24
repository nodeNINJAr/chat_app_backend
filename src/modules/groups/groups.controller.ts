import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { conversationRoom } from '../../common/helpers/rooms';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { ChatGateway } from '../../gateways/chat/chat.gateway';
import { AddMembersDto } from './dto/add-members.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupSettingsDto } from './dto/update-group-settings.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { GroupsService } from './groups.service';

@ApiTags('groups')
@ApiBearerAuth('access-token')
@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @ApiOperation({ summary: 'Create a group with an initial member list' })
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGroupDto,
  ) {
    const { group, conversation } = await this.groupsService.createGroup(
      user.userId,
      dto,
    );
    return {
      id: group.id,
      conversationId: conversation.id,
      name: group.name,
      ownerId: group.ownerId,
      memberCount: group.memberCount,
      settings: group.settings,
    };
  }

  @ApiOperation({ summary: 'List members with their roles' })
  @Get(':id/members')
  listMembers(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.groupsService.listMembers(id, user.userId);
  }

  @ApiOperation({
    summary: 'Add members (subject to whoCanAddMembers setting)',
  })
  @Post(':id/members')
  async addMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddMembersDto,
  ) {
    const { group, addedUserIds } = await this.groupsService.addMembers(
      id,
      user.userId,
      dto,
    );
    if (addedUserIds.length > 0) {
      this.chatGateway.server
        .to(conversationRoom(group.conversationId.toString()))
        .emit('group:member-added', { groupId: id, userIds: addedUserIds });
    }
    return { memberCount: group.memberCount, addedUserIds };
  }

  @ApiOperation({ summary: 'Remove a member (admin) or leave (self)' })
  @Delete(':id/members/:userId')
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    const group = await this.groupsService.removeMember(
      id,
      user.userId,
      targetUserId,
    );
    this.chatGateway.server
      .to(conversationRoom(group.conversationId.toString()))
      .emit('group:member-removed', { groupId: id, userId: targetUserId });
    return { memberCount: group.memberCount };
  }

  @ApiOperation({ summary: 'Promote/demote a member (owner only)' })
  @Patch(':id/members/:userId/role')
  async updateRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const participant = await this.groupsService.updateRole(
      id,
      user.userId,
      targetUserId,
      dto.role,
    );
    this.chatGateway.server
      .to(conversationRoom(participant.conversationId.toString()))
      .emit('group:role-updated', {
        groupId: id,
        userId: targetUserId,
        role: dto.role,
      });
    return { userId: targetUserId, role: participant.role };
  }

  @ApiOperation({
    summary: 'Update group name/description/avatar/settings (admin)',
  })
  @Patch(':id')
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateGroupSettingsDto,
  ) {
    const group = await this.groupsService.updateSettings(id, user.userId, dto);
    this.chatGateway.server
      .to(conversationRoom(group.conversationId.toString()))
      .emit('group:settings-updated', {
        groupId: id,
        name: group.name,
        description: group.description,
        avatarUrl: group.avatarUrl,
        settings: group.settings,
      });
    return group;
  }
}
