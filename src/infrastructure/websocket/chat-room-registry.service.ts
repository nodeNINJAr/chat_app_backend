import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';
import { userRoom } from '../../common/helpers/rooms';

/**
 * Bridges the chat Socket.IO server to services outside the gateway (e.g.
 * ConversationsService) without a circular module dependency. Conversation
 * room membership is otherwise only computed once, at socket connect time —
 * a user's already-connected socket would never join a conversation room
 * created afterwards, missing every realtime event for it until they
 * reconnect. Call joinUserToRoom right after creating/expanding a
 * conversation so already-online participants start receiving it immediately.
 */
@Injectable()
export class ChatRoomRegistry {
  private server?: Server;

  setServer(server: Server): void {
    this.server = server;
  }

  joinUserToRoom(userId: string, roomId: string): void {
    void this.server?.in(userRoom(userId)).socketsJoin(roomId);
  }
}
