import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type GroupDocument = HydratedDocument<Group>;
export type WhoCanAct = 'everyone' | 'admins';

@Schema({ _id: false })
class GroupSettings {
  @Prop({ default: 'everyone', enum: ['everyone', 'admins'] })
  whoCanSendMessages: WhoCanAct;

  @Prop({ default: 'everyone', enum: ['everyone', 'admins'] })
  whoCanAddMembers: WhoCanAct;
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Group {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  })
  conversationId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, default: null })
  description: string | null;

  @Prop({ type: String, default: null })
  avatarUrl: string | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  ownerId: Types.ObjectId;

  @Prop({ default: 0 })
  memberCount: number;

  @Prop({ type: GroupSettings, default: () => ({}) })
  settings: GroupSettings;
}

export const GroupSchema = SchemaFactory.createForClass(Group);

GroupSchema.index({ conversationId: 1 }, { unique: true });
