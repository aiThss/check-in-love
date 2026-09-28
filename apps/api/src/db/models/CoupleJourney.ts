import mongoose, { Document, Schema, Types } from 'mongoose';

export type BucketCategory = 'dating' | 'travel' | 'cozy' | 'adventure' | 'future';

export interface BucketItem {
  id: string;
  title: string;
  category: BucketCategory;
  completed: boolean;
  completedDate?: string;
  note?: string;
  isCustom?: boolean;
  createdBy?: Types.ObjectId;
}

export interface LovePlace {
  id: string;
  name: string;
  region?: 'north' | 'central' | 'south' | 'islands';
  latitude: number;
  longitude: number;
  status: 'visited' | 'wishlist';
  visitedDate?: string;
  note?: string;
  photoUrl?: string;
  x?: number;
  y?: number;
  createdBy?: Types.ObjectId;
}

export interface CoupleJourneyDocument extends Document {
  _id: Types.ObjectId;
  coupleId: Types.ObjectId;
  places: LovePlace[];
  bucketItems: BucketItem[];
  createdAt: Date;
  updatedAt: Date;
}

const BucketItemSchema = new Schema<BucketItem>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    category: {
      type: String,
      enum: ['dating', 'travel', 'cozy', 'adventure', 'future'],
      required: true,
      default: 'dating',
    },
    completed: { type: Boolean, default: false },
    completedDate: { type: String, maxlength: 40 },
    note: { type: String, maxlength: 1000 },
    isCustom: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false },
);

const LovePlaceSchema = new Schema<LovePlace>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    region: {
      type: String,
      enum: ['north', 'central', 'south', 'islands'],
      default: 'central',
    },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    status: {
      type: String,
      enum: ['visited', 'wishlist'],
      required: true,
      default: 'wishlist',
    },
    visitedDate: { type: String, maxlength: 40 },
    note: { type: String, maxlength: 1000 },
    photoUrl: { type: String, maxlength: 2048 },
    x: { type: Number },
    y: { type: Number },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false },
);

const CoupleJourneySchema = new Schema<CoupleJourneyDocument>(
  {
    coupleId: {
      type: Schema.Types.ObjectId,
      ref: 'Couple',
      required: true,
      unique: true,
      index: true,
    },
    places: {
      type: [LovePlaceSchema],
      default: [],
    },
    bucketItems: {
      type: [BucketItemSchema],
      default: [],
    },
  },
  { timestamps: true },
);

export const CoupleJourney = mongoose.model<CoupleJourneyDocument>(
  'CoupleJourney',
  CoupleJourneySchema,
);
