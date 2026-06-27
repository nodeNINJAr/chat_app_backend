import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { ADMIN_ROLES } from '../../common/constants/roles';
import { ConversationsService } from '../conversations/conversations.service';
import type { ConversationParticipantDocument } from '../conversations/schemas/conversation-participant.schema';
import type { ConversationDocument } from '../conversations/schemas/conversation.schema';
import { AddMembersDto } from './dto/add-members.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupSettingsDto } from './dto/update-group-settings.dto';
import { Group, GroupDocument } from './schemas/group.schema';

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly conversationsService: ConversationsService,
  ) {}

  async createGroup(
    ownerId: string,
    dto: CreateGroupDto,
  ): Promise<{ group: GroupDocument; conversation: ConversationDocument }> {
    const session = await this.connection.startSession();
    try {
      let result!: { group: GroupDocument; conversation: ConversationDocument };
      await session.withTransaction(async () => {
        const conversation =
          await this.conversationsService.createGroupConversation(session);
        const memberIds = [...new Set(dto.memberIds)].filter(
          (id) => id !== ownerId,
        );

        const [group] = await this.groupModel.create(
          [
            {
              conversationId: conversation._id,
              name: dto.name,
              ownerId,
              memberCount: memberIds.length + 1,
            },
          ],
          { session },
        );
        await this.conversationsService.linkGroup(
          conversation._id,
          group._id,
          session,
        );
        await this.conversationsService.addParticipantsWithRoles(
          conversation._id,
          [
            { userId: ownerId, role: 'owner' },
            ...memberIds.map((userId) => ({ userId, role: 'member' as const })),
          ],
          session,
        );

        result = { group, conversation };
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async findByIdOrThrow(groupId: string): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId).exec();
    if (!group) {
      throw new NotFoundException('group not found');
    }
    return group;
  }

  async getById(groupId: string, requesterId: string): Promise<GroupDocument> {
    const group = await this.findByIdOrThrow(groupId);
    await this.conversationsService.assertActiveParticipant(
      group.conversationId.toString(),
      requesterId,
    );
    return group;
  }

  async addMembers(
    groupId: string,
    requesterId: string,
    dto: AddMembersDto,
  ): Promise<{ group: GroupDocument; addedUserIds: string[] }> {
    const group = await this.findByIdOrThrow(groupId);
    const conversationId = group.conversationId.toString();
    const requester = await this.conversationsService.assertActiveParticipant(
      conversationId,
      requesterId,
    );
    if (
      group.settings.whoCanAddMembers === 'admins' &&
      !ADMIN_ROLES.includes(requester.role)
    ) {
      throw new ForbiddenException('only admins can add members to this group');
    }

    const existingIds = new Set(
      await this.conversationsService.listParticipantIds(conversationId),
    );
    const newIds = [...new Set(dto.memberIds)].filter(
      (id) => !existingIds.has(id),
    );
    if (newIds.length === 0) {
      return { group, addedUserIds: [] };
    }

    await this.conversationsService.addParticipantsWithRoles(
      conversationId,
      newIds.map((userId) => ({ userId, role: 'member' as const })),
    );
    group.memberCount += newIds.length;
    await group.save();
    return { group, addedUserIds: newIds };
  }

  async removeMember(
    groupId: string,
    requesterId: string,
    targetUserId: string,
  ): Promise<GroupDocument> {
    const group = await this.findByIdOrThrow(groupId);
    const conversationId = group.conversationId.toString();

    if (requesterId === targetUserId) {
      const requester = await this.conversationsService.getParticipant(
        conversationId,
        requesterId,
      );
      if (requester?.role === 'owner') {
        throw new ForbiddenException(
          'the owner must transfer ownership before leaving the group',
        );
      }
    } else {
      const requester = await this.conversationsService.assertActiveParticipant(
        conversationId,
        requesterId,
      );
      if (!ADMIN_ROLES.includes(requester.role)) {
        throw new ForbiddenException('only admins can remove members');
      }
      const target = await this.conversationsService.getParticipant(
        conversationId,
        targetUserId,
      );
      if (target?.role === 'owner') {
        throw new ForbiddenException('cannot remove the group owner');
      }
    }

    await this.conversationsService.leave(conversationId, targetUserId);
    group.memberCount = Math.max(0, group.memberCount - 1);
    await group.save();
    return group;
  }

  async updateRole(
    groupId: string,
    requesterId: string,
    targetUserId: string,
    role: 'admin' | 'member',
  ): Promise<ConversationParticipantDocument> {
    const group = await this.findByIdOrThrow(groupId);
    const conversationId = group.conversationId.toString();
    const requester = await this.conversationsService.assertActiveParticipant(
      conversationId,
      requesterId,
    );
    if (requester.role !== 'owner') {
      throw new ForbiddenException(
        'only the group owner can change member roles',
      );
    }
    const target = await this.conversationsService.getParticipant(
      conversationId,
      targetUserId,
    );
    if (target?.role === 'owner') {
      throw new ForbiddenException("cannot change the owner's role");
    }
    return this.conversationsService.updateRole(
      conversationId,
      targetUserId,
      role,
    );
  }

  async updateSettings(
    groupId: string,
    requesterId: string,
    dto: UpdateGroupSettingsDto,
  ): Promise<GroupDocument> {
    const group = await this.findByIdOrThrow(groupId);
    const requester = await this.conversationsService.assertActiveParticipant(
      group.conversationId.toString(),
      requesterId,
    );
    if (!ADMIN_ROLES.includes(requester.role)) {
      throw new ForbiddenException('only admins can update group settings');
    }

    if (dto.name !== undefined) group.name = dto.name;
    if (dto.description !== undefined) group.description = dto.description;
    if (dto.avatarUrl !== undefined) group.avatarUrl = dto.avatarUrl;
    if (dto.settings) {
      Object.assign(group.settings, dto.settings);
    }
    await group.save();
    return group;
  }

  async listMembers(
    groupId: string,
    requesterId: string,
  ): Promise<ConversationParticipantDocument[]> {
    const group = await this.findByIdOrThrow(groupId);
    await this.conversationsService.assertActiveParticipant(
      group.conversationId.toString(),
      requesterId,
    );
    return this.conversationsService.listParticipants(
      group.conversationId.toString(),
    );
  }
}
