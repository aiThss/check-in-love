import { navigate } from '../router';
import { clearPrivateClientState } from '../session';
import { store, applyTheme } from '../store/index';
import { updateProfile, uploadAvatar, uploadPartnerAvatar } from '../api/profile';
import { getMe, MeResponse } from '../api/auth';
import { showToast } from '../components/toast';
import { showModal } from '../components/modal';
import { openCamera, openGallery, CameraResult } from '../components/camera';
import { apiFetch } from '../api/client';
import { ensurePushSubscription } from '../api/push';
import type { User, Couple } from '../api/types';
import { isMockPreviewMode } from '../dev/mock-data';

function calcDaysTogether(loveStartDate?: string): number {
  if (!loveStartDate) return 0;
  const start = new Date(loveStartDate);
  const diff = Date.now() - start.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function calcUserAge(birthdayStr?: string | null): number | undefined {
  if (!birthdayStr) return undefined;
  const rawDate = birthdayStr.split('T')[0];
  const parts = rawDate.split('-');
  if (parts.length < 3) return undefined;

  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10) - 1;
  const birthDay = parseInt(parts[2], 10);
  if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return undefined;

  const now = new Date();
  let age = now.getFullYear() - birthYear;
  const m = now.getMonth() - birthMonth;
  if (m < 0 || (m === 0 && now.getDate() < birthDay)) {
    age--;
  }

  return age >= 0 && age <= 130 ? age : undefined;
}

const GITHUB_RELEASE_API = 'https://api.github.com/repos/aiThss/check-in-love/releases/latest';
const GITHUB_RELEASES_PAGE = 'https://github.com/aiThss/check-in-love/releases/latest';

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name?: string;
  name?: string;
  html_url?: string;
  assets?: GitHubReleaseAsset[];
}

function normalizeVersion(version?: string): string {
  return (version || '').trim().replace(/^v/i, '');
}

function getCurrentAndroidVersion(): string | null {
  const match = navigator.userAgent.match(/LoveCheckAndroidWrapper(?:\/([^\s;]+))?/i);
  return match?.[1] ? normalizeVersion(match[1]) : null;
}

function compareVersions(left: string, right: string): number {
  const toParts = (version: string) =>
    normalizeVersion(version)
      .split(/[._-]/)
      .map((part) => Number.parseInt(part, 10) || 0);

  const leftParts = toParts(left);
  const rightParts = toParts(right);
  const max = Math.max(leftParts.length, rightParts.length);

  for (let i = 0; i < max; i++) {
    const diff = (leftParts[i] || 0) - (rightParts[i] || 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

function getApkAsset(release: GitHubRelease): GitHubReleaseAsset | undefined {
  return release.assets?.find((asset) => asset.name.toLowerCase().endsWith('.apk'));
}

async function checkApkUpdate(
  statusEl: HTMLElement,
  checkButton: HTMLButtonElement,
  downloadButton: HTMLButtonElement
) {
  const previousLabel = checkButton.textContent || 'Kiểm tra';
  checkButton.disabled = true;
  checkButton.textContent = 'Đang kiểm tra...';
  downloadButton.style.display = 'none';
  statusEl.textContent = 'Đang quét phiên bản APK mới nhất...';
  showToast('Đang quét tìm phiên bản mới...', 'info');

  const startTime = Date.now();

  try {
    const res = await fetch(GITHUB_RELEASE_API, {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' }
    });

    if (!res.ok) throw new Error(`GitHub trả về ${res.status}`);

    const release = (await res.json()) as GitHubRelease;
    const latestVersion = normalizeVersion(release.tag_name || release.name);
    const apkAsset = getApkAsset(release);
    const updateUrl = apkAsset?.browser_download_url || release.html_url || GITHUB_RELEASES_PAGE;
    const currentVersion = getCurrentAndroidVersion();

    // Giữ trạng thái đang tải tối thiểu 800ms để tránh việc nháy nút quá nhanh
    const elapsed = Date.now() - startTime;
    if (elapsed < 800) {
      await new Promise((resolve) => setTimeout(resolve, 800 - elapsed));
    }

    downloadButton.dataset.updateUrl = updateUrl;
    downloadButton.textContent = apkAsset ? 'Tải APK mới' : 'Mở trang release';
    downloadButton.style.display = 'inline-flex';

    if (!latestVersion) {
      statusEl.textContent = 'Đã tìm thấy release, nhưng chưa đọc được số phiên bản.';
      showToast('Đã tìm thấy release mới nhưng chưa rõ phiên bản', 'info');
      return;
    }

    if (!currentVersion) {
      statusEl.textContent = `Không đọc được version APK hiện tại. Bạn có thể tải bản mới nhất v${latestVersion}.`;
      showToast(`Đã quét xong: Có phiên bản v${latestVersion} trên GitHub`, 'info');
      return;
    }

    if (compareVersions(currentVersion, latestVersion) >= 0) {
      statusEl.textContent = `Bạn đang ở bản mới nhất (v${currentVersion}).`;
      downloadButton.style.display = 'none';
      showToast(`Ứng dụng đang ở phiên bản mới nhất v${currentVersion}!`, 'success');
      return;
    }

    statusEl.textContent = `Có bản mới v${latestVersion}. Bản đang cài là v${currentVersion}.`;
    showToast(`Có phiên bản mới v${latestVersion}!`, 'success');
  } catch (err) {
    const error = err as Error;
    const elapsed = Date.now() - startTime;
    if (elapsed < 800) {
      await new Promise((resolve) => setTimeout(resolve, 800 - elapsed));
    }
    statusEl.textContent = `Không kiểm tra được cập nhật: ${error.message || 'lỗi mạng'}.`;
    downloadButton.dataset.updateUrl = GITHUB_RELEASES_PAGE;
    downloadButton.textContent = 'Mở trang release';
    downloadButton.style.display = 'inline-flex';
    showToast('Không kiểm tra được cập nhật APK', 'error');
  } finally {
    checkButton.disabled = false;
    checkButton.textContent = previousLabel;
  }
}

/* ============================================================
   Check-in Reminder — persisted server-side and delivered by push.
   ============================================================ */

const REMINDER_KEY = 'lovecheck_reminder';
const REMINDER_MIGRATION_KEY = 'lovecheck_reminder_migrated_v2';

interface ReminderSettings {
  enabled: boolean;
  time: string;
  timezone: 'Asia/Ho_Chi_Minh';
}

function getReminderSettings(): ReminderSettings {
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    if (raw) return JSON.parse(raw) as ReminderSettings;
  } catch { /* ignore */ }
  return { enabled: false, time: '20:30', timezone: 'Asia/Ho_Chi_Minh' };
}

function saveReminderSettings(settings: ReminderSettings): void {
  try {
    localStorage.setItem(REMINDER_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

async function loadReminderSettings(): Promise<ReminderSettings> {
  if (isMockPreviewMode()) return getReminderSettings();
  const response = await apiFetch<{ reminder: ReminderSettings }>('/me/reminder');
  return response.reminder;
}

async function saveRemoteReminderSettings(settings: ReminderSettings): Promise<ReminderSettings> {
  if (isMockPreviewMode()) {
    saveReminderSettings(settings);
    return settings;
  }
  const response = await apiFetch<{ reminder: ReminderSettings }>('/me/reminder', {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });
  return response.reminder;
}

// Kept as a no-op for callers from older bundles. Scheduling now belongs to the API.
export function restoreReminderOnLoad(): void {}

function getPermissionStatus(): { label: string; cls: string } {
  if (!('Notification' in window)) {
    return { label: 'Nhắc server đã sẵn sàng', cls: 'granted' };
  }
  switch (Notification.permission) {
    case 'granted': return { label: 'Đã cấp quyền thông báo', cls: 'granted' };
    case 'denied':  return { label: 'Bị chặn — cần mở lại trong cài đặt trình duyệt', cls: 'denied' };
    default:        return { label: 'Chưa cấp quyền', cls: 'default' };
  }
}

function buildReminderCard(): HTMLElement {
  const card = document.createElement('div');
  card.className = 'card-solid reminder-card';

  const settings = getReminderSettings();
  let permStatus = getPermissionStatus();

  const render = () => {
    const currentSettings = getReminderSettings();
    permStatus = getPermissionStatus();

    card.innerHTML = '';

    // Header: icon + copy + toggle
    const header = document.createElement('div');
    header.className = 'reminder-card-header';
    header.innerHTML = `
      <div class="reminder-card-icon" aria-hidden="true">🔔</div>
      <div class="reminder-card-copy">
        <span class="reminder-card-title">Nhắc check-in</span>
        <span class="reminder-card-subtitle">Nhắc đúng giờ, kể cả khi app đã đóng</span>
      </div>
      <div class="reminder-toggle-wrap">
        <label class="reminder-toggle" aria-label="${currentSettings.enabled ? 'Tắt nhắc check-in' : 'Bật nhắc check-in'}">
          <input
            type="checkbox"
            id="reminder-toggle-input"
            ${currentSettings.enabled ? 'checked' : ''}
            aria-checked="${currentSettings.enabled}"
          />
          <span class="reminder-toggle-track"></span>
          <span class="reminder-toggle-thumb"></span>
        </label>
      </div>
    `;
    card.appendChild(header);

    // Time row
    const timeRow = document.createElement('div');
    timeRow.className = `reminder-time-row${currentSettings.enabled ? '' : ' disabled'}`;
    timeRow.innerHTML = `
      <span class="reminder-time-label">Giờ nhắc</span>
      <input
        type="time"
        id="reminder-time-input"
        class="reminder-time-input"
        value="${currentSettings.time}"
        aria-label="Chọn giờ nhắc"
      />
    `;
    card.appendChild(timeRow);

    // Permission status
    const statusRow = document.createElement('div');
    statusRow.className = 'reminder-status-row';
    statusRow.innerHTML = `
      <span class="reminder-status-dot ${permStatus.cls}" aria-hidden="true"></span>
      <span>${permStatus.label}</span>
    `;
    card.appendChild(statusRow);

    // The API scheduler owns delivery; the browser only stores the user's permission.
    const disclaimer = document.createElement('p');
    disclaimer.className = 'reminder-disclaimer';
    disclaimer.textContent = 'Nhắc giờ được gửi từ server qua push. Cần cấp quyền thông báo và thiết bị có kết nối mạng.';
    card.appendChild(disclaimer);

    // ── Event handlers ──

    const toggleInput = card.querySelector<HTMLInputElement>('#reminder-toggle-input');
    const timeInput   = card.querySelector<HTMLInputElement>('#reminder-time-input');

    toggleInput?.addEventListener('change', async () => {
      const nowEnabled = toggleInput.checked;

      if (nowEnabled) {
        if (!('Notification' in window)) {
          const savedTime = timeInput?.value || settings.time;
          try {
            const newSettings: ReminderSettings = { enabled: true, time: savedTime, timezone: 'Asia/Ho_Chi_Minh' };
            saveReminderSettings(await saveRemoteReminderSettings(newSettings));
            showToast(`Đã bật nhắc lúc ${savedTime}`, 'success');
            render();
          } catch {
            toggleInput.checked = false;
            showToast('Không lưu được giờ nhắc, thử lại nhé', 'error');
          }
          return;
        }

        // Request permission first
        if (Notification.permission === 'denied') {
          showToast('Thông báo bị chặn. Vui lòng mở lại trong cài đặt trình duyệt.', 'error');
          toggleInput.checked = false;
          return;
        }

        let permission: NotificationPermission = Notification.permission;
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }

        if (permission !== 'granted') {
          showToast('Chưa cấp quyền thông báo', 'error');
          toggleInput.checked = false;
          return;
        }

        const pushSetup = await ensurePushSubscription(true);
        if (pushSetup.status !== 'subscribed') {
          showToast(pushSetup.message ?? 'Chưa đăng ký được nhận thông báo', 'error');
          toggleInput.checked = false;
          return;
        }

        const savedTime = timeInput?.value || settings.time;
        try {
          const newSettings: ReminderSettings = {
            enabled: true,
            time: savedTime,
            timezone: 'Asia/Ho_Chi_Minh',
          };
          saveReminderSettings(await saveRemoteReminderSettings(newSettings));
          showToast(`Đã bật nhắc lúc ${savedTime}`, 'success');
          render();
        } catch {
          toggleInput.checked = false;
          showToast('Không lưu được giờ nhắc, thử lại nhé', 'error');
        }
      } else {
        const savedTime = timeInput?.value || settings.time;
        try {
          const newSettings: ReminderSettings = {
            enabled: false,
            time: savedTime,
            timezone: 'Asia/Ho_Chi_Minh',
          };
          saveReminderSettings(await saveRemoteReminderSettings(newSettings));
          showToast('Đã tắt nhắc check-in', 'info');
          render();
        } catch {
          toggleInput.checked = true;
          showToast('Không cập nhật được nhắc check-in, thử lại nhé', 'error');
        }
      }
    });

    timeInput?.addEventListener('change', async () => {
      const current = getReminderSettings();
      const newTime = timeInput.value || current.time;
      const newSettings: ReminderSettings = { ...current, time: newTime };
      saveReminderSettings(newSettings);
      if (current.enabled) {
        try {
          saveReminderSettings(await saveRemoteReminderSettings(newSettings));
          showToast(`Đã đổi giờ nhắc sang ${newTime}`, 'success');
        } catch {
          showToast('Không lưu được giờ nhắc, thử lại nhé', 'error');
        }
      }
    });
  };

  const localSettings = { ...settings };
  render();
  void loadReminderSettings()
    .then(async (remoteSettings) => {
      const hasMigrated = localStorage.getItem(REMINDER_MIGRATION_KEY) === 'true';

      // Keep a schedule configured before reminders moved to the API.
      // The one-time marker avoids re-enabling a reminder intentionally disabled later.
      if (!hasMigrated && localSettings.enabled && !remoteSettings.enabled) {
        saveReminderSettings(await saveRemoteReminderSettings(localSettings));
      } else {
        saveReminderSettings(remoteSettings);
      }
      localStorage.setItem(REMINDER_MIGRATION_KEY, 'true');
      render();
    })
    .catch(() => {
      // Keep the last local display value until the API becomes available.
    });
  return card;
}

export function renderProfilePage(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page profile-page animate-fade-in';
  root.style.cssText = `
    padding: calc(var(--safe-top) + 24px) 16px calc(var(--safe-bottom) + var(--nav-height, 86px) + 60px) 16px;
    max-width: 480px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
    min-height: 100dvh;
    overflow-x: hidden;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'margin-bottom:4px;';
  header.innerHTML = `
    <h1 style="font-size:24px;font-weight:700;letter-spacing:-0.03em;">Tài khoản</h1>
    <p style="font-size:13px;color:var(--text-secondary);">Cài đặt và cấu hình ứng dụng của hai đứa</p>
  `;
  root.appendChild(header);

  // Profile info card (avatars, names, days together)
  const profileCard = document.createElement('div');
  profileCard.className = 'card';
  profileCard.style.cssText = 'padding:24px;display:flex;flex-direction:column;align-items:center;gap:16px;background:var(--surface);';
  root.appendChild(profileCard);

  // Settings section container
  const settingsContainer = document.createElement('div');
  settingsContainer.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
  root.appendChild(settingsContainer);

  async function loadProfile() {
    const cachedUser = store.get().user;
    const cachedCouple = store.get().couple;

    if (cachedUser && cachedCouple) {
      renderProfileCard({ user: cachedUser, couple: cachedCouple });
      renderSettings({ user: cachedUser, couple: cachedCouple });
    } else {
      profileCard.innerHTML = `<div class="spinner" style="width:28px;height:28px;margin:16px 0;"></div>`;
    }

    try {
      const res = await getMe();
      // Update local store
      store.set({
        user: res.user,
        couple: res.couple
      });

      renderProfileCard(res);
      renderSettings(res);

    } catch (err) {
      const error = err as Error;
      if (!cachedUser || !cachedCouple) {
        showToast('Không thể tải thông tin profile: ' + error.message, 'error');
      }
    }
  }

  function renderProfileCard(data: MeResponse) {
    const user = data.user;
    const couple = data.couple;
    const partner = data.partnerUser;

    const days = couple?.loveStartDate ? calcDaysTogether(couple.loveStartDate) : 0;
    const myAge = calcUserAge(user.birthday);
    const partnerAge = calcUserAge(user.partnerBirthday || partner?.birthday);

    const myAvatar = user.avatarUrl
      ? `<img src="${user.avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />`
      : `<img src="/profile.png" alt="avatar" style="width:70%;height:70%;object-fit:contain;" />`;
    const partnerAvatar = user.partnerAvatarUrl ? `<img src="${user.partnerAvatarUrl}" style="width:100%;height:100%;object-fit:cover;" />` : '💖';

    const displayPartnerName = (user.partnerName && user.partnerName !== 'undefined')
      ? user.partnerName
      : (partner?.displayName || 'Người ấy');

    profileCard.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;position:relative;">
        <div id="my-avatar-container" class="avatar avatar-lg" style="border:3px solid var(--accent);cursor:pointer;position:relative;">
          ${myAvatar}
          <div style="position:absolute;bottom:0;right:0;background:var(--accent);color:#fff;font-size:10px;padding:2px 4px;border-radius:4px;line-height:1;">Sửa</div>
        </div>
        <div style="font-size:24px;animation:pulse 2s ease-in-out infinite;">❤️</div>
        <div id="partner-avatar-container" class="avatar avatar-lg" style="border:3px solid var(--border);cursor:pointer;position:relative;">
          ${partnerAvatar}
          <div style="position:absolute;bottom:0;right:0;background:var(--text-secondary);color:#fff;font-size:10px;padding:2px 4px;border-radius:4px;line-height:1;">Sửa</div>
        </div>
      </div>
      
      <div style="text-align:center;width:100%;">
        <h2 style="font-size:18px;font-weight:700;margin-bottom:12px;">
          ${user.displayName || 'Bạn'} & ${displayPartnerName}
        </h2>

        <div style="
          display:grid;
          grid-template-columns:1fr 1.15fr 1fr;
          gap:6px;
          width:100%;
          align-items:stretch;
        ">
          <!-- Left: User Age -->
          <div id="btn-my-bday-pill" style="
            background:var(--surface-solid);
            border:1px solid var(--border);
            border-radius:14px;
            padding:5px 8px;
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            gap:1px;
            cursor:pointer;
            min-width:0;
            transition:transform 0.15s ease, border-color 0.15s ease;
          ">
            <span style="font-size:14px;line-height:1;">🎂</span>
            <strong style="font-size:12px;font-weight:700;color:var(--text-primary);white-space:nowrap;">
              ${myAge !== undefined ? `${myAge} tuổi` : 'Chưa đặt'}
            </strong>
          </div>

          <!-- Center: Streak Banner -->
          <div style="
            background:linear-gradient(135deg, #ff3b7f, #ff6b35);
            border-radius:14px;
            padding:5px 8px;
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            gap:1px;
            color:#ffffff;
            box-shadow:0 4px 14px rgba(255, 59, 127, 0.28);
            min-width:0;
          ">
            <span style="font-size:10px;opacity:0.9;font-weight:600;white-space:nowrap;">Streak 🔥</span>
            <strong style="font-size:12px;font-weight:800;white-space:nowrap;">
              ${couple?.streak || 0} ngày
            </strong>
          </div>

          <!-- Right: Partner Age -->
          <div id="btn-partner-bday-pill" style="
            background:var(--surface-solid);
            border:1px solid var(--border);
            border-radius:14px;
            padding:5px 8px;
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            gap:1px;
            cursor:pointer;
            min-width:0;
            transition:transform 0.15s ease, border-color 0.15s ease;
          ">
            <span style="font-size:14px;line-height:1;">🎂</span>
            <strong style="font-size:12px;font-weight:700;color:var(--text-primary);white-space:nowrap;">
              ${partnerAge !== undefined ? `${partnerAge} tuổi` : 'Chưa đặt'}
            </strong>
          </div>
        </div>
      </div>

      <div class="profile-days-section">
        <span style="font-size:32px;font-weight:800;color:var(--accent);">${days}</span>
        <span style="font-size:13px;font-weight:600;color:var(--text-secondary);">ngày bên nhau 💕</span>
        <span style="font-size:11px;color:var(--text-secondary);margin-top:2px;">Bắt đầu từ: ${couple?.loveStartDate ? new Date(couple.loveStartDate).toLocaleDateString('vi-VN') : 'Chưa đặt'}</span>
      </div>

      <div style="
        background:#ffffff;
        border:1px solid rgba(248, 57, 19, 0.12);
        border-radius:16px;
        padding:10px 14px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        width:100%;
        font-size:13px;
        cursor:pointer;
        box-shadow:0 2px 6px rgba(0, 0, 0, 1);
      " id="copy-code-container">
        <span style="color:var(--text-secondary);font-weight:500;">Couple Code:</span>
        <strong style="color:var(--accent);font-family:monospace;font-size:16px;letter-spacing:1.5px;font-weight:700;">${couple?.code || (couple as any)?.coupleCode || 'LOVE123'}</strong>
        <button type="button" aria-label="Sao chép" title="Sao chép couple code" style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:10px;background:rgba(255, 59, 127, 0.1);border:1px solid rgba(255, 59, 127, 0.2);color:var(--accent);cursor:pointer;transition:all 0.2s ease;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </div>
    `;

    // Click to jump to birthday settings
    profileCard.querySelector('#btn-my-bday-pill')?.addEventListener('click', () => {
      const settingsCard = document.querySelector('.birthday-settings-card');
      if (settingsCard) {
        settingsCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        settingsCard.querySelector<HTMLInputElement>('#birthday-self')?.focus();
      } else {
        showToast('Hãy cài ngày sinh ở mục Chỉnh sửa thông tin bên dưới', 'info');
      }
    });

    profileCard.querySelector('#btn-partner-bday-pill')?.addEventListener('click', () => {
      const settingsCard = document.querySelector('.birthday-settings-card');
      if (settingsCard) {
        settingsCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        settingsCard.querySelector<HTMLInputElement>('#birthday-partner')?.focus();
      } else {
        showToast('Hãy cài ngày sinh ở mục Chỉnh sửa thông tin bên dưới', 'info');
      }
    });

    // Click to copy code
    profileCard.querySelector('#copy-code-container')?.addEventListener('click', () => {
      if (couple?.code) {
        navigator.clipboard.writeText(couple.code);
        showToast('Đã sao chép couple code!', 'success');
      }
    });

    // Avatar Upload Triggers
    profileCard.querySelector('#my-avatar-container')?.addEventListener('click', () => {
      promptAvatarUpload('my');
    });
    profileCard.querySelector('#partner-avatar-container')?.addEventListener('click', () => {
      promptAvatarUpload('partner');
    });
  }

  function promptAvatarUpload(type: 'my' | 'partner') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:flex-end;justify-content:center;z-index:1000;';
    
    const sheet = document.createElement('div');
    sheet.className = 'modal animate-slide-up';
    sheet.style.cssText = 'background:var(--bg);border-radius:24px 24px 0 0;padding:20px;width:100%;max-width:440px;box-shadow:var(--shadow-elevated);';
    sheet.innerHTML = `
      <div style="width:36px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 16px auto;"></div>
      <h3 style="font-size:16px;font-weight:700;text-align:center;margin-bottom:16px;">
        Đổi ảnh đại diện ${type === 'my' ? 'của bạn' : 'người ấy'}
      </h3>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <button id="btn-camera-av" class="btn-primary" style="width:100%;padding:12px;">📷 Chụp ảnh mới</button>
        <button id="btn-gallery-av" class="btn-ghost" style="width:100%;padding:12px;">🖼️ Chọn ảnh từ album</button>
        <button id="btn-cancel-av-sheet" class="btn-ghost" style="width:100%;padding:12px;border:none;margin-top:4px;">Hủy bỏ</button>
      </div>
    `;
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    const closeSheet = () => document.body.removeChild(overlay);

    sheet.querySelector('#btn-cancel-av-sheet')?.addEventListener('click', closeSheet);
    
    const handleAvatarResult = async (res: CameraResult) => {
      showToast('Đang tải ảnh lên...', 'info');
      try {
        if (type === 'my') {
          await uploadAvatar(res.file);
        } else {
          await uploadPartnerAvatar(res.file);
        }
        showToast('Cập nhật avatar thành công!', 'success');
        loadProfile();
      } catch (err) {
        const error = err as Error;
        showToast('Lỗi tải ảnh lên: ' + error.message, 'error');
      }
    };

    sheet.querySelector('#btn-camera-av')?.addEventListener('click', () => {
      closeSheet();
      openCamera(handleAvatarResult);
    });
    sheet.querySelector('#btn-gallery-av')?.addEventListener('click', () => {
      closeSheet();
      openGallery(handleAvatarResult);
    });
  }

  function renderSettings(data: MeResponse) {
    settingsContainer.innerHTML = '';
    const user = data.user;
    const couple = data.couple;

    // 1. Edit Profile Row
    const editRow = document.createElement('div');
    editRow.className = 'card-solid';
    editRow.style.cssText = 'padding:16px;cursor:pointer;display:flex;justify-content:between;align-items:center;transition:all 0.2s;';
    editRow.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:20px;">📝</span>
        <div style="display:flex;flex-direction:column;">
          <span style="font-size:14px;font-weight:600;">Chỉnh sửa thông tin</span>
          <span style="font-size:11px;color:var(--text-secondary);">Tên hiển thị, Ngày kỷ niệm yêu</span>
        </div>
      </div>
      <span style="font-size:16px;color:var(--text-secondary);">→</span>
    `;
    editRow.addEventListener('click', () => {
      if (couple) {
        showEditProfileModal(user, couple);
      } else {
        showToast('Vui lòng hoàn tất ghép đôi cặp đôi trước.', 'info');
      }
    });
    settingsContainer.appendChild(editRow);

    // 2. Theme Toggle Row
    const themeRow = document.createElement('div');
    themeRow.className = 'card-solid theme-settings-card';
    
    const state = store.get();
    const curTheme = state.theme || 'system';

    const themeOptions: Array<{ value: 'light' | 'dark' | 'system'; label: string; icon: string; hint: string }> = [
      { value: 'light', label: 'Sáng', icon: '☀️', hint: 'Giao diện sáng' },
      { value: 'dark', label: 'Tối', icon: '🌙', hint: 'Giao diện tối' },
      { value: 'system', label: 'Hệ thống', icon: '⚙️', hint: 'Theo thiết bị' },
    ];

    themeRow.innerHTML = `
      <div class="theme-settings-copy">
        <span class="theme-settings-icon">🎨</span>
        <div>
          <span class="theme-settings-title">Giao diện</span>
          <span class="theme-settings-subtitle">Chọn cách app hiển thị theo mắt bạn.</span>
        </div>
      </div>
      <div class="theme-segmented" role="radiogroup" aria-label="Chọn giao diện">
        ${themeOptions.map((option) => `
          <button
            type="button"
            class="theme-choice${curTheme === option.value ? ' active' : ''}"
            data-theme-choice="${option.value}"
            role="radio"
            aria-checked="${curTheme === option.value}"
          >
            <span>${option.icon}</span>
            <strong>${option.label}</strong>
            <small>${option.hint}</small>
          </button>
        `).join('')}
      </div>
    `;

    themeRow.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const selected = btn.dataset.themeChoice as 'light' | 'dark' | 'system';
        store.set({ theme: selected });

        themeRow.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach((item) => {
          const active = item.dataset.themeChoice === selected;
          item.classList.toggle('active', active);
          item.setAttribute('aria-checked', String(active));
        });

        applyTheme(selected);

        showToast('Đã đổi giao diện thành công!', 'success');
      });
    });
    settingsContainer.appendChild(themeRow);

    // 3. APK Update Row
    const updateRow = document.createElement('div');
    updateRow.className = 'card-solid';
    updateRow.style.cssText = 'padding:16px;display:flex;flex-direction:column;gap:12px;';
    updateRow.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
        <div style="display:flex;align-items:flex-start;gap:12px;min-width:0;">
          <span style="font-size:20px;line-height:1;">⬆️</span>
          <div style="display:flex;flex-direction:column;gap:4px;min-width:0;">
            <span style="font-size:14px;font-weight:600;">Cập nhật APK</span>
            <span id="apk-update-status" style="font-size:11px;color:var(--text-secondary);line-height:1.4;">
              Kiểm tra bản Android mới nhất để tránh thiếu tính năng.
            </span>
          </div>
        </div>
        <button id="check-apk-update-btn" class="btn-ghost" style="padding:8px 10px;font-size:12px;white-space:nowrap;">
          Kiểm tra
        </button>
      </div>
      <button id="download-apk-update-btn" class="btn-primary" style="display:none;width:100%;padding:10px;justify-content:center;">
        Tải APK mới
      </button>
    `;
    const statusEl = updateRow.querySelector<HTMLElement>('#apk-update-status');
    const checkButton = updateRow.querySelector<HTMLButtonElement>('#check-apk-update-btn');
    const downloadButton = updateRow.querySelector<HTMLButtonElement>('#download-apk-update-btn');

    if (statusEl && checkButton && downloadButton) {
      checkButton.addEventListener('click', () => {
        checkApkUpdate(statusEl, checkButton, downloadButton);
      });
      downloadButton.addEventListener('click', () => {
        window.location.href = downloadButton.dataset.updateUrl || GITHUB_RELEASES_PAGE;
      });
    }
    settingsContainer.appendChild(updateRow);

    // 3b. Check-in Reminder Row
    const reminderCard = buildReminderCard();
    settingsContainer.appendChild(reminderCard);

    // 4. Logout Row
    const logoutRow = document.createElement('div');
    logoutRow.className = 'card-solid';
    logoutRow.style.cssText = 'padding:16px;cursor:pointer;display:flex;justify-content:between;align-items:center;border-color:rgba(239, 68, 68, 0.2);';
    logoutRow.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:20px;">🚪</span>
        <div style="display:flex;flex-direction:column;">
          <span style="font-size:14px;font-weight:600;color:#ef4444;">Đăng xuất</span>
          <span style="font-size:11px;color:var(--text-secondary);">Thoát tài khoản khỏi thiết bị này</span>
        </div>
      </div>
      <span style="font-size:16px;color:#ef4444;">→</span>
    `;
    logoutRow.addEventListener('click', () => {
      showModal({
        title: 'Đăng xuất tài khoản',
        content: 'Bạn có chắc chắn muốn đăng xuất? Thiết bị này sẽ cần quét hoặc nhập lại couple code để đăng nhập.',
        confirmText: 'Đăng xuất',
        cancelText: 'Hủy',
        danger: true,
        center: true,
        onConfirm: () => {
          clearPrivateClientState();
          navigate('/onboarding');
        }
      });
    });
    settingsContainer.appendChild(logoutRow);
  }

  function showEditProfileModal(user: User, couple: Couple) {
    const form = document.createElement('div');
    form.style.cssText = 'display:flex;flex-direction:column;gap:14px;width:100%;text-align:left;';
    
    // Format loveStartDate to YYYY-MM-DD for date input
    const originalDate = couple.loveStartDate ? new Date(couple.loveStartDate) : new Date();
    const dateString = originalDate.toISOString().substring(0, 10);

    form.innerHTML = `
      <div class="input-group">
        <label class="input-label">Tên của bạn</label>
        <input type="text" id="edit-my-name" class="input" value="${user.displayName}" placeholder="Tên hiển thị của bạn" required />
      </div>
      <div class="input-group">
        <label class="input-label">Tên người ấy</label>
        <input type="text" id="edit-partner-name" class="input" value="${user.partnerName}" placeholder="Tên người đặc biệt" required />
      </div>
      <div class="input-group">
        <label class="input-label">Ngày bắt đầu yêu nhau</label>
        <input type="date" id="edit-love-date" class="input" value="${dateString}" required />
      </div>
    `;

    showModal({
      title: 'Chỉnh sửa thông tin',
      content: form,
      confirmText: 'Lưu thay đổi',
      cancelText: 'Hủy',
      center: true,
      onConfirm: async () => {
        const displayName = (form.querySelector('#edit-my-name') as HTMLInputElement).value.trim();
        const partnerName = (form.querySelector('#edit-partner-name') as HTMLInputElement).value.trim();
        const loveStartDate = (form.querySelector('#edit-love-date') as HTMLInputElement).value;

        if (!displayName || !partnerName || !loveStartDate) {
          showToast('Vui lòng điền đầy đủ thông tin!', 'error');
          throw new Error('Fields missing');
        }

        try {
          await updateProfile({
            displayName,
            partnerName,
            loveStartDate
          });
          showToast('Cập nhật thông tin thành công!', 'success');
          loadProfile();
         } catch (err) {
          const error = err as Error;
          showToast('Lỗi cập nhật: ' + error.message, 'error');
          throw error;
        }
      }
    });
  }

  loadProfile();

  // Inject Nav
  return root;
}
