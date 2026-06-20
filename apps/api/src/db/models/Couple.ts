import mongoose, { Document, Schema, Types } from 'mongoose';

export interface CoupleDocument extends Document {
  _id: Types.ObjectId;
  code: string;
  loveStartDate?: Date;
  memberIds: Types.ObjectId[];
  streak: number;
  lastCheckinDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CoupleSchema = new Schema<CoupleDocument>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    loveStartDate: {
      type: Date,
      required: false,
    },
    memberIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
      validate: {
        validator: (arr: Types.ObjectId[]) => arr.length <= 2,
        message: 'A couple can have at most 2 members',
      },
    },
    streak: {
      type: Number,
      default: 0,
    },
    lastCheckinDate: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true },
);

export const Couple = mongoose.model<CoupleDocument>('Couple', CoupleSchema);
