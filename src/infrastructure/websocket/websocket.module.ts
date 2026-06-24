import { Global, Module } from '@nestjs/common';
import { ChatRoomRegistry } from './chat-room-registry.service';

@Global()
@Module({
  providers: [ChatRoomRegistry],
  exports: [ChatRoomRegistry],
})
export class WebsocketModule {}
