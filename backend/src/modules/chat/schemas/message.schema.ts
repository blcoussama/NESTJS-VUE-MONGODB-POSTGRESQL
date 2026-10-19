import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { MESSAGE_MAX_LENGTH } from '../chat.constants';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ collection: 'messages', timestamps: true })
export class Message {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  from: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  to: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: MESSAGE_MAX_LENGTH,
  })
  text: string;

  // null = not read yet by the recipient
  @Prop({ type: Date, default: null })
  readAt: Date | null;

  // Managed by `timestamps: true`
  createdAt: Date;
  updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Conversation history (both directions are two scans of this index) + cursor
MessageSchema.index({ from: 1, to: 1, createdAt: -1 });
// Unread counters and "mark as read"
MessageSchema.index({ to: 1, readAt: 1 });
