import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  MessageReceipt,
  MessageReceiptSchema,
} from '../messages/schemas/message-receipt.schema';
import {
  ConversationParticipant,
  ConversationParticipantSchema,
} from './schemas/conversation-participant.schema';
import {
  Conversation,
  ConversationSchema,
} from './schemas/conversation.schema';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      {
        name: ConversationParticipant.name,
        schema: ConversationParticipantSchema,
      },
      // Registered here too (not via MessagesModule) to avoid a circular
      // module dependency — MessagesModule already imports ConversationsModule.
      { name: MessageReceipt.name, schema: MessageReceiptSchema },
    ]),
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
