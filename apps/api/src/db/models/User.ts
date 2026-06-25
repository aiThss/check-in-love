import mongoose, { Document, Schema, Types } from 'mongoose';

export interface UserDocument extends Document {
  _id: Types.ObjectId;
  displayName: string;
  partnerName: string;
  email?: string;
  email_aliases?: string[];
  passwordHash?: string;
  avatarUrl?: string;
  partnerAvatarUrl?: string;
  trustedDevices: string[];
  fcmTokens?: string[];
  role: 'user' | 'admin';
  status: 'active' | 'blocked';
  coupleId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    displayName: { type: String, required: true },
    partnerName: { type: String, required: true },
    email: { type: String, required: false },
    email_aliases: { type: [String], default: [] },
    passwordHash: { type: String, required: false },
    avatarUrl: { type: String, required: false },
    partnerAvatarUrl: { type: String, required: false },
    trustedDevices: { type: [String], default: [] },
    fcmTokens: { type: [String], default: [] },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['active', 'blocked'],
      default: 'active',
    },
    coupleId: {
      type: Schema.Types.ObjectId,
      ref: 'Couple',
      required: true,
    },
  },
  { timestamps: true },
);

// Sparse unique index: only enforces uniqueness when email is not null
UserSchema.index({ email: 1 }, { unique: true, sparse: true });
UserSchema.index({ email_aliases: 1 });

export const User = mongoose.model<UserDocument>('User', UserSchema);
