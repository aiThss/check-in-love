import { Map as MapLibreMap, Marker, LngLatBounds, setWorkerUrl } from 'maplibre-gl';
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { navigate } from '../router';
import { showToast } from '../components/toast';
import { store } from '../store/index';
import {
  saveCoupleJourney,
  syncCoupleJourneyWithServer,
} from '../api/journey';

setWorkerUrl(mapLibreWorkerUrl);

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
  // Preserved for backward-compatibility with v1 stored items
  x?: number;
  y?: number;
}

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

export interface KnownPlaceInfo {
  name: string;
  latitude: number;
  longitude: number;
  region: 'north' | 'central' | 'south' | 'islands';
}

export const KNOWN_VIETNAM_PLACES: KnownPlaceInfo[] = [
  { name: 'Hà Nội', latitude: 21.0285, longitude: 105.8542, region: 'north' },
  { name: 'Sa Pa', latitude: 22.3364, longitude: 103.8438, region: 'north' },
  { name: 'Hạ Long', latitude: 20.9505, longitude: 107.0734, region: 'north' },
  { name: 'Ninh Bình', latitude: 20.2506, longitude: 105.9745, region: 'north' },
  { name: 'Hải Phòng', latitude: 20.8449, longitude: 106.6881, region: 'north' },
  { name: 'Cát Bà', latitude: 20.7275, longitude: 107.0450, region: 'north' },
  { name: 'Hà Giang', latitude: 22.8233, longitude: 104.9839, region: 'north' },
  { name: 'Mộc Châu', latitude: 20.8442, longitude: 104.6494, region: 'north' },
  { name: 'Tam Đảo', latitude: 21.4583, longitude: 105.6444, region: 'north' },
  { name: 'Huế', latitude: 16.4637, longitude: 107.5909, region: 'central' },
  { name: 'Đà Nẵng', latitude: 16.0544, longitude: 108.2022, region: 'central' },
  { name: 'Hội An', latitude: 15.8801, longitude: 108.3380, region: 'central' },
  { name: 'Quy Nhơn', latitude: 13.7820, longitude: 109.2197, region: 'central' },
  { name: 'Nha Trang', latitude: 12.2388, longitude: 109.1967, region: 'central' },
  { name: 'Đà Lạt', latitude: 11.9404, longitude: 108.4583, region: 'central' },
  { name: 'Buôn Ma Thuột', latitude: 12.6675, longitude: 108.0383, region: 'central' },
  { name: 'Pleiku', latitude: 13.9833, longitude: 108.0000, region: 'central' },
  { name: 'Phan Thiết', latitude: 10.9333, longitude: 108.1000, region: 'south' },
  { name: 'TP. Hồ Chí Minh', latitude: 10.8231, longitude: 106.6297, region: 'south' },
  { name: 'Vũng Tàu', latitude: 10.3460, longitude: 107.0843, region: 'south' },
  { name: 'Cần Thơ', latitude: 10.0452, longitude: 105.7469, region: 'south' },
  { name: 'Phú Quốc', latitude: 10.2899, longitude: 103.9840, region: 'islands' },
  { name: 'Côn Đảo', latitude: 8.6835, longitude: 106.6075, region: 'islands' },
  { name: 'Lý Sơn', latitude: 15.3789, longitude: 109.1235, region: 'islands' },
  { name: 'Phú Quý', latitude: 10.5186, longitude: 108.9482, region: 'islands' },
  { name: 'Quảng Bình', latitude: 17.4687, longitude: 106.6225, region: 'central' },
  { name: 'Nghệ An', latitude: 18.6734, longitude: 105.6813, region: 'north' },
  { name: 'Thanh Hóa', latitude: 19.8067, longitude: 105.7852, region: 'north' },
  { name: 'Tây Ninh', latitude: 11.3100, longitude: 106.0983, region: 'south' },
  { name: 'Bến Tre', latitude: 10.2433, longitude: 106.3756, region: 'south' },
  { name: 'An Giang', latitude: 10.5216, longitude: 105.1259, region: 'south' },
];

export const PLACES_STORAGE_KEY = 'lovecheck_journey_places';
export const BUCKET_STORAGE_KEY = 'lovecheck_journey_bucket';
export const MIGRATION_SEED_CLEANUP_KEY = 'lovecheck_journey_seed_cleanup_v1';

/**
 * OpenFreeMap official vector styles.
 * Fully open-source, unlimited public vector tile hosting, zero API key required.
 */
export const OPENFREEMAP_BRIGHT_STYLE = 'https://tiles.openfreemap.org/styles/bright';
export const OPENFREEMAP_DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';

export const VIETNAM_SEA_LABELS = [
  {
    id: 'hainan',
    title: 'Đảo Hải Nam',
    latitude: 19.2,
    longitude: 109.7,
    variant: 'context',
  },
  {
    id: 'hoang-sa',
    title: 'QĐ. Hoàng Sa',
    subtitle: 'Đà Nẵng · Việt Nam',
    latitude: 16.5,
    longitude: 112.25,
    variant: 'territory',
  },
  {
    id: 'bien-dong',
    title: 'Biển Đông',
    latitude: 13.35,
    longitude: 111.15,
    variant: 'sea',
  },
  {
    id: 'truong-sa',
    title: 'QĐ. Trường Sa',
    subtitle: 'Khánh Hòa · Việt Nam',
    latitude: 10.78,
    longitude: 115.75,
    variant: 'territory',
  },
] as const;

// The label anchors above identify broad geographic areas, not maritime boundaries.
export const VIETNAM_BOUNDS: [[number, number], [number, number]] = [
  [102.0, 6.2],
  [117.9, 23.5],
];

/**
 * Legacy demo seed items from previous versions.
 * Kept strictly as reference data for safe one-time migration cleanup.
 * Never used as defaults for new users.
 */
const LEGACY_SEED_PLACES = [
  { id: 'sapa', name: 'Sa Pa', region: 'north', x: 34, y: 12, status: 'wishlist', note: 'Săn mây Fansipan và nắm tay nhau giữa sương mù' },
  { id: 'hanoi', name: 'Hà Nội', region: 'north', x: 48, y: 18, status: 'visited', visitedDate: '2024-10-10', note: 'Dạo quanh Hồ Gươm mùa hoa sữa và thưởng thức cà phê trứng' },
  { id: 'halong', name: 'Hạ Long', region: 'north', x: 59, y: 19, status: 'wishlist', note: 'Đi du thuyền ngắm hoàng hôn buông xuống vịnh' },
  { id: 'ninhbinh', name: 'Ninh Bình', region: 'north', x: 46, y: 25, status: 'visited', visitedDate: '2024-11-20', note: 'Chèo thuyền Tràng An non nước hữu tình' },
  { id: 'hue', name: 'Huế', region: 'central', x: 58, y: 44, status: 'wishlist', note: 'Ngắm chiều tà sông Hương và khám phá Đại Nội cổ kính' },
  { id: 'danang', name: 'Đà Nẵng', region: 'central', x: 67, y: 48, status: 'visited', visitedDate: '2025-01-15', note: 'Cùng xem Cầu Rồng phun lửa và dạo biển Mỹ Khê' },
  { id: 'hoian', name: 'Hội An', region: 'central', x: 69, y: 53, status: 'visited', visitedDate: '2025-01-16', note: 'Thả hoa đăng trên sông Hoài gửi gắm ước nguyện' },
  { id: 'quynhon', name: 'Quy Nhơn', region: 'central', x: 74, y: 64, status: 'wishlist', note: 'Check-in Eo Gió đón bình minh đầu tiên của ngày' },
  { id: 'dalat', name: 'Đà Lạt', region: 'south', x: 66, y: 74, status: 'visited', visitedDate: '2024-12-24', note: 'Đêm Giáng sinh se lạnh ngồi bên lẩu bò ấm nóng' },
  { id: 'nhatrang', name: 'Nha Trang', region: 'south', x: 75, y: 76, status: 'wishlist', note: 'Lặn ngắm san hô và đón gió biển lộng gió' },
  { id: 'saigon', name: 'TP. Hồ Chí Minh', region: 'south', x: 53, y: 84, status: 'visited', visitedDate: '2024-09-01', note: 'Cà phê bệt nhà thờ và ngắm phố lung linh từ trên cao' },
  { id: 'vungtau', name: 'Vũng Tàu', region: 'south', x: 59, y: 88, status: 'visited', visitedDate: '2024-10-02', note: 'Lên ngọn hải đăng ngắm toàn cảnh biển xanh' },
  { id: 'phuquoc', name: 'Phú Quốc', region: 'islands', x: 33, y: 92, status: 'wishlist', note: 'Ngắm hoàng hôn lộng lẫy và thưởng thức hải sản đêm' },
];

const LEGACY_SEED_BUCKET = [
  { id: 'b1', title: 'Ăn tối lãng mạn dưới ánh nến tại nhà', category: 'dating', completed: true, completedDate: '2024-11-15', note: 'Tự tay nấu mì ý và cắm hoa xinh' },
  { id: 'b2', title: 'Cùng đi xem một bộ phim suất chiếu nửa đêm', category: 'dating', completed: true, completedDate: '2024-10-31', note: 'Rạp vắng tanh chỉ có hai đứa' },
  { id: 'b3', title: 'Hẹn hò tại quán cà phê sách yên tĩnh', category: 'dating', completed: false, note: 'Mỗi đứa đọc một cuốn sách và nhâm nhi trà nóng' },
  { id: 'b4', title: 'Uống cocktail ở một rooftop ngắm toàn cảnh thành phố', category: 'dating', completed: false, note: 'Chọn một buổi tối gió mát' },
  { id: 'b5', title: 'Cùng nhau ngắm bình minh trên đỉnh núi sương mù', category: 'travel', completed: false, note: 'Mang theo áo ấm và bình giữ nhiệt' },
  { id: 'b6', title: 'Chuyến phượt bằng xe máy ngẫu hứng không lên kế hoạch', category: 'travel', completed: true, completedDate: '2025-02-14', note: 'Cứ rẽ vào con đường thấy đẹp' },
  { id: 'b7', title: 'Thả đèn hoa đăng cầu bình an và tình duyên', category: 'travel', completed: true, completedDate: '2025-01-16', note: 'Ở dòng sông Hoài phố cổ Hội An' },
  { id: 'b8', title: 'Đi dạo biển vào mùa đông và ôm nhau thật chặt', category: 'travel', completed: false, note: 'Cảm giác gió lạnh rất lãng mạn' },
  { id: 'b9', title: 'Nấu một bữa ăn nóng hổi cùng nhau vào ngày mưa tầm tã', category: 'cozy', completed: true, completedDate: '2024-09-18', note: 'Canh kim chi và cơm nóng' },
  { id: 'b10', title: 'Thức khuya cùng xem trọn bộ phim tình cảm yêu thích', category: 'cozy', completed: true, completedDate: '2024-12-10', note: 'Đắp chung một chiếc chăn bông' },
  { id: 'b11', title: 'Cùng dọn dẹp và trang trí góc phòng ấm cúng', category: 'cozy', completed: false, note: 'Treo thêm đèn đom đóm vàng' },
  { id: 'b12', title: 'Tham gia một buổi học làm đồ gốm đôi', category: 'adventure', completed: false, note: 'Làm tặng nhau hai chiếc cốc tự nặn' },
  { id: 'b13', title: 'Chụp một bộ ảnh kỷ niệm phong cách polaroid hoài niệm', category: 'adventure', completed: true, completedDate: '2025-01-01', note: 'Lưu vào sổ ký ức' },
  { id: 'b14', title: 'Cùng nuôi một chú mèo hoặc chú cún xinh xắn', category: 'future', completed: false, note: 'Đặt tên thật dễ thương' },
  { id: 'b15', title: 'Viết một bức thư tay và mở ra đọc sau 5 năm', category: 'future', completed: false, note: 'Giữ kín bí mật đến đúng ngày kỷ niệm' },
];

const CATEGORY_MAP: Record<BucketCategory, { label: string; icon: string }> = {
  dating: { label: 'Hẹn hò', icon: '🍷' },
  travel: { label: 'Du lịch', icon: '✈️' },
  cozy: { label: 'Đời thường', icon: '🏡' },
  adventure: { label: 'Trải nghiệm', icon: '🎨' },
  future: { label: 'Tương lai', icon: '💍' },
};

function normalizeText(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isExactUnmodifiedSeedPlaces(items: unknown[]): boolean {
  if (!Array.isArray(items) || items.length === 0) return true;
  const seedMap = new Map(LEGACY_SEED_PLACES.map((p) => [p.id, p]));
  for (const item of items) {
    if (!item || typeof item !== 'object') return false;
    const p = item as Partial<LovePlace>;
    if (!p.id || !seedMap.has(p.id)) return false;
    const original = seedMap.get(p.id)!;
    if (p.name !== original.name) return false;
    if (p.status !== original.status) return false;
    if ((p.note || '') !== (original.note || '')) return false;
    if ((p.visitedDate || '') !== (original.visitedDate || '')) return false;
  }
  return true;
}

function isExactUnmodifiedSeedBucket(items: unknown[]): boolean {
  if (!Array.isArray(items) || items.length === 0) return true;
  const seedMap = new Map(LEGACY_SEED_BUCKET.map((b) => [b.id, b]));
  for (const item of items) {
    if (!item || typeof item !== 'object') return false;
    const b = item as Partial<BucketItem>;
    if (!b.id || !seedMap.has(b.id)) return false;
    const original = seedMap.get(b.id)!;
    if (b.title !== original.title) return false;
    if (b.category !== original.category) return false;
    if (b.completed !== original.completed) return false;
    if ((b.note || '') !== (original.note || '')) return false;
    if ((b.completedDate || '') !== (original.completedDate || '')) return false;
  }
  return true;
}

export function runSeedCleanupMigration(): void {
  try {
    if (localStorage.getItem(MIGRATION_SEED_CLEANUP_KEY) === 'true') {
      return;
    }

    const rawPlaces = localStorage.getItem(PLACES_STORAGE_KEY);
    if (rawPlaces) {
      try {
        const parsed = JSON.parse(rawPlaces);
        if (Array.isArray(parsed) && isExactUnmodifiedSeedPlaces(parsed)) {
          localStorage.setItem(PLACES_STORAGE_KEY, JSON.stringify([]));
        }
      } catch {
        // preserve on parse error
      }
    }

    const rawBucket = localStorage.getItem(BUCKET_STORAGE_KEY);
    if (rawBucket) {
      try {
        const parsed = JSON.parse(rawBucket);
        if (Array.isArray(parsed) && isExactUnmodifiedSeedBucket(parsed)) {
          localStorage.setItem(BUCKET_STORAGE_KEY, JSON.stringify([]));
        }
      } catch {
        // preserve on parse error
      }
    }

    localStorage.setItem(MIGRATION_SEED_CLEANUP_KEY, 'true');
  } catch {
    // ignore sandbox/quota errors
  }
}

export function migrateLegacyPlaces(rawList: unknown[]): LovePlace[] {
  if (!Array.isArray(rawList)) return [];

  let hasMigrationChanges = false;
  const migrated: LovePlace[] = [];

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Partial<LovePlace>;
    if (!p.id || !p.name) continue;

    let lat = typeof p.latitude === 'number' && !Number.isNaN(p.latitude) ? p.latitude : undefined;
    let lng = typeof p.longitude === 'number' && !Number.isNaN(p.longitude) ? p.longitude : undefined;
    let region = p.region;

    // Convert legacy x, y percentage schema to real geographical coordinates
    if (lat === undefined || lng === undefined) {
      hasMigrationChanges = true;
      const normalizedName = normalizeText(p.name);
      const match = KNOWN_VIETNAM_PLACES.find((k) => {
        const kn = normalizeText(k.name);
        return kn === normalizedName || normalizedName.includes(kn) || kn.includes(normalizedName);
      });

      if (match) {
        lat = match.latitude;
        lng = match.longitude;
        if (!region) region = match.region;
      } else if (typeof p.x === 'number' && typeof p.y === 'number') {
        // Interpolate within Vietnam bounding box [102.0, 8.5] to [109.5, 23.4]
        lat = 23.4 - (p.y / 100) * (23.4 - 8.5);
        lng = 102.0 + (p.x / 100) * (109.5 - 102.0);
      } else {
        switch (region) {
          case 'north': lat = 21.0285; lng = 105.8542; break;
          case 'central': lat = 16.0544; lng = 108.2022; break;
          case 'south': lat = 10.8231; lng = 106.6297; break;
          case 'islands': lat = 10.2899; lng = 103.9840; break;
          default: lat = 16.0544; lng = 108.2022; region = 'central'; break;
        }
      }
    }

    const place: LovePlace = {
      id: String(p.id),
      name: String(p.name),
      region: region || 'central',
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
      status: p.status === 'visited' ? 'visited' : 'wishlist',
      visitedDate: typeof p.visitedDate === 'string' ? p.visitedDate : undefined,
      note: typeof p.note === 'string' ? p.note : undefined,
      photoUrl: typeof p.photoUrl === 'string' ? p.photoUrl : undefined,
      x: p.x,
      y: p.y,
    };

    migrated.push(place);
  }

  if (hasMigrationChanges) {
    saveStoredPlaces(migrated);
  }

  return migrated;
}

export function isValidLovePlace(item: unknown): item is LovePlace {
  if (!item || typeof item !== 'object') return false;
  const p = item as Record<string, unknown>;
  if (typeof p.id !== 'string' || !p.id.trim()) return false;
  if (typeof p.name !== 'string' || !p.name.trim()) return false;
  const hasLatLng = typeof p.latitude === 'number' && !Number.isNaN(p.latitude)
    && typeof p.longitude === 'number' && !Number.isNaN(p.longitude);
  const hasXY = typeof p.x === 'number' && typeof p.y === 'number';
  if (!hasLatLng && !hasXY) return false;
  if (p.status !== 'visited' && p.status !== 'wishlist') return false;
  if (p.visitedDate !== undefined && typeof p.visitedDate !== 'string') return false;
  if (p.note !== undefined && typeof p.note !== 'string') return false;
  return true;
}

export function isValidBucketItem(item: unknown): item is BucketItem {
  if (!item || typeof item !== 'object') return false;
  const b = item as Record<string, unknown>;
  if (typeof b.id !== 'string' || !b.id.trim()) return false;
  if (typeof b.title !== 'string' || !b.title.trim()) return false;
  if (b.category !== 'dating' && b.category !== 'travel' && b.category !== 'cozy' && b.category !== 'adventure' && b.category !== 'future') return false;
  if (typeof b.completed !== 'boolean') return false;
  if (b.completedDate !== undefined && typeof b.completedDate !== 'string') return false;
  if (b.note !== undefined && typeof b.note !== 'string') return false;
  return true;
}

export function loadStoredPlaces(): LovePlace[] {
  runSeedCleanupMigration();
  try {
    const raw = localStorage.getItem(PLACES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return migrateLegacyPlaces(parsed);
  } catch {
    return [];
  }
}

export function saveStoredPlaces(places: LovePlace[]): void {
  try {
    localStorage.setItem(PLACES_STORAGE_KEY, JSON.stringify(places));
  } catch {
    // ignore
  }
}

export function loadStoredBucket(): BucketItem[] {
  runSeedCleanupMigration();
  try {
    const raw = localStorage.getItem(BUCKET_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidBucketItem);
  } catch {
    return [];
  }
}

export function saveStoredBucket(items: BucketItem[]): void {
  try {
    localStorage.setItem(BUCKET_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function triggerHeartSparkles(originX: number, originY: number): void {
  const emojis = ['💖', '✨', '❤️', '🌸', '💫'];
  for (let i = 0; i < 7; i++) {
    const particle = document.createElement('span');
    particle.className = 'heart-sparkle-particle';
    particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    particle.style.left = `${originX}px`;
    particle.style.top = `${originY}px`;
    const angle = (Math.PI * 2 * i) / 7 + (Math.random() - 0.5) * 0.4;
    const distance = 40 + Math.random() * 45;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance - 20;
    particle.style.setProperty('--tx', `${tx}px`);
    particle.style.setProperty('--ty', `${ty}px`);
    document.body.appendChild(particle);
    setTimeout(() => particle.remove(), 800);
  }
}

function isDarkTheme(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark'
    || (store.get().theme === 'dark')
    || (store.get().theme === 'system' && Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches));
}

function getMapStyle(): string {
  return isDarkTheme() ? OPENFREEMAP_DARK_STYLE : OPENFREEMAP_BRIGHT_STYLE;
}

function getJourneyLineCoordinates(places: LovePlace[]): [number, number][] {
  return places
    .filter((p) => p.status === 'visited')
    .sort((a, b) => {
      if (a.visitedDate && b.visitedDate) {
        return a.visitedDate.localeCompare(b.visitedDate);
      }
      if (a.visitedDate) return -1;
      if (b.visitedDate) return 1;
      return 0;
    })
    .map((p) => [p.longitude, p.latitude]);
}

export function renderLoveJourneyPage(): HTMLElement {
  const root = document.createElement('div') as HTMLElement & {
    destroy?: () => void;
  };
  root.className = 'page journey-page animate-fade-in';

  let places = loadStoredPlaces();
  let bucketItems = loadStoredBucket();
  let selectedPlaceId: string = places[0]?.id || '';
  let activeTab: 'map' | 'bucket' = window.location.pathname.includes('bucket') ? 'bucket' : 'map';
  let activeFilter: 'all' | 'incomplete' | 'completed' | BucketCategory = 'all';
  let activeMapFilter: 'all' | 'visited' | 'wishlist' = 'all';

  let map: MapLibreMap | null = null;
  let activeMarkers: Marker[] = [];
  let seaLabelMarkers: Marker[] = [];

  // 1. Hero Header
  const hero = document.createElement('header');
  hero.className = 'journey-hero';
  hero.innerHTML = `
    <div class="journey-tag-row">
      <span class="journey-badge">🗺️ HÀNH TRÌNH ĐÔI</span>
      <button type="button" class="btn-ghost" id="journey-back-btn" style="padding:6px 12px;border-radius:12px;font-size:13px;">
        ← Về Home
      </button>
    </div>
    <h1 class="journey-title">Bản đồ hẹn hò & Điều ước</h1>
    <p class="journey-subtitle">
      Từng vùng đất hai đứa đã cùng nhau đặt chân tới và những ước mơ ngọt ngào đang chờ hai bạn chạm tới.
    </p>
    <div class="journey-stats-strip">
      <div class="journey-stat-card">
        <span class="journey-stat-label">Toạ độ đã đi</span>
        <div class="journey-stat-value" id="stat-visited-places">
          0 <span class="journey-stat-total">/ 0</span>
        </div>
      </div>
      <div class="journey-stat-card">
        <span class="journey-stat-label">Điều ước đạt được</span>
        <div class="journey-stat-value" id="stat-completed-bucket">
          0 <span class="journey-stat-total">/ 0</span>
        </div>
      </div>
      <div class="journey-stat-card">
        <span class="journey-stat-label">Tiến độ ước mơ</span>
        <div class="journey-stat-value" id="stat-progress-percent">
          0%
        </div>
      </div>
    </div>
  `;
  root.appendChild(hero);

  hero.querySelector('#journey-back-btn')?.addEventListener('click', () => {
    navigate('/app/home');
  });

  // 2. Mobile View Switcher Tabs
  const tabContainer = document.createElement('div');
  tabContainer.className = 'journey-tabs';
  tabContainer.innerHTML = `
    <button type="button" class="journey-tab-btn${activeTab === 'map' ? ' active' : ''}" data-tab="map">
      <span>🗺️</span> Bản đồ toạ độ
    </button>
    <button type="button" class="journey-tab-btn${activeTab === 'bucket' ? ' active' : ''}" data-tab="bucket">
      <span>✨</span> Điều ước
    </button>
  `;
  root.appendChild(tabContainer);

  // 3. Main Grid (Two panels: Map & Bucket)
  const mainGrid = document.createElement('div');
  mainGrid.className = 'journey-main-grid';
  root.appendChild(mainGrid);

  // Panel 1: Map Panel
  const mapPanel = document.createElement('section');
  mapPanel.className = 'journey-map-panel';
  mapPanel.id = 'journey-map-section';
  mainGrid.appendChild(mapPanel);

  // Panel 2: Bucket List Panel
  const bucketPanel = document.createElement('section');
  bucketPanel.className = 'journey-bucket-panel';
  bucketPanel.id = 'journey-bucket-section';
  mainGrid.appendChild(bucketPanel);

  // Tab switcher
  tabContainer.querySelectorAll<HTMLButtonElement>('.journey-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab as 'map' | 'bucket';
      activeTab = tab;
      tabContainer.querySelectorAll('.journey-tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
      updateTabVisibility();
    });
  });

  function updateTabVisibility(): void {
    if (window.innerWidth >= 900) {
      mapPanel.style.display = 'flex';
      bucketPanel.style.display = 'flex';
    } else {
      mapPanel.style.display = activeTab === 'map' ? 'flex' : 'none';
      bucketPanel.style.display = activeTab === 'bucket' ? 'flex' : 'none';
    }
    if (activeTab === 'map' && map) {
      setTimeout(() => {
        try {
          map?.resize();
        } catch {
          // ignore
        }
      }, 50);
    }
  }

  window.addEventListener('resize', updateTabVisibility);

  // Stats updater
  function updateStats(): void {
    const visitedPlaces = places.filter((p) => p.status === 'visited').length;
    const completedBucket = bucketItems.filter((b) => b.completed).length;
    const totalBucket = bucketItems.length;
    const progressPct = totalBucket > 0 ? Math.round((completedBucket / totalBucket) * 100) : 0;

    const visitedEl = hero.querySelector('#stat-visited-places');
    if (visitedEl) visitedEl.innerHTML = `${visitedPlaces} <span class="journey-stat-total">/ ${places.length}</span>`;

    const bucketEl = hero.querySelector('#stat-completed-bucket');
    if (bucketEl) bucketEl.innerHTML = `${completedBucket} <span class="journey-stat-total">/ ${totalBucket}</span>`;

    const progressEl = hero.querySelector('#stat-progress-percent');
    if (progressEl) progressEl.textContent = `${progressPct}%`;

    const barFill = bucketPanel.querySelector<HTMLElement>('.journey-progress-bar-fill');
    if (barFill) barFill.style.width = `${progressPct}%`;

    const progressLabel = bucketPanel.querySelector('.journey-progress-meta span:last-child');
    if (progressLabel) progressLabel.textContent = `${completedBucket}/${totalBucket} (${progressPct}%)`;
  }

  // ── Build Map Panel Static DOM (Constructed once, never destroyed on place update) ──
  mapPanel.innerHTML = `
    <div class="journey-panel-header">
      <h2 class="journey-panel-title">
        <span>📍</span> Toạ độ kỷ niệm
      </h2>
      <button type="button" class="journey-add-pin-btn" id="btn-add-place">
        <span>+</span> Thêm điểm đến
      </button>
    </div>

    <!-- 1. The Map Canvas Wrap: ALWAYS FULL MAP -->
    <div class="journey-map-canvas-wrap" id="journey-map-wrap">
      <div id="journey-map-container" class="journey-map-container"></div>

      <!-- Floating Map Controls Bar -->
      <div class="journey-map-floating-bar" aria-label="Bộ điều khiển bản đồ">
        <div class="journey-map-filter-group">
          <button type="button" class="journey-map-filter-btn${(activeMapFilter as string) === 'all' ? ' active' : ''}" data-map-filter="all">Tất cả</button>
          <button type="button" class="journey-map-filter-btn${(activeMapFilter as string) === 'visited' ? ' active' : ''}" data-map-filter="visited">💖 Đã đi</button>
          <button type="button" class="journey-map-filter-btn${(activeMapFilter as string) === 'wishlist' ? ' active' : ''}" data-map-filter="wishlist">✨ Ấp ủ</button>
        </div>
        <div class="journey-map-actions-group">
          <button type="button" class="journey-map-ctrl-btn" id="journey-btn-reset" title="Toàn cảnh Việt Nam & Biển Đông">🎯</button>
          <button type="button" class="journey-map-ctrl-btn" id="journey-btn-zoom-in" title="Phóng to">+</button>
          <button type="button" class="journey-map-ctrl-btn" id="journey-btn-zoom-out" title="Thu nhỏ">−</button>
        </div>
      </div>

      <!-- Selected Place Floating Card inside Map (shown only when a place is selected) -->
      <div id="journey-selected-place-slot" class="journey-selected-place-slot"></div>
    </div>

    <!-- 2. Empty State Slot: OUTSIDE .journey-map-canvas-wrap so it NEVER blocks the map -->
    <div id="journey-map-empty-slot" class="journey-map-empty-slot"></div>
  `;

  mapPanel.querySelector('#btn-add-place')?.addEventListener('click', () => {
    openAddPlaceModal();
  });

  // Map Controls Events
  mapPanel.querySelectorAll<HTMLButtonElement>('.journey-map-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeMapFilter = btn.dataset.mapFilter as 'all' | 'visited' | 'wishlist';
      mapPanel.querySelectorAll('.journey-map-filter-btn').forEach((b) => b.classList.toggle('active', b === btn));
      syncMarkers();
      setupJourneyRouteLayer();
    });
  });

  mapPanel.querySelector('#journey-btn-zoom-in')?.addEventListener('click', () => {
    try {
      map?.zoomIn({ duration: 300 });
    } catch {
      // ignore
    }
  });

  mapPanel.querySelector('#journey-btn-zoom-out')?.addEventListener('click', () => {
    try {
      map?.zoomOut({ duration: 300 });
    } catch {
      // ignore
    }
  });

  mapPanel.querySelector('#journey-btn-reset')?.addEventListener('click', () => {
    fitMapToVietnam();
  });

  function initMapInstance(): void {
    const mapContainer = mapPanel.querySelector<HTMLElement>('#journey-map-container');
    if (!mapContainer || map) return;

    const initialStyle = getMapStyle();

    try {
      map = new MapLibreMap({
        container: mapContainer,
        style: initialStyle,
        center: [106.8, 16.2],
        zoom: 5.3,
        minZoom: 3.5,
        maxZoom: 20,
        attributionControl: { compact: true },
      });

      map.on('load', () => {
        setupJourneyRouteLayer();
        fitMapToPlaces();
      });

      // Synchronously attach markers so DOM pins are available immediately
      syncSeaLabels();
      syncMarkers();
    } catch {
      // In environments where WebGL is unavailable (e.g. jsdom), safely fallback
      syncSeaLabels();
      syncMarkers();
    }
  }

  function syncSeaLabels(): void {
    seaLabelMarkers.forEach((marker) => {
      try {
        marker.remove();
      } catch {
        // ignore
      }
    });
    seaLabelMarkers = [];

    const mapContainer = mapPanel.querySelector<HTMLElement>('#journey-map-container');
    if (!mapContainer) return;

    mapContainer.querySelectorAll('.journey-sea-label').forEach((element) => element.remove());

    VIETNAM_SEA_LABELS.forEach((label) => {
      const labelElement = document.createElement('div');
      labelElement.className = `journey-sea-label journey-sea-label--${label.variant}`;
      labelElement.dataset.seaLabelId = label.id;
      labelElement.setAttribute(
        'aria-label',
        'subtitle' in label ? `${label.title}, ${label.subtitle}` : label.title,
      );
      labelElement.innerHTML = `
        <span class="journey-sea-label-text">
          <strong>${label.title}</strong>
          ${'subtitle' in label ? `<small>${label.subtitle}</small>` : ''}
        </span>
        ${label.variant === 'territory' ? '<span class="journey-sea-label-anchor" aria-hidden="true"></span>' : ''}
      `;

      if (map) {
        try {
          const marker = new Marker({
            element: labelElement,
            anchor: label.variant === 'territory' ? 'bottom' : 'center',
            offset: label.variant === 'territory' ? [0, -2] : [0, 0],
          })
            .setLngLat([label.longitude, label.latitude])
            .addTo(map);
          seaLabelMarkers.push(marker);
          return;
        } catch {
          // Fall through to a DOM-only label when MapLibre is unavailable.
        }
      }

      mapContainer.appendChild(labelElement);
    });
  }

  function setupJourneyRouteLayer(): void {
    if (!map) return;
    try {
      const coords = getJourneyLineCoordinates(places);
      const geojson: any = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
      };

      if (map.getSource('journey-route')) {
        (map.getSource('journey-route') as any).setData(geojson);
        return;
      }

      map.addSource('journey-route', {
        type: 'geojson',
        data: geojson,
      });

      map.addLayer({
        id: 'journey-route-glow',
        type: 'line',
        source: 'journey-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#ff3b7f',
          'line-width': 6,
          'line-opacity': 0.28,
          'line-blur': 2.5,
        },
      });

      map.addLayer({
        id: 'journey-route-line',
        type: 'line',
        source: 'journey-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#ff3b7f',
          'line-width': 2.8,
          'line-dasharray': [2, 2],
          'line-opacity': 0.9,
        },
      });
    } catch {
      // ignore
    }
  }

  function fitMapToPlaces(): void {
    if (!map) return;
    try {
      if (places.length === 0) {
        fitMapToVietnam();
        return;
      }
      const bounds = new LngLatBounds();
      places.forEach((p) => {
        bounds.extend([p.longitude, p.latitude]);
      });
      map.fitBounds(bounds, {
        padding: { top: 60, bottom: 120, left: 40, right: 40 },
        maxZoom: 10,
        duration: 800,
      });
    } catch {
      // ignore
    }
  }

  function fitMapToVietnam(): void {
    if (!map) return;
    try {
      map.fitBounds(VIETNAM_BOUNDS, {
        padding: { top: 40, bottom: 40, left: 30, right: 30 },
        maxZoom: 6.8,
        duration: 800,
      });
    } catch {
      // ignore
    }
  }

  function syncMarkers(): void {
    activeMarkers.forEach((m) => {
      try {
        m.remove();
      } catch {
        // ignore
      }
    });
    activeMarkers = [];

    const mapContainer = mapPanel.querySelector<HTMLElement>('#journey-map-container');
    if (!mapContainer) return;

    // Clean up any fallback pins directly inside mapContainer
    mapContainer.querySelectorAll('.journey-map-pin').forEach((el) => el.remove());

    const visiblePlaces = places.filter((p) => {
      if (activeMapFilter === 'visited') return p.status === 'visited';
      if (activeMapFilter === 'wishlist') return p.status === 'wishlist';
      return true;
    });

    visiblePlaces.forEach((place) => {
      const isSelected = place.id === selectedPlaceId;
      const isVisited = place.status === 'visited';

      const pinBtn = document.createElement('button');
      pinBtn.type = 'button';
      pinBtn.className = `journey-map-pin journey-pin-${place.status}${isSelected ? ' is-selected' : ''}`;
      pinBtn.setAttribute('aria-label', `${place.name} - ${isVisited ? 'Đã đi' : 'Ấp ủ'}`);

      if (isVisited && place.photoUrl) {
        pinBtn.innerHTML = `
          <div class="journey-pin-avatar">
            <img src="${escapeHtml(place.photoUrl)}" alt="${escapeHtml(place.name)}" />
            <span class="journey-pin-mini-badge">💖</span>
            ${isSelected ? '<div class="journey-pin-pulse"></div>' : ''}
          </div>
          <span class="journey-pin-label">${escapeHtml(place.name)}</span>
        `;
      } else if (isVisited) {
        pinBtn.innerHTML = `
          <div class="journey-pin-dot visited">
            <svg class="journey-pin-heart-svg" viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            ${isSelected ? '<div class="journey-pin-pulse"></div>' : ''}
          </div>
          <span class="journey-pin-label">${escapeHtml(place.name)}</span>
        `;
      } else {
        pinBtn.innerHTML = `
          <div class="journey-pin-dot wishlist">
            <svg class="journey-pin-star-svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            ${isSelected ? '<div class="journey-pin-pulse"></div>' : ''}
          </div>
          <span class="journey-pin-label">${escapeHtml(place.name)}</span>
        `;
      }

      pinBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedPlaceId = place.id;
        syncMarkers();
        renderSelectedPlaceCard();
        if (map) {
          try {
            map.easeTo({
              center: [place.longitude, place.latitude],
              zoom: Math.max(map.getZoom(), 8.5),
              duration: 600,
            });
          } catch {
            // ignore
          }
        }
      });

      if (map) {
        try {
          const marker = new Marker({ element: pinBtn, anchor: 'center' })
            .setLngLat([place.longitude, place.latitude])
            .addTo(map);
          activeMarkers.push(marker);
        } catch {
          mapContainer.appendChild(pinBtn);
        }
      } else {
        mapContainer.appendChild(pinBtn);
      }
    });
  }

  // ── Render Empty State OUTSIDE the Map (Bug 2 Fix) ───────────
  function renderMapEmptyState(): void {
    const emptySlot = mapPanel.querySelector<HTMLElement>('#journey-map-empty-slot');
    if (!emptySlot) return;

    if (places.length === 0) {
      emptySlot.innerHTML = `
        <div class="journey-map-empty-state">
          <span class="journey-empty-icon" aria-hidden="true">🗺️</span>
          <h3 class="journey-empty-title">Chưa có điểm đến nào</h3>
          <p class="journey-empty-text">Lưu nơi đầu tiên hai bạn đã cùng nhau ghé qua.</p>
          <button type="button" class="btn-primary" id="btn-empty-add-place" style="margin-top:6px;padding:8px 16px;font-size:13px;">
            + Thêm điểm đến
          </button>
        </div>
      `;
      emptySlot.querySelector('#btn-empty-add-place')?.addEventListener('click', () => {
        openAddPlaceModal();
      });
    } else {
      emptySlot.innerHTML = '';
    }
  }

  // ── Render Selected Place Floating Card INSIDE Map ───────────
  function renderSelectedPlaceCard(): void {
    const selectedSlot = mapPanel.querySelector<HTMLElement>('#journey-selected-place-slot');
    if (!selectedSlot) return;

    if (places.length === 0 || !selectedPlaceId) {
      selectedSlot.innerHTML = '';
      return;
    }

    const selectedPlace = places.find((p) => p.id === selectedPlaceId);
    if (!selectedPlace) {
      selectedSlot.innerHTML = '';
      return;
    }

    const isVisited = selectedPlace.status === 'visited';

    const card = document.createElement('div');
    card.className = 'journey-place-detail-card';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'journey-place-detail-header';

    const leftHeader = document.createElement('div');
    const titleEl = document.createElement('h3');
    titleEl.className = 'journey-place-detail-title';
    titleEl.textContent = `📍 ${selectedPlace.name}`;
    const regionEl = document.createElement('small');
    regionEl.style.cssText = 'color:var(--text-secondary);font-size:11px;';
    regionEl.textContent = `Khu vực: ${formatRegion(selectedPlace.region)}`;
    leftHeader.appendChild(titleEl);
    leftHeader.appendChild(regionEl);

    const rightHeader = document.createElement('div');
    rightHeader.style.cssText = 'display:flex;align-items:center;gap:6px;';

    const statusBadge = document.createElement('span');
    statusBadge.className = `journey-place-detail-status ${selectedPlace.status}`;
    statusBadge.textContent = isVisited ? '💖 Đã cùng nhau ghé' : '✨ Điểm đến ấp ủ';
    rightHeader.appendChild(statusBadge);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'journey-place-card-close';
    closeBtn.setAttribute('aria-label', 'Đóng thẻ');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      selectedPlaceId = '';
      syncMarkers();
      renderSelectedPlaceCard();
    });
    rightHeader.appendChild(closeBtn);

    headerDiv.appendChild(leftHeader);
    headerDiv.appendChild(rightHeader);
    card.appendChild(headerDiv);

    if (selectedPlace.photoUrl) {
      const cover = document.createElement('img');
      cover.className = 'journey-place-cover-img';
      cover.src = selectedPlace.photoUrl;
      cover.alt = selectedPlace.name;
      cover.loading = 'lazy';
      card.appendChild(cover);
    }

    const noteP = document.createElement('p');
    noteP.className = 'journey-place-detail-note';
    noteP.textContent = selectedPlace.note || 'Chưa có ghi chú cho toạ độ này.';
    card.appendChild(noteP);

    if (selectedPlace.visitedDate) {
      const dateRow = document.createElement('div');
      dateRow.style.cssText = 'font-size:11px;color:var(--text-secondary);display:flex;align-items:center;gap:4px;';
      const labelSpan = document.createElement('span');
      labelSpan.textContent = '📅 Ngày ghé thăm:';
      const valStrong = document.createElement('strong');
      valStrong.textContent = selectedPlace.visitedDate;
      dateRow.appendChild(labelSpan);
      dateRow.appendChild(valStrong);
      card.appendChild(dateRow);
    }

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'journey-place-detail-actions';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'btn-primary';
    toggleBtn.id = 'btn-toggle-place-status';
    toggleBtn.style.cssText = 'flex:1;padding:9px;font-size:12px;';
    toggleBtn.textContent = isVisited ? 'Đánh dấu thành ấp ủ 🚩' : 'Đánh dấu đã ghé thăm 💖';
    toggleBtn.addEventListener('click', (e) => {
      const nextStatus = isVisited ? 'wishlist' : 'visited';
      selectedPlace.status = nextStatus;
      if (nextStatus === 'wishlist') selectedPlace.visitedDate = undefined;
      if (nextStatus === 'visited' && !selectedPlace.visitedDate) {
        const now = new Date();
        selectedPlace.visitedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      }
      saveStoredPlaces(places);
      void saveCoupleJourney({
        places,
        actionType: nextStatus === 'visited' ? 'visit_place' : 'edit_place',
        itemTitle: selectedPlace.name,
      }).catch(() => {});
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      triggerHeartSparkles(rect.left + rect.width / 2, rect.top);
      showToast(
        nextStatus === 'visited'
          ? `Tuyệt vời! Đã ghi dấu toạ độ ${selectedPlace.name} 💖`
          : `Đã chuyển ${selectedPlace.name} về danh sách ấp ủ`,
        'success',
      );
      syncMarkers();
      setupJourneyRouteLayer();
      renderSelectedPlaceCard();
      updateStats();
    });

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-ghost';
    editBtn.id = 'btn-edit-place-note';
    editBtn.style.cssText = 'padding:9px 12px;font-size:12px;';
    editBtn.textContent = '✏️ Sửa';
    editBtn.addEventListener('click', () => {
      openEditPlaceModal(selectedPlace);
    });

    actionsDiv.appendChild(toggleBtn);
    actionsDiv.appendChild(editBtn);
    card.appendChild(actionsDiv);

    selectedSlot.innerHTML = '';
    selectedSlot.appendChild(card);
  }

  // ── Render Bucket List Panel ─────────────────────────────────
  function renderBucketPanel(): void {
    const categories: Array<{ id: 'all' | 'incomplete' | 'completed' | BucketCategory; label: string }> = [
      { id: 'all', label: 'Tất cả' },
      { id: 'incomplete', label: 'Chưa làm ⏳' },
      { id: 'completed', label: 'Đã hoàn thành 🎉' },
      { id: 'dating', label: '🍷 Hẹn hò' },
      { id: 'travel', label: '✈️ Du lịch' },
      { id: 'cozy', label: '🏡 Đời thường' },
      { id: 'adventure', label: '🎨 Trải nghiệm' },
      { id: 'future', label: '💍 Tương lai' },
    ];

    const completedCount = bucketItems.filter((b) => b.completed).length;
    const progressPct = bucketItems.length > 0 ? Math.round((completedCount / bucketItems.length) * 100) : 0;

    bucketPanel.innerHTML = `
      <div class="journey-panel-header">
        <h2 class="journey-panel-title">
          <span>📋</span> Điều ước cùng nhau
        </h2>
        <button type="button" class="journey-add-pin-btn" id="btn-add-bucket">
          <span>+</span> Thêm điều ước
        </button>
      </div>

      <div class="journey-progress-wrap">
        <div class="journey-progress-meta">
          <span>Tiến độ hành trình tình yêu</span>
          <span>${completedCount}/${bucketItems.length} (${progressPct}%)</span>
        </div>
        <div class="journey-progress-bar-track">
          <div class="journey-progress-bar-fill" style="width:${progressPct}%"></div>
        </div>
      </div>

      <div class="journey-filter-bar">
        ${categories
          .map(
            (c) => `
          <button type="button" class="journey-filter-pill${activeFilter === c.id ? ' active' : ''}" data-filter="${c.id}">
            ${c.label}
          </button>
        `,
          )
          .join('')}
      </div>

      <div class="journey-bucket-list" id="journey-bucket-list-slot"></div>
    `;

    bucketPanel.querySelectorAll<HTMLButtonElement>('.journey-filter-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter as 'all' | 'incomplete' | 'completed' | BucketCategory;
        bucketPanel.querySelectorAll('.journey-filter-pill').forEach((b) => b.classList.toggle('active', b === btn));
        renderBucketItems();
      });
    });

    bucketPanel.querySelector('#btn-add-bucket')?.addEventListener('click', () => {
      openAddBucketModal();
    });

    renderBucketItems();
  }

  function renderBucketItems(): void {
    const listSlot = bucketPanel.querySelector<HTMLElement>('#journey-bucket-list-slot');
    if (!listSlot) return;

    if (bucketItems.length === 0) {
      listSlot.innerHTML = `
        <div class="journey-empty-state">
          <span class="journey-empty-icon" aria-hidden="true">✨</span>
          <h3 class="journey-empty-title">Chưa có điều ước nào</h3>
          <p class="journey-empty-text">Tạo điều đầu tiên hai bạn muốn cùng nhau thực hiện.</p>
          <button type="button" class="btn-primary" id="btn-empty-add-bucket" style="margin-top:6px;padding:8px 16px;font-size:13px;">
            + Thêm điều ước
          </button>
        </div>
      `;
      listSlot.querySelector('#btn-empty-add-bucket')?.addEventListener('click', () => {
        openAddBucketModal();
      });
      return;
    }

    let filtered = bucketItems;
    if (activeFilter === 'incomplete') filtered = bucketItems.filter((i) => !i.completed);
    else if (activeFilter === 'completed') filtered = bucketItems.filter((i) => i.completed);
    else if (activeFilter !== 'all') filtered = bucketItems.filter((i) => i.category === activeFilter);

    if (filtered.length === 0) {
      listSlot.innerHTML = `
        <div class="journey-empty-state">
          <span class="journey-empty-icon" aria-hidden="true">🍃</span>
          <p class="journey-empty-text">Chưa có điều ước nào trong mục này.</p>
        </div>
      `;
      return;
    }

    listSlot.innerHTML = '';
    filtered.forEach((item) => {
      const card = document.createElement('div');
      card.className = `journey-bucket-card${item.completed ? ' completed' : ''}`;

      const catMeta = CATEGORY_MAP[item.category] || { label: 'Khác', icon: '✨' };

      const topRow = document.createElement('div');
      topRow.className = 'journey-bucket-card-top';

      const checkBtn = document.createElement('button');
      checkBtn.type = 'button';
      checkBtn.className = 'journey-checkbox-btn';
      checkBtn.setAttribute('aria-label', item.completed ? 'Bỏ hoàn thành' : 'Đánh dấu hoàn thành');
      checkBtn.textContent = item.completed ? '✓' : '';

      const infoDiv = document.createElement('div');
      infoDiv.className = 'journey-bucket-info';

      const catSpan = document.createElement('span');
      catSpan.className = 'journey-bucket-category';
      catSpan.innerHTML = `<span>${catMeta.icon}</span> ${catMeta.label}`;

      const titleH3 = document.createElement('h3');
      titleH3.className = 'journey-bucket-title';
      titleH3.textContent = item.title;

      infoDiv.appendChild(catSpan);
      infoDiv.appendChild(titleH3);

      if (item.note) {
        const noteP = document.createElement('p');
        noteP.className = 'journey-bucket-note';
        noteP.textContent = item.note;
        infoDiv.appendChild(noteP);
      }

      topRow.appendChild(checkBtn);
      topRow.appendChild(infoDiv);
      card.appendChild(topRow);

      const bottomRow = document.createElement('div');
      bottomRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px;';

      if (item.completed && item.completedDate) {
        const badge = document.createElement('span');
        badge.className = 'journey-bucket-date-badge';
        badge.textContent = `🎉 Đạt được: ${item.completedDate}`;
        bottomRow.appendChild(badge);
      } else {
        const hint = document.createElement('span');
        hint.style.cssText = 'font-size:11px;color:var(--text-secondary);';
        hint.textContent = 'Ấp ủ thực hiện cùng nhau';
        bottomRow.appendChild(hint);
      }

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-ghost';
      editBtn.style.cssText = 'padding:4px 8px;font-size:11px;';
      editBtn.textContent = '✏️';
      editBtn.setAttribute('aria-label', `Sửa điều ước ${item.title}`);
      editBtn.addEventListener('click', () => {
        openEditBucketModal(item);
      });
      bottomRow.appendChild(editBtn);

      card.appendChild(bottomRow);

      checkBtn.addEventListener('click', () => {
        const nextState = !item.completed;
        item.completed = nextState;
        if (nextState) {
          if (!item.completedDate) {
            const now = new Date();
            item.completedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          }
        } else {
          item.completedDate = undefined;
        }
        saveStoredBucket(bucketItems);
        void saveCoupleJourney({
          bucketItems,
          actionType: nextState ? 'complete_bucket' : 'uncomplete_bucket',
          itemTitle: item.title,
        }).catch(() => {});

        const rect = checkBtn.getBoundingClientRect();
        triggerHeartSparkles(rect.left + rect.width / 2, rect.top);

        showToast(
          nextState
            ? `Chúc mừng hai bạn đã hoàn thành: "${item.title}"! 🎉`
            : `Đã chuyển về danh sách chưa hoàn thành`,
          'success',
        );

        renderBucketPanel();
        updateStats();
      });

      listSlot.appendChild(card);
    });
  }

  // ── Modals ───────────────────────────────────────────────────
  function openAddPlaceModal(): void {
    const modal = document.createElement('div');
    modal.className = 'journey-modal-backdrop';
    modal.innerHTML = `
      <div class="journey-modal-card">
        <div class="journey-modal-header">
          <h3 class="journey-modal-title">Thêm toạ độ hẹn hò</h3>
          <button type="button" class="journey-modal-close-btn" aria-label="Đóng">&times;</button>
        </div>
        <form id="add-place-form" style="display:flex;flex-direction:column;gap:12px;">
          <div class="journey-form-group" style="position:relative;">
            <label class="journey-form-label" for="add-place-name">Tên địa điểm / Thành phố</label>
            <input id="add-place-name" class="journey-form-input" name="name" required placeholder="Ví dụ: Đà Lạt, Sa Pa, Phú Quốc, Hội An..." autocomplete="off" />
            <div id="add-place-autocomplete" class="journey-autocomplete-menu" style="display:none;"></div>
            <div class="journey-chip-group">
              <span style="font-size:11px;color:var(--text-secondary);align-self:center;">Gợi ý:</span>
              <button type="button" class="journey-chip-btn" data-place="Đà Lạt">Đà Lạt</button>
              <button type="button" class="journey-chip-btn" data-place="Đà Nẵng">Đà Nẵng</button>
              <button type="button" class="journey-chip-btn" data-place="Hà Nội">Hà Nội</button>
              <button type="button" class="journey-chip-btn" data-place="Phú Quốc">Phú Quốc</button>
              <button type="button" class="journey-chip-btn" data-place="Hội An">Hội An</button>
              <button type="button" class="journey-chip-btn" data-place="Sa Pa">Sa Pa</button>
            </div>
          </div>
          <div class="journey-form-group">
            <label class="journey-form-label" for="add-place-region">Khu vực</label>
            <select id="add-place-region" class="journey-form-select" name="region">
              <option value="north">Miền Bắc</option>
              <option value="central">Miền Trung</option>
              <option value="south">Miền Nam</option>
              <option value="islands">Biển Đảo</option>
            </select>
          </div>
          <div class="journey-form-group">
            <label class="journey-form-label" for="add-place-status">Trạng thái</label>
            <select id="add-place-status" class="journey-form-select" name="status">
              <option value="wishlist">✨ Điểm đến ấp ủ muốn đi</option>
              <option value="visited">💖 Đã cùng nhau ghé thăm</option>
            </select>
          </div>
          <div class="journey-form-group" id="group-visited-date" style="display:none;">
            <label class="journey-form-label" for="add-place-date">Ngày ghé thăm</label>
            <input id="add-place-date" class="journey-form-input" type="date" name="visitedDate" />
          </div>
          <div class="journey-form-group">
            <label class="journey-form-label" for="add-place-photo">Link ảnh kỷ niệm (Tùy chọn)</label>
            <input id="add-place-photo" class="journey-form-input" name="photoUrl" placeholder="https://..." />
          </div>
          <div class="journey-form-group">
            <label class="journey-form-label" for="add-place-note">Ghi chú kỷ niệm</label>
            <textarea id="add-place-note" class="journey-form-textarea" name="note" rows="2" placeholder="Kỷ niệm ngọt ngào hoặc kế hoạch của hai bạn..."></textarea>
          </div>
          <div class="journey-form-actions">
            <button type="button" class="btn-ghost" id="btn-cancel-modal">Hủy</button>
            <button type="submit" class="btn-primary">Lưu toạ độ</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.journey-modal-close-btn')?.addEventListener('click', closeModal);
    modal.querySelector('#btn-cancel-modal')?.addEventListener('click', closeModal);

    const nameInput = modal.querySelector<HTMLInputElement>('#add-place-name')!;
    const regionSelect = modal.querySelector<HTMLSelectElement>('#add-place-region')!;
    const statusSelect = modal.querySelector<HTMLSelectElement>('#add-place-status')!;
    const dateGroup = modal.querySelector<HTMLElement>('#group-visited-date')!;
    const dateInput = modal.querySelector<HTMLInputElement>('#add-place-date')!;
    const autoMenu = modal.querySelector<HTMLElement>('#add-place-autocomplete')!;

    statusSelect.addEventListener('change', () => {
      const isV = statusSelect.value === 'visited';
      dateGroup.style.display = isV ? 'flex' : 'none';
      if (isV && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
      }
    });

    const selectPreset = (cityName: string) => {
      const found = KNOWN_VIETNAM_PLACES.find((k) => k.name === cityName);
      if (found) {
        nameInput.value = found.name;
        regionSelect.value = found.region;
        nameInput.dataset.lat = String(found.latitude);
        nameInput.dataset.lng = String(found.longitude);
      } else {
        nameInput.value = cityName;
      }
      autoMenu.style.display = 'none';
    };

    modal.querySelectorAll<HTMLButtonElement>('.journey-chip-btn').forEach((chip) => {
      chip.addEventListener('click', () => {
        if (chip.dataset.place) selectPreset(chip.dataset.place);
      });
    });

    nameInput.addEventListener('input', () => {
      const val = nameInput.value.trim();
      delete nameInput.dataset.lat;
      delete nameInput.dataset.lng;

      if (!val) {
        autoMenu.style.display = 'none';
        return;
      }

      const norm = normalizeText(val);
      const matches = KNOWN_VIETNAM_PLACES.filter((k) => normalizeText(k.name).includes(norm)).slice(0, 4);

      if (matches.length === 0) {
        autoMenu.style.display = 'none';
        return;
      }

      autoMenu.innerHTML = matches
        .map(
          (m) => `
        <div class="journey-autocomplete-item" data-name="${escapeHtml(m.name)}" data-region="${m.region}" data-lat="${m.latitude}" data-lng="${m.longitude}">
          <strong>${escapeHtml(m.name)}</strong>
          <span style="font-size:11px;color:var(--text-secondary);">${formatRegion(m.region)}</span>
        </div>
      `,
        )
        .join('');

      autoMenu.style.display = 'block';

      autoMenu.querySelectorAll<HTMLElement>('.journey-autocomplete-item').forEach((item) => {
        item.addEventListener('click', () => {
          nameInput.value = item.dataset.name || '';
          if (item.dataset.region) regionSelect.value = item.dataset.region;
          if (item.dataset.lat) nameInput.dataset.lat = item.dataset.lat;
          if (item.dataset.lng) nameInput.dataset.lng = item.dataset.lng;
          autoMenu.style.display = 'none';
        });
      });
    });

    modal.querySelector<HTMLFormElement>('#add-place-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      const formData = new FormData(form);
      const name = (formData.get('name') as string).trim();
      const region = formData.get('region') as LovePlace['region'];
      const status = formData.get('status') as LovePlace['status'];
      const note = (formData.get('note') as string).trim();
      const photoUrl = (formData.get('photoUrl') as string).trim();
      const visitedDate = (formData.get('visitedDate') as string) || undefined;

      if (!name) return;

      let lat = nameInput.dataset.lat ? parseFloat(nameInput.dataset.lat) : undefined;
      let lng = nameInput.dataset.lng ? parseFloat(nameInput.dataset.lng) : undefined;

      if (lat === undefined || lng === undefined) {
        const match = KNOWN_VIETNAM_PLACES.find((k) => normalizeText(k.name) === normalizeText(name));
        if (match) {
          lat = match.latitude;
          lng = match.longitude;
        } else {
          const fallbackCoords = getRegionDefaultCoords(region);
          lat = fallbackCoords.lat + (Math.random() * 0.1 - 0.05);
          lng = fallbackCoords.lng + (Math.random() * 0.1 - 0.05);
        }
      }

      const newPlace: LovePlace = {
        id: `custom-place-${Date.now()}`,
        name,
        region,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        status,
        note: note || undefined,
        photoUrl: photoUrl || undefined,
        visitedDate: status === 'visited' ? (visitedDate || new Date().toISOString().split('T')[0]) : undefined,
      };

      places.push(newPlace);
      saveStoredPlaces(places);
      void saveCoupleJourney({
        places,
        actionType: 'add_place',
        itemTitle: newPlace.name,
      }).catch(() => {});
      selectedPlaceId = newPlace.id;
      closeModal();
      showToast(`Đã thêm toạ độ "${name}" vào bản đồ! 📍`, 'success');
      syncMarkers();
      setupJourneyRouteLayer();
      renderSelectedPlaceCard();
      renderMapEmptyState();
      updateStats();
      fitMapToPlaces();
    });
  }

  function openEditPlaceModal(place: LovePlace): void {
    const modal = document.createElement('div');
    modal.className = 'journey-modal-backdrop';
    modal.innerHTML = `
      <div class="journey-modal-card">
        <div class="journey-modal-header">
          <h3 class="journey-modal-title">Chỉnh sửa toạ độ</h3>
          <button type="button" class="journey-modal-close-btn" aria-label="Đóng">&times;</button>
        </div>
        <form id="edit-place-form" style="display:flex;flex-direction:column;gap:12px;">
          <div class="journey-form-group">
            <label class="journey-form-label" for="edit-place-name">Tên địa điểm</label>
            <input id="edit-place-name" class="journey-form-input" name="name" required />
          </div>
          <div class="journey-form-group">
            <label class="journey-form-label" for="edit-place-note">Ghi chú kỷ niệm</label>
            <textarea id="edit-place-note" class="journey-form-textarea" name="note" rows="3"></textarea>
          </div>
          <div class="journey-form-group">
            <label class="journey-form-label" for="edit-place-date">Ngày ghé thăm</label>
            <input id="edit-place-date" class="journey-form-input" type="date" name="visitedDate" />
          </div>
          <div class="journey-form-group">
            <label class="journey-form-label" for="edit-place-photo">Link ảnh kỷ niệm (Tùy chọn)</label>
            <input id="edit-place-photo" class="journey-form-input" name="photoUrl" placeholder="https://..." />
          </div>
          <div class="journey-form-actions">
            <button type="button" class="btn-ghost" id="btn-delete-place" style="margin-right:auto;color:#ef4444;">Xóa</button>
            <button type="button" class="btn-ghost" id="btn-cancel-modal">Hủy</button>
            <button type="submit" class="btn-primary">Lưu</button>
          </div>
        </form>
      </div>
    `;

    const nameInput = modal.querySelector<HTMLInputElement>('#edit-place-name');
    if (nameInput) nameInput.value = place.name;
    const noteTextarea = modal.querySelector<HTMLTextAreaElement>('#edit-place-note');
    if (noteTextarea) noteTextarea.value = place.note || '';
    const dateInput = modal.querySelector<HTMLInputElement>('#edit-place-date');
    if (dateInput) dateInput.value = place.visitedDate || '';
    const photoInput = modal.querySelector<HTMLInputElement>('#edit-place-photo');
    if (photoInput) photoInput.value = place.photoUrl || '';

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.journey-modal-close-btn')?.addEventListener('click', closeModal);
    modal.querySelector('#btn-cancel-modal')?.addEventListener('click', closeModal);

    modal.querySelector('#btn-delete-place')?.addEventListener('click', () => {
      const deletedName = place.name;
      places = places.filter((p) => p.id !== place.id);
      saveStoredPlaces(places);
      void saveCoupleJourney({
        places,
        actionType: 'delete_place',
        itemTitle: deletedName,
      }).catch(() => {});
      selectedPlaceId = places[0]?.id || '';
      closeModal();
      showToast('Đã xóa toạ độ khỏi bản đồ', 'info');
      syncMarkers();
      setupJourneyRouteLayer();
      renderSelectedPlaceCard();
      renderMapEmptyState();
      updateStats();
      fitMapToPlaces();
    });

    modal.querySelector<HTMLFormElement>('#edit-place-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      const formData = new FormData(form);
      place.name = (formData.get('name') as string).trim();
      place.note = (formData.get('note') as string).trim() || undefined;
      place.visitedDate = (formData.get('visitedDate') as string) || undefined;
      place.photoUrl = (formData.get('photoUrl') as string).trim() || undefined;

      saveStoredPlaces(places);
      void saveCoupleJourney({
        places,
        actionType: 'edit_place',
        itemTitle: place.name,
      }).catch(() => {});
      closeModal();
      showToast('Đã lưu thông tin toạ độ', 'success');
      syncMarkers();
      setupJourneyRouteLayer();
      renderSelectedPlaceCard();
      updateStats();
    });
  }

  function openAddBucketModal(): void {
    const modal = document.createElement('div');
    modal.className = 'journey-modal-backdrop';
    modal.innerHTML = `
      <div class="journey-modal-card">
        <div class="journey-modal-header">
          <h3 class="journey-modal-title">Thêm điều ước cùng nhau</h3>
          <button type="button" class="journey-modal-close-btn" aria-label="Đóng">&times;</button>
        </div>
        <form id="add-bucket-form" style="display:flex;flex-direction:column;gap:12px;">
          <div class="journey-form-group">
            <label class="journey-form-label" for="add-bucket-title">Điều ước / Mục tiêu của hai đứa</label>
            <input id="add-bucket-title" class="journey-form-input" name="title" required placeholder="Ví dụ: Cùng đi cắm trại ngắm sao băng..." />
          </div>
          <div class="journey-form-group">
            <label class="journey-form-label" for="add-bucket-category">Danh mục</label>
            <select id="add-bucket-category" class="journey-form-select" name="category">
              <option value="dating">🍷 Hẹn hò & Ẩm thực</option>
              <option value="travel">✈️ Du lịch & Khám phá</option>
              <option value="cozy">🏡 Đời thường ấm áp</option>
              <option value="adventure">🎨 Trải nghiệm mới</option>
              <option value="future">💍 Cột mốc tương lai</option>
            </select>
          </div>
          <div class="journey-form-group">
            <label class="journey-form-label" for="add-bucket-note">Ghi chú (Tùy chọn)</label>
            <textarea id="add-bucket-note" class="journey-form-textarea" name="note" rows="2" placeholder="Chi tiết hoặc thời điểm dự định..."></textarea>
          </div>
          <div class="journey-form-actions">
            <button type="button" class="btn-ghost" id="btn-cancel-modal">Hủy</button>
            <button type="submit" class="btn-primary">Lưu điều ước</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.journey-modal-close-btn')?.addEventListener('click', closeModal);
    modal.querySelector('#btn-cancel-modal')?.addEventListener('click', closeModal);

    modal.querySelector<HTMLFormElement>('#add-bucket-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      const formData = new FormData(form);
      const title = (formData.get('title') as string).trim();
      const category = formData.get('category') as BucketCategory;
      const note = (formData.get('note') as string).trim();

      if (!title) return;

      const newItem: BucketItem = {
        id: `custom-bucket-${Date.now()}`,
        title,
        category,
        completed: false,
        note: note || undefined,
        isCustom: true,
      };

      bucketItems.unshift(newItem);
      saveStoredBucket(bucketItems);
      void saveCoupleJourney({
        bucketItems,
        actionType: 'add_bucket',
        itemTitle: newItem.title,
      }).catch(() => {});
      closeModal();
      showToast('Đã thêm điều ước mới vào danh sách! ✨', 'success');
      renderBucketPanel();
      updateStats();
    });
  }

  function openEditBucketModal(item: BucketItem): void {
    const modal = document.createElement('div');
    modal.className = 'journey-modal-backdrop';
    modal.innerHTML = `
      <div class="journey-modal-card">
        <div class="journey-modal-header">
          <h3 class="journey-modal-title">Chỉnh sửa điều ước</h3>
          <button type="button" class="journey-modal-close-btn" aria-label="Đóng">&times;</button>
        </div>
        <form id="edit-bucket-form" style="display:flex;flex-direction:column;gap:12px;">
          <div class="journey-form-group">
            <label class="journey-form-label" for="edit-bucket-title">Tiêu đề điều ước</label>
            <input id="edit-bucket-title" class="journey-form-input" name="title" required />
          </div>
          <div class="journey-form-group">
            <label class="journey-form-label" for="edit-bucket-category">Danh mục</label>
            <select id="edit-bucket-category" class="journey-form-select" name="category">
              <option value="dating"${item.category === 'dating' ? ' selected' : ''}>🍷 Hẹn hò & Ẩm thực</option>
              <option value="travel"${item.category === 'travel' ? ' selected' : ''}>✈️ Du lịch & Khám phá</option>
              <option value="cozy"${item.category === 'cozy' ? ' selected' : ''}>🏡 Đời thường ấm áp</option>
              <option value="adventure"${item.category === 'adventure' ? ' selected' : ''}>🎨 Trải nghiệm mới</option>
              <option value="future"${item.category === 'future' ? ' selected' : ''}>💍 Cột mốc tương lai</option>
            </select>
          </div>
          <div class="journey-form-group">
            <label class="journey-form-label" for="edit-bucket-note">Ghi chú</label>
            <textarea id="edit-bucket-note" class="journey-form-textarea" name="note" rows="2"></textarea>
          </div>
          <div class="journey-form-actions">
            <button type="button" class="btn-ghost" id="btn-delete-bucket" style="margin-right:auto;color:#ef4444;">Xóa</button>
            <button type="button" class="btn-ghost" id="btn-cancel-modal">Hủy</button>
            <button type="submit" class="btn-primary">Lưu</button>
          </div>
        </form>
      </div>
    `;

    const titleInput = modal.querySelector<HTMLInputElement>('#edit-bucket-title');
    if (titleInput) titleInput.value = item.title;
    const noteTextarea = modal.querySelector<HTMLTextAreaElement>('#edit-bucket-note');
    if (noteTextarea) noteTextarea.value = item.note || '';

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.journey-modal-close-btn')?.addEventListener('click', closeModal);
    modal.querySelector('#btn-cancel-modal')?.addEventListener('click', closeModal);

    modal.querySelector('#btn-delete-bucket')?.addEventListener('click', () => {
      const deletedTitle = item.title;
      bucketItems = bucketItems.filter((i) => i.id !== item.id);
      saveStoredBucket(bucketItems);
      void saveCoupleJourney({
        bucketItems,
        actionType: 'delete_bucket',
        itemTitle: deletedTitle,
      }).catch(() => {});
      closeModal();
      showToast('Đã xóa điều ước', 'info');
      renderBucketPanel();
      updateStats();
    });

    modal.querySelector<HTMLFormElement>('#edit-bucket-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      const formData = new FormData(form);
      item.title = (formData.get('title') as string).trim();
      item.category = formData.get('category') as BucketCategory;
      item.note = (formData.get('note') as string).trim() || undefined;

      saveStoredBucket(bucketItems);
      void saveCoupleJourney({
        bucketItems,
        actionType: 'edit_bucket',
        itemTitle: item.title,
      }).catch(() => {});
      closeModal();
      showToast('Đã lưu thay đổi điều ước', 'success');
      renderBucketPanel();
      updateStats();
    });
  }

  function formatRegion(region?: LovePlace['region']): string {
    switch (region) {
      case 'north':
        return 'Miền Bắc';
      case 'central':
        return 'Miền Trung';
      case 'south':
        return 'Miền Nam';
      case 'islands':
        return 'Biển Đảo';
      default:
        return 'Việt Nam';
    }
  }

  function getRegionDefaultCoords(region?: LovePlace['region']): { lat: number; lng: number } {
    switch (region) {
      case 'north':
        return { lat: 21.0285, lng: 105.8542 };
      case 'central':
        return { lat: 16.0544, lng: 108.2022 };
      case 'south':
        return { lat: 10.8231, lng: 106.6297 };
      case 'islands':
        return { lat: 10.2899, lng: 103.9840 };
      default:
        return { lat: 16.0544, lng: 108.2022 };
    }
  }

  function handleThemeChange(): void {
    if (!map) return;
    const targetStyle = getMapStyle();
    try {
      map.setStyle(targetStyle);
      map.once('style.load', () => {
        setupJourneyRouteLayer();
        syncMarkers();
      });
    } catch {
      // ignore
    }
  }

  // Theme synchronization for dynamic dark / light vector tiles
  const unsubscribeStore = store.subscribe(() => {
    handleThemeChange();
  });

  const themeObserver = new MutationObserver(() => {
    handleThemeChange();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Real-time synchronization with cloud DB and partner
  const handleRealtimeEvent = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.type === 'journey.updated' && detail.journey) {
      if (Array.isArray(detail.journey.places)) {
        places = detail.journey.places;
        saveStoredPlaces(places);
      }
      if (Array.isArray(detail.journey.bucketItems)) {
        bucketItems = detail.journey.bucketItems;
        saveStoredBucket(bucketItems);
      }
      if (!selectedPlaceId && places[0]) {
        selectedPlaceId = places[0].id;
      }
      syncMarkers();
      setupJourneyRouteLayer();
      renderSelectedPlaceCard();
      renderMapEmptyState();
      renderBucketPanel();
      updateStats();
    }
  };
  window.addEventListener('lovecheck:realtime-event', handleRealtimeEvent);

  // Lifecycle destroy
  root.destroy = () => {
    window.removeEventListener('lovecheck:realtime-event', handleRealtimeEvent);
    window.removeEventListener('resize', updateTabVisibility);
    themeObserver.disconnect();
    unsubscribeStore();
    activeMarkers.forEach((m) => {
      try {
        m.remove();
      } catch {
        // ignore
      }
    });
    activeMarkers = [];
    seaLabelMarkers.forEach((marker) => {
      try {
        marker.remove();
      } catch {
        // ignore
      }
    });
    seaLabelMarkers = [];
    if (map) {
      try {
        map.remove();
      } catch {
        // ignore
      }
      map = null;
    }
  };

  // Initial renders
  initMapInstance();
  renderSelectedPlaceCard();
  renderMapEmptyState();
  renderBucketPanel();
  updateStats();
  updateTabVisibility();

  // Background sync with cloud to ensure all local items (e.g. from APK) are merged with cloud DB
  void syncCoupleJourneyWithServer(places, bucketItems)
    .then((data) => {
      if (!data) return;
      const serverPlaces = Array.isArray(data.places) ? data.places : [];
      const serverBucket = Array.isArray(data.bucketItems) ? data.bucketItems : [];

      let hasChanges = false;
      if (serverPlaces.length > 0 || places.length === 0) {
        if (JSON.stringify(places) !== JSON.stringify(serverPlaces)) {
          places = serverPlaces;
          saveStoredPlaces(places);
          hasChanges = true;
        }
      }
      if (serverBucket.length > 0 || bucketItems.length === 0) {
        if (JSON.stringify(bucketItems) !== JSON.stringify(serverBucket)) {
          bucketItems = serverBucket;
          saveStoredBucket(bucketItems);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        if (!selectedPlaceId && places[0]) {
          selectedPlaceId = places[0].id;
        }
        syncMarkers();
        setupJourneyRouteLayer();
        renderSelectedPlaceCard();
        renderMapEmptyState();
        renderBucketPanel();
        updateStats();
      }
    })
    .catch(() => {
      // Keep offline/local state if network unavailable
    });

  return root;
}
