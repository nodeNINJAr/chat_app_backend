import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;
export type ConversationType = 'direct' | 'group';

@Schema({ _id: false })
class LastMessageSnapshot {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Message', required: true })
  messageId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  preview: string;

  @Prop({ required: true })
  createdAt: Date;
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Conversation {
  @Prop({ required: true, enum: ['direct', 'group'] })
  type: ConversationType;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Group', default: null })
  groupId: Types.ObjectId | null;

  /**
   * Sorted "userIdA_userIdB" pair, set only for type:'direct'.
   * The unique index on this field is what makes get-or-create idempotent
   * without a transaction or app-level locking.
   */
  @Prop({ type: String, default: null })
  participantsHash: string | null;

  @Prop({ type: LastMessageSnapshot, default: null })
  lastMessage: LastMessageSnapshot | null;

  @Prop({ default: () => new Date() })
  lastMessageAt: Date;
}

export interface LastMessageSnapshotInput {
  messageId: Types.ObjectId | string;
  senderId: Types.ObjectId | string;
  type: string;
  preview: string;
  createdAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index(
  { type: 1, participantsHash: 1 },
  { unique: true, partialFilterExpression: { type: 'direct' } },
);
ConversationSchema.index({ lastMessageAt: -1 });

export function directParticipantsHash(
  userIdA: string,
  userIdB: string,
): string {
  return [userIdA, userIdB].sort().join('_');
}
