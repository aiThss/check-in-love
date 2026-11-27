import { apiFetch } from './client';
import { isMockPreviewMode } from '../dev/mock-data';
import type { OccasionPattern } from '../utils/occasion-catalog';

export interface AuthoredOccasionCard {
  id: string;
  occasionKey: string;
  kind: 'builtin' | 'custom';
  enabled: boolean;
  scheduleType: 'builtin' | 'once' | 'annual';
  customDate?: string;
  occasionLabel?: string;
  eyebrow?: string;
  title?: string;
  message?: string;
  signature?: string;
  coverText?: string;
  templateId?: string;
  pattern?: OccasionPattern;
  colors?: [string, string, string];
  scratchCoverUrl?: string;
  scratchCoverStoragePath?: string;
  backgroundImageUrl?: string;
  backgroundStoragePath?: string;
  updatedAt: string;
}

export interface ResolvedServerOccasionCard {
  id: string;
  occasionKey: string;
  occasionLabel: string;
  title: string;
  eyebrow: string;
  message: string;
  signature: string;
  coverText: string;
  icon: string;
  pattern: OccasionPattern;
  colors: [string, string, string];
  templateId?: string;
  coverImage?: string;
  scratchCoverUrl?: string;
  backgroundImageUrl?: string;
  senderName: string;
  isCustomized: boolean;
}

export interface ReceivedOccasionCardEntry {
  id: string;
  occasionKey: string;
  dateKey: string;
  revealedAt: string;
  card: ResolvedServerOccasionCard;
}

export interface UpcomingOccasionSummary {
  daysLeft: number;
  dateKey: string;
  label: string;
  isSecretSurprise: boolean;
}

export interface OccasionCardsDashboardResponse {
  authoredCards: AuthoredOccasionCard[];
  receivedAlbum: ReceivedOccasionCardEntry[];
  upcomingOccasion: UpcomingOccasionSummary | null;
}

export interface TodayOccasionCardResponse {
  dateKey: string;
  card: ResolvedServerOccasionCard | null;
  alreadyRevealed: boolean;
}

export interface UpsertOccasionCardPayload {
  kind?: 'builtin' | 'custom';
  enabled?: boolean;
  scheduleType?: 'builtin' | 'once' | 'annual';
  customDate?: string | null;
  occasionLabel?: string | null;
  eyebrow?: string | null;
  title?: string | null;
  message?: string | null;
  signature?: string | null;
  coverText?: string | null;
  templateId?: string | null;
  pattern?: OccasionPattern | null;
  colors?: [string, string, string] | null;
  scratchCoverUrl?: string | null;
  scratchCoverStoragePath?: string | null;
  backgroundImageUrl?: string | null;
  backgroundStoragePath?: string | null;
}

const MOCK_AUTHORED_STORAGE_KEY = 'lovecheck_ui_v2_mock_authored_cards';

function readMockAuthored(): AuthoredOccasionCard[] {
  try {
    const raw = localStorage.getItem(MOCK_AUTHORED_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthoredOccasionCard[]) : [];
  } catch {
    return [];
  }
}

function writeMockAuthored(items: AuthoredOccasionCard[]): void {
  try {
    localStorage.setItem(MOCK_AUTHORED_STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export async function getOccasionCardsDashboard(): Promise<OccasionCardsDashboardResponse> {
  if (isMockPreviewMode()) {
    return {
      authoredCards: readMockAuthored(),
      receivedAlbum: [],
      upcomingOccasion: {
        daysLeft: 12,
        dateKey: '2026-12-24',
        label: 'Đêm Giáng sinh (Noel)',
        isSecretSurprise: false,
      },
    };
  }
  return apiFetch<OccasionCardsDashboardResponse>('/occasion-cards');
}

export async function getTodayOccasionCard(): Promise<TodayOccasionCardResponse> {
  if (isMockPreviewMode()) {
    return {
      dateKey: new Date().toISOString().slice(0, 10),
      card: null,
      alreadyRevealed: false,
    };
  }
  return apiFetch<TodayOccasionCardResponse>('/occasion-cards/today');
}

export async function uploadOccasionCardAsset(file: File): Promise<{ url: string; storagePath: string }> {
  if (isMockPreviewMode()) {
    return {
      url: URL.createObjectURL(file),
      storagePath: `mock/${file.name}`,
    };
  }
  const formData = new FormData();
  formData.append('file', file, file.name || 'card-asset.jpg');
  return apiFetch<{ url: string; storagePath: string }>('/occasion-cards/upload', {
    method: 'POST',
    body: formData,
  });
}

export async function saveAuthoredOccasionCard(
  occasionKey: string,
  payload: UpsertOccasionCardPayload,
): Promise<{ card: AuthoredOccasionCard }> {
  if (isMockPreviewMode()) {
    const current = readMockAuthored().filter((c) => c.occasionKey !== occasionKey);
    const created: AuthoredOccasionCard = {
      id: `mock-${occasionKey}`,
      occasionKey,
      kind: payload.kind ?? 'builtin',
      enabled: payload.enabled ?? true,
      scheduleType: payload.scheduleType ?? 'builtin',
      customDate: payload.customDate ?? undefined,
      occasionLabel: payload.occasionLabel ?? undefined,
      eyebrow: payload.eyebrow ?? undefined,
      title: payload.title ?? undefined,
      message: payload.message ?? undefined,
      signature: payload.signature ?? undefined,
      coverText: payload.coverText ?? undefined,
      templateId: payload.templateId ?? undefined,
      pattern: payload.pattern ?? undefined,
      colors: payload.colors ?? undefined,
      scratchCoverUrl: payload.scratchCoverUrl ?? undefined,
      scratchCoverStoragePath: payload.scratchCoverStoragePath ?? undefined,
      backgroundImageUrl: payload.backgroundImageUrl ?? undefined,
      backgroundStoragePath: payload.backgroundStoragePath ?? undefined,
      updatedAt: new Date().toISOString(),
    };
    current.unshift(created);
    writeMockAuthored(current);
    return { card: created };
  }
  return apiFetch<{ card: AuthoredOccasionCard }>(`/occasion-cards/${encodeURIComponent(occasionKey)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteAuthoredOccasionCard(occasionKey: string): Promise<void> {
  if (isMockPreviewMode()) {
    writeMockAuthored(readMockAuthored().filter((c) => c.occasionKey !== occasionKey));
    return;
  }
  await apiFetch(`/occasion-cards/${encodeURIComponent(occasionKey)}`, {
    method: 'DELETE',
  });
}

export async function markOccasionCardRevealed(occasionKey: string): Promise<void> {
  if (isMockPreviewMode()) return;
  await apiFetch('/occasion-cards/reveal', {
    method: 'POST',
    body: JSON.stringify({ occasionKey }),
  });
}
