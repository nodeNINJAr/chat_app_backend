import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export type LastSeenVisibility = 'everyone' | 'contacts' | 'nobody';

@Schema({ _id: false })
class Device {
  @Prop({ required: true })
  deviceId: string;

  @Prop({ required: true })
  pushToken: string;

  @Prop({ required: true, enum: ['ios', 'android', 'web'] })
  platform: 'ios' | 'android' | 'web';

  @Prop({ default: () => new Date() })
  lastActiveAt: Date;
}

@Schema({ _id: false })
class Privacy {
  @Prop({ default: 'everyone', enum: ['everyone', 'contacts', 'nobody'] })
  lastSeenVisibility: LastSeenVisibility;

  @Prop({ default: true })
  readReceiptsEnabled: boolean;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  username: string;

  @Prop({ unique: true, sparse: true, lowercase: true, trim: true })
  email?: string;

  @Prop({ unique: true, sparse: true, trim: true })
  phone?: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true, trim: true })
  displayName: string;

  @Prop({ type: String, default: null })
  avatarUrl: string | null;

  @Prop({ type: String, default: null })
  bio: string | null;

  @Prop({ default: 'offline', enum: ['online', 'offline'] })
  status: 'online' | 'offline';

  @Prop({ default: () => new Date() })
  lastSeenAt: Date;

  @Prop({ type: Privacy, default: () => ({}) })
  privacy: Privacy;

  @Prop({ type: [Device], default: [] })
  devices: Device[];
}

export const UserSchema = SchemaFactory.createForClass(User);

// username/email/phone uniqueness is already indexed via @Prop({ unique: true }) above.
UserSchema.index({ displayName: 'text', username: 'text' });
