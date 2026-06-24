import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { MessagesService } from './messages.service';

@ApiTags('messages')
@ApiBearerAuth('access-token')
@Controller('conversations/:conversationId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @ApiOperation({ summary: 'Cursor-paginated message history (newest first)' })
  @Get()
  listHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.messagesService.listHistory(
      user.userId,
      conversationId,
      limit ? Number(limit) : undefined,
      before,
    );
  }

  @ApiOperation({ summary: 'Search messages within a conversation' })
  @Get('search')
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Query('q') query: string,
  ) {
    return this.messagesService.search(user.userId, conversationId, query);
  }
}
