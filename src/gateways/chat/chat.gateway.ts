import { UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { conversationRoom, userRoom } from '../../common/helpers/rooms';
import { authenticateSocket } from '../../common/helpers/ws-auth';
import { ConversationsService } from '../../modules/conversations/conversations.service';
import { DeleteMessageDto } from '../../modules/messages/dto/delete-message.dto';
import { EditMessageDto } from '../../modules/messages/dto/edit-message.dto';
import { ForwardMessageDto } from '../../modules/messages/dto/forward-message.dto';
import { MarkReadDto } from '../../modules/messages/dto/mark-read.dto';
import { MessageDeliveredDto } from '../../modules/messages/dto/message-delivered.dto';
import { ReactMessageDto } from '../../modules/messages/dto/react-message.dto';
import { SendMessageDto } from '../../modules/messages/dto/send-message.dto';
import { MessagesService } from '../../modules/messages/messages.service';
import { PresenceService } from '../../infrastructure/redis/presence.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { UsersService } from '../../modules/users/users.service';

interface AuthedSocket extends Socket {
  data: { userId: string };
}

const TYPING_TTL_SECONDS = 5;

@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: process.env.CORS_ORIGIN, credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly usersService: UsersService,
    private readonly presenceService: PresenceService,
    private readonly redisService: RedisService,
  ) {}

  async handleConnection(socket: AuthedSocket): Promise<void> {
    const userId = await authenticateSocket(
      socket,
      this.jwtService,
      this.configService,
    );
    if (!userId) {
      socket.disconnect(true);
      return;
    }
    socket.data.userId = userId;

    const conversationIds =
      await this.conversationsService.listMyConversationIds(userId);
    await socket.join([
      userRoom(userId),
      ...conversationIds.map((id) => conversationRoom(id)),
    ]);

    const wentOnline = await this.presenceService.addConnection(
      userId,
      socket.id,
    );
    if (wentOnline) {
      await this.usersService.setOnlineStatus(userId, true);
      conversationIds.forEach((id) =>
        socket.to(conversationRoom(id)).emit('presence:online', { userId }),
      );
    }

    // Incremental presence:online events only reach sockets already connected
    // at the moment they fire — without this, a client connecting after a peer
    // is already online would never learn that peer is online.
    const otherUserIds =
      await this.conversationsService.listMyOtherParticipantIds(userId);
    const onlineUserIds = await this.presenceService.filterOnline(otherUserIds);
    socket.emit('presence:snapshot', { onlineUserIds });
  }

  async handleDisconnect(socket: AuthedSocket): Promise<void> {
    const userId = socket.data?.userId;
    if (!userId) return;

    const wentOffline = await this.presenceService.removeConnection(
      userId,
      socket.id,
    );
    if (wentOffline) {
      await this.usersService.setOnlineStatus(userId, false);
      // socket.rooms is already emptied by the adapter by the time `disconnect` fires,
      // so the room list has to be re-fetched rather than read off the socket.
      const conversationIds =
        await this.conversationsService.listMyConversationIds(userId);
      const lastSeenAt = new Date();
      conversationIds.forEach((id) =>
        this.server
          .to(conversationRoom(id))
          .emit('presence:offline', { userId, lastSeenAt }),
      );
    }
  }

  @SubscribeMessage('message:send')
  async handleSend(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const { message } = await this.messagesService.create(
      socket.data.userId,
      dto,
    );
    this.server.to(conversationRoom(dto.conversationId)).emit('message:new', {
      ...message.toJSON(),
      clientTempId: dto.clientTempId,
    });
  }

  @SubscribeMessage('message:edit')
  async handleEdit(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() dto: EditMessageDto,
  ) {
    const message = await this.messagesService.edit(socket.data.userId, dto);
    this.server
      .to(conversationRoom(message.conversationId.toString()))
      .emit('message:edited', message.toJSON());
  }

  @SubscribeMessage('message:delete')
  async handleDelete(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() dto: DeleteMessageDto,
  ) {
    const { message } = await this.messagesService.deleteMessage(
      socket.data.userId,
      dto,
    );
    const conversationId = message.conversationId.toString();
    if (dto.mode === 'me') {
      socket.emit('message:deleted', {
        messageId: message.id,
        conversationId,
        mode: 'me',
      });
      return;
    }
    this.server.to(conversationRoom(conversationId)).emit('message:deleted', {
      messageId: message.id,
      conversationId,
      mode: 'everyone',
    });
  }

  @SubscribeMessage('message:react')
  async handleReact(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() dto: ReactMessageDto,
  ) {
    const { message } = await this.messagesService.react(
      socket.data.userId,
      dto,
    );
    this.server
      .to(conversationRoom(message.conversationId.toString()))
      .emit('message:reaction-updated', {
        messageId: message.id,
        conversationId: message.conversationId.toString(),
        reactions: message.reactions,
      });
  }

  @SubscribeMessage('message:forward')
  async handleForward(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() dto: ForwardMessageDto,
  ) {
    const results = await this.messagesService.forward(socket.data.userId, dto);
    results.forEach(({ message }) => {
      this.server
        .to(conversationRoom(message.conversationId.toString()))
        .emit('message:new', message.toJSON());
    });
  }

  @SubscribeMessage('message:delivered')
  async handleDelivered(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() dto: MessageDeliveredDto,
  ) {
    const receipt = await this.messagesService.markDelivered(
      socket.data.userId,
      dto.messageId,
    );
    if (!receipt) return;
    this.server
      .to(conversationRoom(receipt.conversationId.toString()))
      .emit('message:status-updated', {
        messageId: dto.messageId,
        userId: socket.data.userId,
        status: 'delivered',
      });
  }

  @SubscribeMessage('message:read')
  async handleRead(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() dto: MarkReadDto,
  ) {
    await this.messagesService.markRead(
      socket.data.userId,
      dto.conversationId,
      dto.upToMessageId,
    );
    this.server
      .to(conversationRoom(dto.conversationId))
      .emit('conversation:read', {
        conversationId: dto.conversationId,
        userId: socket.data.userId,
        upToMessageId: dto.upToMessageId,
      });
  }

  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    await this.conversationsService.assertActiveParticipant(
      body.conversationId,
      socket.data.userId,
    );
    await this.redisService.set(
      this.typingKey(body.conversationId, socket.data.userId),
      '1',
      TYPING_TTL_SECONDS,
    );
    socket.to(conversationRoom(body.conversationId)).emit('typing:start', {
      conversationId: body.conversationId,
      userId: socket.data.userId,
    });
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @ConnectedSocket() socket: AuthedSocket,
    @MessageBody() body: { conversationId: string },
  ) {
    await this.redisService.del(
      this.typingKey(body.conversationId, socket.data.userId),
    );
    socket.to(conversationRoom(body.conversationId)).emit('typing:stop', {
      conversationId: body.conversationId,
      userId: socket.data.userId,
    });
  }

  private typingKey(conversationId: string, userId: string): string {
    return `typing:${conversationId}:${userId}`;
  }
}
