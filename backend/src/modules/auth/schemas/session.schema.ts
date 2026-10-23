import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type SessionDocument = HydratedDocument<Session>;

/**
 * One refresh-token "family" = one login on one device.
 * Each /auth/refresh rotates the token inside the family; presenting an
 * already-rotated token (replay) revokes the whole family.
 * Only SHA-256 digests of tokens are stored, never the tokens themselves.
 */
@Schema({ timestamps: true, collection: 'sessions' })
export class Session {
  // Schema.Types.ObjectId (not Types.ObjectId) so string ids are cast in queries
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  /** Random id carried in the refresh token (`fam` claim). */
  @Prop({ required: true, unique: true })
  familyId: string;

  /** SHA-256 of the only refresh token currently valid for this family. */
  @Prop({ required: true })
  tokenHash: string;

  /** SHA-256 of the token replaced by the last rotation (race tolerance). */
  @Prop({ type: String, default: null })
  previousTokenHash: string | null;

  @Prop({ type: Date, default: null })
  rotatedAt: Date | null;

  /** Expiry of the current refresh token; MongoDB TTL index purges it. */
  @Prop({ type: Date, required: true })
  expiresAt: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
