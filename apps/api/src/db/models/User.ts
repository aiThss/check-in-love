import mongoose, { Document, Schema, Types } from 'mongoose';

export interface UserDocument extends Document {
  _id: Types.ObjectId;
  displayName: string;
  partnerName: string;
  email?: string;
  email_aliases?: string[];
  googleId?: string;
  passwordHash?: string;
  avatarUrl?: string;
  partnerAvatarUrl?: string;
  birthday?: Date;
  partnerBirthday?: Date;
  trustedDevices: string[];
  fcmTokens?: string[];
  checkinReminder: {
    enabled: boolean;
    time: string;
    timezone: string;
    lastSentDate?: string;
    leaseDate?: string;
  };
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
    googleId: { type: String, required: false },
    passwordHash: { type: String, required: false },
    avatarUrl: { type: String, required: false },
    partnerAvatarUrl: { type: String, required: false },
    birthday: { type: Date, required: false },
    partnerBirthday: { type: Date, required: false },
    trustedDevices: { type: [String], default: [] },
    fcmTokens: { type: [String], default: [] },
    checkinReminder: {
      enabled: { type: Boolean, default: false },
      time: { type: String, default: '20:30' },
      timezone: { type: String, default: 'Asia/Ho_Chi_Minh' },
      lastSentDate: { type: String, required: false },
      leaseDate: { type: String, required: false },
    },
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
UserSchema.index({ googleId: 1 }, { unique: true, sparse: true });

export const User = mongoose.model<UserDocument>('User', UserSchema);
