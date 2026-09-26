import { navigate } from '../router';
import { showToast } from '../components/toast';

export interface LovePlace {
  id: string;
  name: string;
  region: 'north' | 'central' | 'south' | 'islands';
  x: number; // 0 - 100%
  y: number; // 0 - 100%
  status: 'visited' | 'wishlist';
  visitedDate?: string;
  note?: string;
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

export const PLACES_STORAGE_KEY = 'lovecheck_journey_places';
export const BUCKET_STORAGE_KEY = 'lovecheck_journey_bucket';
export const MIGRATION_SEED_CLEANUP_KEY = 'lovecheck_journey_seed_cleanup_v1';

/**
 * Legacy demo seed items from previous versions.
 * Kept strictly as reference data for safe one-time migration cleanup.
 * Never used as defaults for new users.
 */
const LEGACY_SEED_PLACES: LovePlace[] = [
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

const LEGACY_SEED_BUCKET: BucketItem[] = [
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

function isExactUnmodifiedSeedPlaces(items: unknown[]): boolean {
  if (!Array.isArray(items) || items.length === 0) return true;
  const seedMap = new Map(LEGACY_SEED_PLACES.map((p) => [p.id, p]));
  for (const item of items) {
    if (!item || typeof item !== 'object') return false;
    const p = item as Partial<LovePlace>;
    if (!p.id || !seedMap.has(p.id)) return false; // Contains custom/foreign ID -> preserve!
    const original = seedMap.get(p.id)!;
    if (p.name !== original.name) return false;
    if (p.region !== original.region) return false;
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
    if (!b.id || !seedMap.has(b.id)) return false; // Contains custom/foreign ID -> preserve!
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
        // If unparseable, do not blindly delete
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
        // If unparseable, do not blindly delete
      }
    }

    localStorage.setItem(MIGRATION_SEED_CLEANUP_KEY, 'true');
  } catch {
    // Storage quota or sandboxing errors
  }
}

export function isValidLovePlace(item: unknown): item is LovePlace {
  if (!item || typeof item !== 'object') return false;
  const p = item as Record<string, unknown>;
  if (typeof p.id !== 'string' || !p.id.trim()) return false;
  if (typeof p.name !== 'string' || !p.name.trim()) return false;
  if (p.region !== 'north' && p.region !== 'central' && p.region !== 'south' && p.region !== 'islands') return false;
  if (typeof p.x !== 'number' || Number.isNaN(p.x) || typeof p.y !== 'number' || Number.isNaN(p.y)) return false;
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
    return parsed.filter(isValidLovePlace);
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

export function renderLoveJourneyPage(): HTMLElement {
  const root = document.createElement('div') as HTMLElement & {
    destroy?: () => void;
  };
  root.className = 'page journey-page animate-fade-in';

  let places = loadStoredPlaces();
  let bucketItems = loadStoredBucket();
  let selectedPlaceId: string = places[0]?.id || '';
  let activeTab: 'map' | 'bucket' = 'map';
  let activeFilter: 'all' | 'incomplete' | 'completed' | BucketCategory = 'all';

  // 1. Header
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
      Từng vùng đất hai đứa đã đi qua và những ước mơ ngọt ngào đang chờ cùng nhau chạm tới.
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
    <button type="button" class="journey-tab-btn active" data-tab="map">
      <span>🗺️</span> Bản đồ toạ độ
    </button>
    <button type="button" class="journey-tab-btn" data-tab="bucket">
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

  // Handle Tab Switch on Mobile
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
  }

  window.addEventListener('resize', updateTabVisibility);
  root.destroy = () => {
    window.removeEventListener('resize', updateTabVisibility);
  };

  // Update Stats Counter
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

  // ── Render Map Panel ─────────────────────────────────────────
  function renderMapPanel(): void {
    mapPanel.innerHTML = `
      <div class="journey-panel-header">
        <h2 class="journey-panel-title">
          <span>📍</span> Toạ độ kỷ niệm
        </h2>
        <button type="button" class="journey-add-pin-btn" id="btn-add-place">
          <span>+</span> Thêm điểm đến
        </button>
      </div>

      <div class="journey-map-canvas-wrap" id="journey-map-canvas">
        <svg class="journey-map-svg" viewBox="0 0 100 135" preserveAspectRatio="none" aria-label="Bản đồ Việt Nam">
          <!-- Stylized Map Contours -->
          <path d="M 28 8 Q 48 6, 68 18 Q 62 28, 48 30 Q 52 42, 60 50 Q 72 65, 76 75 Q 70 85, 48 88 Q 38 90, 32 94 Q 28 92, 34 85 Q 46 80, 52 75 Q 56 60, 50 45 Q 42 35, 30 25 Z"
            fill="rgba(255, 59, 127, 0.07)"
            stroke="rgba(255, 59, 127, 0.28)"
            stroke-width="1.2"
            stroke-dasharray="2,2"
          />
          <!-- Coastline waves -->
          <path d="M 72 25 Q 76 35, 82 45 Q 86 60, 84 75" fill="none" stroke="rgba(78, 168, 222, 0.28)" stroke-width="0.8" />
          <path d="M 76 30 Q 80 40, 86 50 Q 90 65, 88 80" fill="none" stroke="rgba(78, 168, 222, 0.16)" stroke-width="0.6" />
          <!-- Islands -->
          <circle cx="82" cy="58" r="2.2" fill="rgba(255, 59, 127, 0.25)" />
          <circle cx="85" cy="62" r="1.6" fill="rgba(255, 59, 127, 0.25)" />
          <circle cx="86" cy="88" r="2.4" fill="rgba(255, 59, 127, 0.25)" />
          <text x="86" y="55" font-size="3" fill="var(--text-secondary)" opacity="0.6">Hoàng Sa</text>
          <text x="88" y="85" font-size="3" fill="var(--text-secondary)" opacity="0.6">Trường Sa</text>
        </svg>

        <!-- Dynamic Pins -->
        <div id="journey-pins-container"></div>
      </div>

      <!-- Selected Place Detail Card or Empty State -->
      <div id="journey-selected-place-slot"></div>
    `;

    const pinsContainer = mapPanel.querySelector<HTMLElement>('#journey-pins-container');
    const selectedSlot = mapPanel.querySelector<HTMLElement>('#journey-selected-place-slot');

    if (pinsContainer) {
      pinsContainer.innerHTML = '';
      places.forEach((place) => {
        const pinBtn = document.createElement('button');
        pinBtn.type = 'button';
        pinBtn.className = `journey-map-pin journey-pin-${place.status}`;
        pinBtn.style.left = `${place.x}%`;
        pinBtn.style.top = `${place.y}%`;
        pinBtn.setAttribute('aria-label', `${place.name} - ${place.status === 'visited' ? 'Đã đi' : 'Ấp ủ'}`);

        const isVisited = place.status === 'visited';
        pinBtn.innerHTML = `
          <div class="journey-pin-dot">
            ${isVisited ? '❤️' : '🚩'}
            ${place.id === selectedPlaceId ? '<div class="journey-pin-pulse"></div>' : ''}
          </div>
          <span class="journey-pin-label"></span>
        `;
        const labelEl = pinBtn.querySelector('.journey-pin-label');
        if (labelEl) labelEl.textContent = place.name;

        pinBtn.addEventListener('click', () => {
          selectedPlaceId = place.id;
          renderMapPanel();
        });

        pinsContainer.appendChild(pinBtn);
      });
    }

    // Render detail card for selected place or empty state if places is empty
    const selectedPlace = places.find((p) => p.id === selectedPlaceId) || places[0];

    if (selectedSlot) {
      if (!selectedPlace || places.length === 0) {
        selectedSlot.innerHTML = `
          <div class="journey-map-empty-state">
            <span class="journey-empty-icon" aria-hidden="true">🗺️</span>
            <h3 class="journey-empty-title">Chưa có điểm đến nào</h3>
            <p class="journey-empty-text">Thêm nơi hai bạn đã đi hoặc đang muốn cùng nhau khám phá.</p>
            <button type="button" class="btn-primary" id="btn-empty-add-place" style="margin-top:6px;padding:8px 16px;font-size:13px;">
              + Thêm điểm đến
            </button>
          </div>
        `;
        selectedSlot.querySelector('#btn-empty-add-place')?.addEventListener('click', () => {
          openAddPlaceModal();
        });
      } else {
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

        const statusBadge = document.createElement('span');
        statusBadge.className = `journey-place-detail-status ${selectedPlace.status}`;
        statusBadge.textContent = isVisited ? '💖 Đã cùng nhau ghé' : '✨ Điểm đến ấp ủ';

        headerDiv.appendChild(leftHeader);
        headerDiv.appendChild(statusBadge);
        card.appendChild(headerDiv);

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
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          triggerHeartSparkles(rect.left + rect.width / 2, rect.top);
          showToast(
            nextStatus === 'visited'
              ? `Tuyệt vời! Đã ghi dấu toạ độ ${selectedPlace.name} 💖`
              : `Đã chuyển ${selectedPlace.name} về danh sách ấp ủ`,
            'success',
          );
          renderMapPanel();
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
    }

    mapPanel.querySelector('#btn-add-place')?.addEventListener('click', () => {
      openAddPlaceModal();
    });
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

    // Filter Buttons
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
          <div class="journey-form-group">
            <label class="journey-form-label" for="add-place-name">Tên địa điểm / Thành phố</label>
            <input id="add-place-name" class="journey-form-input" name="name" required placeholder="Ví dụ: Côn Đảo, Cát Bà, Buôn Ma Thuột..." />
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
          <div class="journey-form-group">
            <label class="journey-form-label" for="add-place-note">Ghi chú kỷ niệm</label>
            <textarea id="add-place-note" class="journey-form-textarea" name="note" rows="2" placeholder="Kỷ niệm đẹp hoặc kế hoạch hai đứa..."></textarea>
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

    modal.querySelector<HTMLFormElement>('#add-place-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      const formData = new FormData(form);
      const name = (formData.get('name') as string).trim();
      const region = formData.get('region') as LovePlace['region'];
      const status = formData.get('status') as LovePlace['status'];
      const note = (formData.get('note') as string).trim();

      if (!name) return;

      const coords = getRegionDefaultCoords(region);

      const newPlace: LovePlace = {
        id: `custom-place-${Date.now()}`,
        name,
        region,
        x: coords.x + (Math.random() * 8 - 4),
        y: coords.y + (Math.random() * 8 - 4),
        status,
        note,
        visitedDate: status === 'visited' ? new Date().toISOString().split('T')[0] : undefined,
      };

      places.push(newPlace);
      saveStoredPlaces(places);
      selectedPlaceId = newPlace.id;
      closeModal();
      showToast(`Đã thêm toạ độ "${name}" vào bản đồ! 📍`, 'success');
      renderMapPanel();
      updateStats();
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

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.journey-modal-close-btn')?.addEventListener('click', closeModal);
    modal.querySelector('#btn-cancel-modal')?.addEventListener('click', closeModal);

    modal.querySelector('#btn-delete-place')?.addEventListener('click', () => {
      places = places.filter((p) => p.id !== place.id);
      saveStoredPlaces(places);
      selectedPlaceId = places[0]?.id || '';
      closeModal();
      showToast('Đã xóa toạ độ khỏi bản đồ', 'info');
      renderMapPanel();
      updateStats();
    });

    modal.querySelector<HTMLFormElement>('#edit-place-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      const formData = new FormData(form);
      place.name = (formData.get('name') as string).trim();
      place.note = (formData.get('note') as string).trim();
      place.visitedDate = (formData.get('visitedDate') as string) || undefined;

      saveStoredPlaces(places);
      closeModal();
      showToast('Đã lưu thông tin toạ độ', 'success');
      renderMapPanel();
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
        note,
        isCustom: true,
      };

      bucketItems.unshift(newItem);
      saveStoredBucket(bucketItems);
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
      bucketItems = bucketItems.filter((i) => i.id !== item.id);
      saveStoredBucket(bucketItems);
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
      item.note = (formData.get('note') as string).trim();

      saveStoredBucket(bucketItems);
      closeModal();
      showToast('Đã lưu thay đổi điều ước', 'success');
      renderBucketPanel();
      updateStats();
    });
  }

  function formatRegion(region: LovePlace['region']): string {
    switch (region) {
      case 'north':
        return 'Miền Bắc';
      case 'central':
        return 'Miền Trung';
      case 'south':
        return 'Miền Nam';
      case 'islands':
        return 'Biển Đảo';
    }
  }

  function getRegionDefaultCoords(region: LovePlace['region']): { x: number; y: number } {
    switch (region) {
      case 'north':
        return { x: 48, y: 18 };
      case 'central':
        return { x: 67, y: 50 };
      case 'south':
        return { x: 55, y: 80 };
      case 'islands':
        return { x: 38, y: 92 };
    }
  }

  // Initial render
  renderMapPanel();
  renderBucketPanel();
  updateStats();
  updateTabVisibility();

  return root;
}
