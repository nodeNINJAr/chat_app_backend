import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Group, GroupSchema } from '../groups/schemas/group.schema';
import { ConversationsModule } from '../conversations/conversations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import {
  MessageReceipt,
  MessageReceiptSchema,
} from './schemas/message-receipt.schema';
import { Message, MessageSchema } from './schemas/message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: MessageReceipt.name, schema: MessageReceiptSchema },
      // Registered here too (not via GroupsModule) to avoid a circular
      // module dependency — GroupsModule imports ChatModule, which imports
      // MessagesModule. Only the schema is needed here, just to check a
      // group's whoCanSendMessages setting when a message is sent.
      { name: Group.name, schema: GroupSchema },
    ]),
    ConversationsModule,
    UsersModule,
    NotificationsModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
