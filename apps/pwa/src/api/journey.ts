import { apiFetch } from './client';
import { isMockPreviewMode } from '../dev/mock-data';

export type BucketCategory = 'dating' | 'travel' | 'cozy' | 'adventure' | 'future';

export interface BucketItem {
  id: string;
  title: string;
  category: BucketCategory;
  completed: boolean;
  completedDate?: string;
  note?: string;
  isCustom?: boolean;
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
}

export interface CoupleJourneyData {
  places: LovePlace[];
  bucketItems: BucketItem[];
}

export interface SaveJourneyOptions {
  places?: LovePlace[];
  bucketItems?: BucketItem[];
  actionType?:
    | 'add_bucket'
    | 'edit_bucket'
    | 'delete_bucket'
    | 'complete_bucket'
    | 'uncomplete_bucket'
    | 'add_place'
    | 'edit_place'
    | 'delete_place'
    | 'visit_place'
    | 'sync';
  itemTitle?: string;
}

export async function fetchCoupleJourney(): Promise<CoupleJourneyData> {
  if (isMockPreviewMode()) {
    return { places: [], bucketItems: [] };
  }
  return apiFetch<CoupleJourneyData>('/journey', {
    preserveSessionOnUnauthorized: true,
  });
}

export async function saveCoupleJourney(
  options: SaveJourneyOptions,
): Promise<CoupleJourneyData> {
  if (isMockPreviewMode()) {
    return {
      places: options.places ?? [],
      bucketItems: options.bucketItems ?? [],
    };
  }
  return apiFetch<CoupleJourneyData>('/journey', {
    method: 'PUT',
    body: JSON.stringify(options),
    preserveSessionOnUnauthorized: true,
  });
}

export async function syncCoupleJourneyWithServer(
  localPlaces: LovePlace[],
  localBucketItems: BucketItem[],
): Promise<CoupleJourneyData> {
  if (isMockPreviewMode()) {
    return { places: localPlaces, bucketItems: localBucketItems };
  }
  return apiFetch<CoupleJourneyData>('/journey/sync', {
    method: 'POST',
    body: JSON.stringify({ localPlaces, localBucketItems }),
    preserveSessionOnUnauthorized: true,
  });
}
