import mongoose, { Document, Schema } from 'mongoose';

export interface OtpCodeDocument extends Document {
  email: string;
  code: string;
  purpose: 'signup' | 'login';
  expiresAt: Date;
  verified: boolean;
  createdAt: Date;
}

const OtpCodeSchema = new Schema<OtpCodeDocument>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    code: { type: String, required: true },
    purpose: {
      type: String,
      enum: ['signup', 'login'],
      default: 'signup',
      required: true,
    },
    expiresAt: { type: Date, required: true },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Auto-delete expired docs via MongoDB TTL index
OtpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
OtpCodeSchema.index({ email: 1, purpose: 1 });

export const OtpCode = mongoose.model<OtpCodeDocument>('OtpCode', OtpCodeSchema);
