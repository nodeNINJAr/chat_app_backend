import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type BlockDocument = HydratedDocument<Block>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Block {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  blockerId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  blockedId: Types.ObjectId;
}

export const BlockSchema = SchemaFactory.createForClass(Block);

BlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
