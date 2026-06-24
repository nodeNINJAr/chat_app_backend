import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type CallDocument = HydratedDocument<Call>;
export type CallType = 'audio' | 'video';
export type CallStatus =
  | 'ringing'
  | 'active'
  | 'completed'
  | 'missed'
  | 'rejected'
  | 'cancelled';

@Schema({ timestamps: false })
export class Call {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  })
  conversationId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  callerId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  calleeId: Types.ObjectId;

  @Prop({ required: true, enum: ['audio', 'video'] })
  type: CallType;

  @Prop({
    required: true,
    enum: ['ringing', 'active', 'completed', 'missed', 'rejected', 'cancelled'],
    default: 'ringing',
  })
  status: CallStatus;

  @Prop({ default: () => new Date() })
  startedAt: Date;

  @Prop({ type: Date, default: null })
  answeredAt: Date | null;

  @Prop({ type: Date, default: null })
  endedAt: Date | null;

  @Prop({ type: Number, default: null })
  durationSec: number | null;
}

export const CallSchema = SchemaFactory.createForClass(Call);

CallSchema.index({ callerId: 1, startedAt: -1 });
CallSchema.index({ calleeId: 1, startedAt: -1 });
CallSchema.index({ conversationId: 1, startedAt: -1 });
