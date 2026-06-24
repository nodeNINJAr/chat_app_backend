import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;
export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'system';

@Schema({ _id: false })
class MessageContent {
  @Prop({ type: String, default: null })
  text: string | null;

  @Prop({ type: String, default: null })
  mediaUrl: string | null;

  @Prop({ type: String, default: null })
  thumbnailUrl: string | null;

  @Prop({ type: String, default: null })
  fileName: string | null;

  @Prop({ type: Number, default: null })
  fileSize: number | null;

  @Prop({ type: String, default: null })
  mimeType: string | null;

  @Prop({ type: Number, default: null })
  durationSec: number | null;
}

@Schema({ _id: false })
class Reaction {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  emoji: string;

  @Prop({ default: () => new Date() })
  createdAt: Date;
}

@Schema({ _id: false })
class ForwardedFrom {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Message', required: true })
  messageId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  })
  conversationId: Types.ObjectId;
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Message {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  })
  conversationId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['text', 'image', 'video', 'audio', 'file', 'system'],
  })
  type: MessageType;

  @Prop({ type: MessageContent, required: true })
  content: MessageContent;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Message', default: null })
  replyToMessageId: Types.ObjectId | null;

  @Prop({ type: ForwardedFrom, default: null })
  forwardedFrom: ForwardedFrom | null;

  @Prop({ type: [Reaction], default: [] })
  reactions: Reaction[];

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', default: [] })
  mentions: Types.ObjectId[];

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', default: [] })
  deletedForUserIds: Types.ObjectId[];

  @Prop({ default: false })
  isDeletedForEveryone: boolean;

  @Prop({ type: Date, default: null })
  editedAt: Date | null;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ 'content.text': 'text' });
