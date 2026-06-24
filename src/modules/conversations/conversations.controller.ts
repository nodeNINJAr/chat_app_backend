import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { ConversationsService } from './conversations.service';
import { CreateDirectConversationDto } from './dto/create-direct-conversation.dto';
import { UpdateParticipantStateDto } from './dto/update-participant-state.dto';
import type { ConversationDocument } from './schemas/conversation.schema';
import type { ConversationParticipantDocument } from './schemas/conversation-participant.schema';

@ApiTags('conversations')
@ApiBearerAuth('access-token')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @ApiOperation({ summary: 'List my conversations, sorted by recency' })
  @Get()
  async listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const rows = await this.conversationsService.listMine(
      user.userId,
      limit ? Number(limit) : undefined,
      before ? new Date(before) : undefined,
    );
    return rows.map(({ conversation, participant, otherParticipantIds }) =>
      this.toSummary(conversation, participant, otherParticipantIds),
    );
  }

  @ApiOperation({
    summary: 'Get or create a 1:1 conversation with another user',
  })
  @Post('direct')
  async createDirect(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDirectConversationDto,
  ) {
    const conversation = await this.conversationsService.getOrCreateDirect(
      user.userId,
      dto.userId,
    );
    const participant = await this.conversationsService.assertActiveParticipant(
      conversation.id,
      user.userId,
    );
    return this.toSummary(conversation, participant, [dto.userId]);
  }

  @ApiOperation({ summary: 'Mute/archive/pin a conversation' })
  @Patch(':id/state')
  async updateState(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateParticipantStateDto,
  ) {
    return this.conversationsService.updateParticipantState(
      id,
      user.userId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Leave/hide a conversation' })
  @Post(':id/leave')
  async leave(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.conversationsService.assertActiveParticipant(id, user.userId);
    await this.conversationsService.leave(id, user.userId);
    return { success: true };
  }

  private toSummary(
    conversation: ConversationDocument,
    participant: ConversationParticipantDocument,
    otherParticipantIds: string[],
  ) {
    return {
      id: conversation.id,
      type: conversation.type,
      groupId: conversation.groupId,
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount: participant.unreadCount,
      isMuted: participant.isMuted,
      isArchived: participant.isArchived,
      isPinned: participant.isPinned,
      role: participant.role,
      otherParticipantIds,
    };
  }
}
