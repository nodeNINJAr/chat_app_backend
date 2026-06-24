import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConversationsModule } from '../../modules/conversations/conversations.module';
import { MessagesModule } from '../../modules/messages/messages.module';
import { UsersModule } from '../../modules/users/users.module';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [
    JwtModule.register({}),
    ConversationsModule,
    MessagesModule,
    UsersModule,
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}
