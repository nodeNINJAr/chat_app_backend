import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ConversationParticipantDocument =
  HydratedDocument<ConversationParticipant>;
export type ParticipantRole = 'owner' | 'admin' | 'member';

@Schema({ timestamps: false })
export class ConversationParticipant {
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
    enum: ['owner', 'admin', 'member'],
    default: 'member',
  })
  role: ParticipantRole;

  @Prop({ default: 0 })
  unreadCount: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Message', default: null })
  lastReadMessageId: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  lastReadAt: Date | null;

  @Prop({ default: false })
  isMuted: boolean;

  @Prop({ default: false })
  isArchived: boolean;

  @Prop({ default: false })
  isPinned: boolean;

  @Prop({ default: () => new Date() })
  joinedAt: Date;

  @Prop({ type: Date, default: null })
  leftAt: Date | null;
}

export const ConversationParticipantSchema = SchemaFactory.createForClass(
  ConversationParticipant,
);

ConversationParticipantSchema.index(
  { userId: 1, conversationId: 1 },
  { unique: true },
);
ConversationParticipantSchema.index({ conversationId: 1, role: 1 });
ConversationParticipantSchema.index({ userId: 1, leftAt: 1 });
