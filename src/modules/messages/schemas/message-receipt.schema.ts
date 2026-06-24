import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type MessageReceiptDocument = HydratedDocument<MessageReceipt>;
export type ReceiptStatus = 'sent' | 'delivered' | 'read';

@Schema({ timestamps: { createdAt: false, updatedAt: true } })
export class MessageReceipt {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Message', required: true })
  messageId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  })
  conversationId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent',
  })
  status: ReceiptStatus;

  /** Denormalized from the message's own createdAt so "mark read up to X" is a single range query, not a join. */
  @Prop({ required: true })
  messageCreatedAt: Date;
}

export const MessageReceiptSchema =
  SchemaFactory.createForClass(MessageReceipt);

MessageReceiptSchema.index({ messageId: 1, userId: 1 }, { unique: true });
MessageReceiptSchema.index({ conversationId: 1, userId: 1, status: 1 });
