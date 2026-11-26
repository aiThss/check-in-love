import '../styles/20-pages/profile.css';
import { navigate } from '../router';
import { clearPrivateClientState } from '../session';
import { store, applyTheme } from '../store/index';
import { updateProfile, uploadAvatar, uploadPartnerAvatar } from '../api/profile';
import { getMe, type MeResponse } from '../api/auth';
import { showToast } from '../components/toast';
import { showModal } from '../components/modal';
import { openCamera, openGallery, type CameraResult } from '../components/camera';
import { apiFetch } from '../api/client';
import { ensurePushSubscription, isAndroidApp, testPushNotification, syncAndroidFcmNow } from '../api/push';
import { isMockPreviewMode } from '../dev/mock-data';
import { iconMarkup } from '../ui/icons/icons';
import { createButton, getInitials } from '../ui/primitives';
import { createSegmentedControl, createSwitch } from '../ui/forms';
import { createListGroup, createListRow, createSkeleton } from '../ui/feedback';
import { openSheet } from '../ui/overlays';
import { triggerHaptic } from '../ui/haptics';
import {
  ACCENT_PRESETS,
  getUiAccent,
  getUiReducedMotion,
  setUiAccent,
  setUiReducedMotion,
  setUiTheme,
  type UiAccentId,
  type UiThemePreference,
} from '../ui/theme/index';
import type { User, Couple } from '../api/types';

function calcDaysTogether(loveStartDate?: string): number {
  if (!loveStartDate) return 0;
  const start = new Date(loveStartDate);
  const diff = Date.now() - start.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function calcUserAge(birthdayStr?: string | null): number | undefined {
  if (!birthdayStr) return undefined;
  const parts = birthdayStr.split('T')[0].split('-');
  if (parts.length < 3) return undefined;

  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10) - 1;
  const birthDay = parseInt(parts[2], 10);
  if (Number.isNaN(birthYear) || Number.isNaN(birthMonth) || Number.isNaN(birthDay)) return undefined;

  const now = new Date();
  let age = now.getFullYear() - birthYear;
  const m = now.getMonth() - birthMonth;
  if (m < 0 || (m === 0 && now.getDate() < birthDay)) age--;
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

async function checkApkUpdate(
  statusEl: HTMLElement,
  checkButton: HTMLButtonElement,
  downloadButton: HTMLButtonElement,
): Promise<void> {
  const previousLabel = checkButton.textContent || 'Kiểm tra';
  checkButton.disabled = true;
  checkButton.textContent = 'Đang quét...';
  downloadButton.style.display = 'none';
  statusEl.textContent = 'Đang kiểm tra bản phát hành Android mới nhất...';

  try {
    const res = await fetch(GITHUB_RELEASE_API, {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub trả về ${res.status}`);

    const release = (await res.json()) as GitHubRelease;
    const latestVersion = normalizeVersion(release.tag_name || release.name);
    const apkAsset = release.assets?.find((a) => a.name.toLowerCase().endsWith('.apk'));
    const updateUrl = apkAsset?.browser_download_url || release.html_url || GITHUB_RELEASES_PAGE;
    const currentVersion = getCurrentAndroidVersion();

    downloadButton.dataset.updateUrl = updateUrl;
    downloadButton.textContent = apkAsset ? 'Tải APK mới' : 'Mở trang phát hành';
    downloadButton.style.display = 'inline-flex';

    if (!latestVersion) {
      statusEl.textContent = 'Đã tìm thấy bản phát hành trên GitHub.';
      return;
    }
    if (!currentVersion) {
      statusEl.textContent = `Phiên bản mới nhất trên GitHub: v${latestVersion}.`;
      return;
    }
    if (compareVersions(currentVersion, latestVersion) >= 0) {
      statusEl.textContent = `Bạn đang ở phiên bản mới nhất (v${currentVersion}).`;
      downloadButton.style.display = 'none';
      showToast(`Đang ở phiên bản mới nhất v${currentVersion}!`, 'success');
      return;
    }

    statusEl.textContent = `Có phiên bản mới v${latestVersion} (đang cài v${currentVersion}).`;
    showToast(`Có bản cập nhật mới v${latestVersion}!`, 'success');
  } catch (err) {
    statusEl.textContent = `Chưa kiểm tra được: ${(err as Error).message || 'lỗi mạng'}.`;
    downloadButton.dataset.updateUrl = GITHUB_RELEASES_PAGE;
    downloadButton.textContent = 'Mở trang phát hành';
    downloadButton.style.display = 'inline-flex';
  } finally {
    checkButton.disabled = false;
    checkButton.textContent = previousLabel;
  }
}

/* ── Check-in Reminder ── */
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
  } catch {}
  return { enabled: false, time: '20:30', timezone: 'Asia/Ho_Chi_Minh' };
}

function saveReminderSettings(settings: ReminderSettings): void {
  try {
    localStorage.setItem(REMINDER_KEY, JSON.stringify(settings));
  } catch {}
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

export function restoreReminderOnLoad(): void {}

function getPermissionStatus(): { label: string; ok: boolean } {
  if (isAndroidApp()) return { label: 'Thông báo Native Android FCM + SSE đang sẵn sàng', ok: true };
  if (!('Notification' in window)) return { label: 'Đồng bộ nhắc qua máy chủ sẵn sàng', ok: true };
  if (Notification.permission === 'granted') return { label: 'Đã cấp quyền thông báo trình duyệt (Web Push + SSE)', ok: true };
  if (Notification.permission === 'denied') return { label: 'Quyền thông báo đang bị tắt trong cài đặt trình duyệt', ok: false };
  return { label: 'Chưa bật quyền nhận thông báo đẩy', ok: false };
}

function buildReminderCard(): HTMLElement {
  const card = document.createElement('div');
  card.className = 'p-profile-card reminder-card';

  const localInitial = { ...getReminderSettings() };

  const render = () => {
    const current = getReminderSettings();
    const perm = getPermissionStatus();
    card.replaceChildren();

    const top = document.createElement('div');
    top.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;';
    top.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;min-width:0;">
        <span style="width:36px;height:36px;border-radius:12px;background:var(--accent-100);color:var(--accent-600);display:grid;place-items:center;flex-shrink:0;">
          ${iconMarkup('bell', { size: 20, variant: current.enabled ? 'filled' : 'outline' })}
        </span>
        <div>
          <strong style="display:block;font-size:14px;">Nhắc gửi khoảnh khắc mỗi ngày</strong>
          <span class="u-text-secondary" style="font-size:12px;">Nhắc đúng giờ hẹn kể cả khi đã đóng ứng dụng</span>
        </div>
      </div>
    `;

    const sw = createSwitch({
      ariaLabel: current.enabled ? 'Tắt nhắc check-in' : 'Bật nhắc check-in',
      checked: current.enabled,
      onChange: async (nowEnabled) => {
        const timeInput = card.querySelector<HTMLInputElement>('#reminder-time-input');
        const savedTime = timeInput?.value || current.time;

        if (nowEnabled && !isAndroidApp() && 'Notification' in window) {
          if (Notification.permission === 'denied') {
            showToast('Quyền thông báo đang bị chặn trong trình duyệt.', 'error');
            sw.setChecked(false);
            return;
          }
          let permission: NotificationPermission = Notification.permission;
          if (permission === 'default') permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            showToast('Chưa cấp quyền thông báo', 'error');
            sw.setChecked(false);
            return;
          }
          const pushSetup = await ensurePushSubscription(true);
          if (pushSetup.status !== 'subscribed') {
            showToast(pushSetup.message ?? 'Chưa đăng ký được nhận thông báo', 'error');
            sw.setChecked(false);
            return;
          }
        }

        try {
          const next: ReminderSettings = { enabled: nowEnabled, time: savedTime, timezone: 'Asia/Ho_Chi_Minh' };
          saveReminderSettings(await saveRemoteReminderSettings(next));
          showToast(nowEnabled ? `Đã bật nhắc lúc ${savedTime}` : 'Đã tắt nhắc check-in', 'success');
          render();
        } catch {
          sw.setChecked(!nowEnabled);
          showToast('Không lưu được cài đặt nhắc hẹn, thử lại nhé', 'error');
        }
      },
    });
    top.appendChild(sw.element);
    card.appendChild(top);

    const timeRow = document.createElement('div');
    timeRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding-top:8px;border-top:1px solid var(--border-subtle);';
    timeRow.innerHTML = `
      <span style="font-size:13px;font-weight:600;">Khung giờ nhắc</span>
      <input type="time" id="reminder-time-input" class="c-input" style="width:auto;min-height:38px;padding:4px 10px;" value="${current.time}" aria-label="Chọn giờ nhắc" />
    `;
    const timeInput = timeRow.querySelector<HTMLInputElement>('#reminder-time-input');
    timeInput?.addEventListener('change', async () => {
      const latest = getReminderSettings();
      const newTime = timeInput.value || latest.time;
      const next: ReminderSettings = { ...latest, time: newTime };
      saveReminderSettings(next);
      if (latest.enabled) {
        try {
          saveReminderSettings(await saveRemoteReminderSettings(next));
          showToast(`Đã đổi giờ nhắc sang ${newTime}`, 'success');
        } catch {
          showToast('Không lưu được giờ nhắc', 'error');
        }
      }
    });
    card.appendChild(timeRow);

    const statusFoot = document.createElement('div');
    statusFoot.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;';
    statusFoot.innerHTML = `
      <span class="u-text-secondary" style="font-size:11px;display:inline-flex;align-items:center;gap:6px;">
        ${iconMarkup(perm.ok ? 'check' : 'info', { size: 16 })}<span>${perm.label}</span>
      </span>
    `;
    const testBtn = createButton({
      label: 'Thử gửi thông báo',
      variant: 'secondary',
      size: 'sm',
      pill: true,
      leadingIcon: 'bell',
      onClick: async () => {
        testBtn.setLoading(true, 'Đang gửi thử...');
        try {
          if (isAndroidApp()) {
            const synced = await syncAndroidFcmNow().catch(() => false);
            if (!synced) {
              try {
                const rawDebug = window.LoveCheckAndroid?.getFcmDebugInfo?.();
                if (rawDebug) {
                  const debug = JSON.parse(rawDebug) as { error?: string };
                  if (debug.error) {
                    showToast(`Lỗi Firebase Native: ${debug.error}`, 'error');
                    return;
                  }
                }
              } catch {}
            }
          }
          const res = await testPushNotification();
          showToast(res.message || 'Đã gửi thông báo thử nghiệm thành công!', 'success');
        } catch (err) {
          showToast((err as Error)?.message || 'Không gửi được thông báo thử', 'error');
        } finally {
          testBtn.setLoading(false);
        }
      },
    });
    testBtn.element.id = 'btn-test-push';
    statusFoot.appendChild(testBtn.element);
    card.appendChild(statusFoot);
  };

  render();
  void loadReminderSettings()
    .then(async (remoteSettings) => {
      const hasMigrated = localStorage.getItem(REMINDER_MIGRATION_KEY) === 'true';
      if (!hasMigrated && localInitial.enabled && !remoteSettings.enabled) {
        saveReminderSettings(await saveRemoteReminderSettings(localInitial));
      } else {
        saveReminderSettings(remoteSettings);
      }
      localStorage.setItem(REMINDER_MIGRATION_KEY, 'true');
      render();
    })
    .catch(() => {});

  return card;
}

export function renderProfilePage(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page profile-page p-profile animate-fade-in';

  const header = document.createElement('header');
  header.className = 'p-profile-header';
  header.innerHTML = `
    <h1>Hồ sơ hai đứa</h1>
    <p>Cá nhân hoá giao diện, thông báo và kỷ niệm chung</p>
  `;
  root.appendChild(header);

  const profileCard = document.createElement('section');
  profileCard.className = 'p-profile-hero u-grain-surface';
  root.appendChild(profileCard);

  const settingsContainer = document.createElement('div');
  settingsContainer.style.cssText = 'display:flex;flex-direction:column;gap:18px;';
  root.appendChild(settingsContainer);

  async function loadProfile(): Promise<void> {
    const cachedUser = store.get().user;
    const cachedCouple = store.get().couple;

    if (cachedUser && cachedCouple) {
      renderProfileCard({ user: cachedUser, couple: cachedCouple });
      renderSettings({ user: cachedUser, couple: cachedCouple });
    } else {
      profileCard.replaceChildren(createSkeleton({ height: '180px' }));
    }

    try {
      const res = await getMe();
      store.set({ user: res.user, couple: res.couple });
      renderProfileCard(res);
      renderSettings(res);
    } catch (err) {
      if (!cachedUser || !cachedCouple) {
        showToast('Không thể tải thông tin hồ sơ: ' + (err as Error).message, 'error');
      }
    }
  }

  function renderAvatarButton(
    id: string,
    name: string,
    avatarUrl: string | undefined,
    ariaLabel: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = id;
    btn.className = 'p-profile-av-btn';
    btn.setAttribute('aria-label', ariaLabel);
    const clip = document.createElement('span');
    clip.className = 'p-profile-av-btn__clip';
    if (avatarUrl) {
      const img = document.createElement('img');
      img.src = avatarUrl;
      img.alt = '';
      img.loading = 'lazy';
      img.addEventListener('error', () => {
        clip.textContent = getInitials(name);
      });
      clip.appendChild(img);
    } else {
      clip.textContent = getInitials(name);
    }
    const camBadge = document.createElement('span');
    camBadge.className = 'p-profile-av-btn__cam';
    camBadge.setAttribute('aria-hidden', 'true');
    camBadge.innerHTML = iconMarkup('camera', { size: 16 });
    btn.append(clip, camBadge);
    btn.addEventListener('click', onClick);
    return btn;
  }

  function renderProfileCard(data: MeResponse): void {
    const user = data.user;
    const couple = data.couple;
    const partner = data.partnerUser;

    const days = couple?.loveStartDate ? calcDaysTogether(couple.loveStartDate) : 0;
    const myAge = calcUserAge(user.birthday);
    const partnerAge = calcUserAge(user.partnerBirthday || partner?.birthday);
    const myName = user.displayName || 'Bạn';
    const displayPartnerName =
      user.partnerName && user.partnerName !== 'undefined'
        ? user.partnerName
        : partner?.displayName || 'Người ấy';

    profileCard.replaceChildren();

    const avRow = document.createElement('div');
    avRow.className = 'p-profile-avatars';
    avRow.appendChild(
      renderAvatarButton('my-avatar-container', myName, user.avatarUrl, 'Đổi ảnh đại diện của bạn', () => promptAvatarUpload('my')),
    );
    const heartKnot = document.createElement('span');
    heartKnot.style.color = 'var(--accent-500)';
    heartKnot.innerHTML = iconMarkup('heart', { size: 24, variant: 'filled', motion: 'heartbeat' });
    avRow.appendChild(heartKnot);
    avRow.appendChild(
      renderAvatarButton('partner-avatar-container', displayPartnerName, user.partnerAvatarUrl, 'Đổi ảnh đại diện người ấy', () => promptAvatarUpload('partner')),
    );
    profileCard.appendChild(avRow);

    const namesH2 = document.createElement('h2');
    namesH2.className = 'p-profile-names';
    namesH2.textContent = `${myName} & ${displayPartnerName}`;
    profileCard.appendChild(namesH2);

    const pills = document.createElement('div');
    pills.className = 'p-profile-pills';

    const myBdayBtn = document.createElement('button');
    myBdayBtn.type = 'button';
    myBdayBtn.id = 'btn-my-bday-pill';
    myBdayBtn.className = 'p-profile-stat-pill';
    myBdayBtn.innerHTML = `${iconMarkup('anniversary', { size: 16 })}<strong>${myAge !== undefined ? `${myAge} tuổi` : 'Đặt tuổi'}</strong>`;
    myBdayBtn.addEventListener('click', () => {
      document.querySelector<HTMLInputElement>('#birthday-self')?.focus();
      document.querySelector('.birthday-settings-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    const streakPill = document.createElement('div');
    streakPill.className = 'p-profile-stat-pill p-profile-stat-pill--gold';
    streakPill.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:4px;">${iconMarkup('streak', { size: 16, variant: 'filled' })}<span>Chuỗi ngày</span></span>
      <strong>${couple?.streak || 0} ngày</strong>
      <span class="streak-banner" hidden></span>
    `;

    const partnerBdayBtn = document.createElement('button');
    partnerBdayBtn.type = 'button';
    partnerBdayBtn.id = 'btn-partner-bday-pill';
    partnerBdayBtn.className = 'p-profile-stat-pill';
    partnerBdayBtn.innerHTML = `${iconMarkup('anniversary', { size: 16 })}<strong>${partnerAge !== undefined ? `${partnerAge} tuổi` : 'Đặt tuổi'}</strong>`;
    partnerBdayBtn.addEventListener('click', () => {
      document.querySelector<HTMLInputElement>('#birthday-partner')?.focus();
      document.querySelector('.birthday-settings-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    pills.append(myBdayBtn, streakPill, partnerBdayBtn);
    profileCard.appendChild(pills);

    const daysBox = document.createElement('div');
    daysBox.className = 'p-profile-days';
    const startLabel = couple?.loveStartDate
      ? new Date(couple.loveStartDate).toLocaleDateString('vi-VN')
      : 'Chưa đặt ngày kỷ niệm';
    daysBox.innerHTML = `
      <strong>${days.toLocaleString('vi-VN')}</strong>
      <span style="font-size:13px;font-weight:600;color:var(--text-secondary);">ngày bên nhau</span>
      <small class="u-text-secondary" style="font-size:11px;">Từ ${startLabel}</small>
    `;
    profileCard.appendChild(daysBox);

    const coupleCode = couple?.code || (couple as Couple & { coupleCode?: string })?.coupleCode || 'LOVE123';
    const codeBar = document.createElement('button');
    codeBar.type = 'button';
    codeBar.id = 'copy-code-container';
    codeBar.className = 'p-profile-code-bar';
    codeBar.setAttribute('aria-label', 'Sao chép mã ghép đôi Couple Code');
    codeBar.innerHTML = `
      <span class="u-text-secondary" style="font-size:12px;font-weight:600;">Couple Code</span>
      <code>${coupleCode}</code>
      ${iconMarkup('copy', { size: 16 })}
    `;
    codeBar.addEventListener('click', () => {
      if (coupleCode) {
        void navigator.clipboard?.writeText(coupleCode);
        triggerHaptic('tap');
        showToast('Đã sao chép Couple Code!', 'success');
      }
    });
    profileCard.appendChild(codeBar);
  }

  function promptAvatarUpload(type: 'my' | 'partner'): void {
    const content = document.createElement('div');
    content.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

    const handleAvatarResult = async (res: CameraResult) => {
      showToast('Đang tải ảnh đại diện lên...', 'info');
      try {
        if (type === 'my') await uploadAvatar(res.file);
        else await uploadPartnerAvatar(res.file);
        showToast('Đã cập nhật ảnh đại diện!', 'success');
        void loadProfile();
      } catch (err) {
        showToast('Lỗi tải ảnh lên: ' + (err as Error).message, 'error');
      }
    };

    let closeAvatarSheet = () => {};
    content.appendChild(
      createButton({
        label: 'Chụp ảnh mới',
        variant: 'primary',
        pill: true,
        block: true,
        leadingIcon: 'camera',
        onClick: () => {
          closeAvatarSheet();
          openCamera(handleAvatarResult);
        },
      }).element,
    );
    content.appendChild(
      createButton({
        label: 'Chọn ảnh từ Album',
        variant: 'secondary',
        pill: true,
        block: true,
        leadingIcon: 'gallery',
        onClick: () => {
          closeAvatarSheet();
          openGallery(handleAvatarResult);
        },
      }).element,
    );

    closeAvatarSheet = openSheet({
      title: `Đổi ảnh đại diện ${type === 'my' ? 'của bạn' : 'người ấy'}`,
      content,
    }).close;
  }

  function buildSection(label: string, ...nodes: HTMLElement[]): HTMLElement {
    const sec = document.createElement('section');
    sec.className = 'p-profile-section';
    const lbl = document.createElement('span');
    lbl.className = 'p-profile-section__label';
    lbl.textContent = label;
    sec.append(lbl, ...nodes);
    return sec;
  }

  function renderSettings(data: MeResponse): void {
    settingsContainer.replaceChildren();
    const user = data.user;
    const couple = data.couple;
    const partner = data.partnerUser;

    // ── Section 1: Hồ sơ & Kỷ niệm ──
    const editRow = createListRow({
      title: 'Chỉnh sửa thông tin',
      subtitle: 'Tên hiển thị của hai đứa & Ngày bắt đầu yêu',
      leadingIcon: 'edit',
      chevron: true,
      onClick: () => {
        if (couple) showEditProfileModal(user, couple);
        else showToast('Vui lòng hoàn tất ghép đôi trước.', 'info');
      },
    });
    editRow.classList.add('card-solid');

    const journeyRow = createListRow({
      title: 'Bản đồ hẹn hò & Điều ước',
      subtitle: 'Toạ độ đã ghé qua và mục tiêu thực hiện cùng nhau',
      leadingIcon: 'map',
      chevron: true,
      onClick: () => navigate('/app/journey'),
    });

    const cardsRow = createListRow({
      title: 'Bộ thiệp cào ngày đặc biệt',
      subtitle: 'Xem trước các thiệp kỷ niệm 100 ngày, sinh nhật, lễ tình nhân',
      leadingIcon: 'gift',
      chevron: true,
      onClick: () => navigate('/preview/cards'),
    });

    // Native Birthday Settings Card (rendered cleanly from frame 0)
    const bdayCard = document.createElement('div');
    bdayCard.className = 'p-profile-card birthday-settings-card';
    const todayIso = new Date().toISOString().split('T')[0];
    const selfBday = user.birthday ? user.birthday.split('T')[0] : '';
    const partBday = (user.partnerBirthday || partner?.birthday || '').split('T')[0];
    bdayCard.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="width:36px;height:36px;border-radius:12px;background:var(--gold-bg);color:var(--gold-ink);display:grid;place-items:center;flex-shrink:0;">
          ${iconMarkup('anniversary', { size: 20, variant: 'filled' })}
        </span>
        <div>
          <strong style="display:block;font-size:14px;">Ngày sinh nhật hai đứa</strong>
          <span class="u-text-secondary" style="font-size:12px;">Tự động mở thiệp chúc mừng đúng 00:00 ngày sinh nhật</span>
        </div>
      </div>
      <div class="p-bday-grid">
        <div>
          <label class="c-field__label" for="birthday-self" style="font-size:11px;">Sinh nhật của bạn</label>
          <input id="birthday-self" type="date" class="c-input" max="${todayIso}" value="${selfBday}" style="margin-top:4px;min-height:42px;" />
        </div>
        <div>
          <label class="c-field__label" for="birthday-partner" style="font-size:11px;">Sinh nhật người ấy</label>
          <input id="birthday-partner" type="date" class="c-input" max="${todayIso}" value="${partBday}" style="margin-top:4px;min-height:42px;" />
        </div>
      </div>
    `;
    const saveBdayCtrl = createButton({
      label: 'Lưu ngày sinh nhật',
      variant: 'secondary',
      size: 'sm',
      pill: true,
      leadingIcon: 'check',
      onClick: async () => {
        const sVal = bdayCard.querySelector<HTMLInputElement>('#birthday-self')?.value || null;
        const pVal = bdayCard.querySelector<HTMLInputElement>('#birthday-partner')?.value || null;
        saveBdayCtrl.setLoading(true, 'Đang lưu...');
        try {
          await updateProfile({ birthday: sVal, partnerBirthday: pVal });
          showToast('Đã lưu ngày sinh nhật!', 'success');
          void loadProfile();
        } catch (err) {
          showToast('Không lưu được ngày sinh: ' + (err as Error).message, 'error');
        } finally {
          saveBdayCtrl.setLoading(false);
        }
      },
    });
    bdayCard.appendChild(saveBdayCtrl.element);

    settingsContainer.appendChild(
      buildSection('Hồ sơ & Kỷ niệm', createListGroup([editRow, journeyRow, cardsRow]), bdayCard),
    );

    // ── Section 2: Giao diện & Màu nhấn (Theme + 6 Accent Presets + Reduced Motion) ──
    const appearanceCard = document.createElement('div');
    appearanceCard.className = 'p-profile-card theme-settings-card';

    const curTheme = store.get().theme || 'system';
    const themeHeader = document.createElement('div');
    themeHeader.innerHTML = `
      <strong style="display:block;font-size:14px;">Chế độ sáng tối</strong>
      <span class="u-text-secondary" style="font-size:12px;">Đồng bộ tức thì trên toàn bộ ứng dụng</span>
    `;
    const themeSeg = createSegmentedControl<UiThemePreference>({
      ariaLabel: 'Chọn chế độ giao diện',
      value: curTheme,
      fullWidth: true,
      items: [
        { value: 'light', label: 'Sáng' },
        { value: 'dark', label: 'Tối' },
        { value: 'system', label: 'Hệ thống' },
      ],
      onChange: (selected) => {
        triggerHaptic('select');
        store.set({ theme: selected });
        applyTheme(selected);
        setUiTheme(selected);
        showToast('Đã cập nhật chế độ giao diện!', 'success');
      },
    });

    const accentHeader = document.createElement('div');
    accentHeader.style.paddingTop = '6px';
    accentHeader.innerHTML = `
      <strong style="display:block;font-size:14px;">Màu nhấn chủ đạo</strong>
      <span class="u-text-secondary" style="font-size:12px;">6 sắc thái đạt chuẩn tương phản WCAG AA</span>
    `;
    const accentGrid = document.createElement('div');
    accentGrid.className = 'p-accent-grid';
    accentGrid.setAttribute('role', 'radiogroup');
    accentGrid.setAttribute('aria-label', 'Chọn màu nhấn');

    const renderSwatches = () => {
      const currentAccent = getUiAccent();
      accentGrid.replaceChildren();
      ACCENT_PRESETS.forEach((preset) => {
        const active = preset.id === currentAccent;
        const sw = document.createElement('button');
        sw.type = 'button';
        sw.className = `p-accent-swatch${active ? ' is-active' : ''}`;
        sw.style.background = preset.swatchHex;
        sw.setAttribute('role', 'radio');
        sw.setAttribute('aria-checked', String(active));
        sw.setAttribute('aria-label', `Màu ${preset.label}`);
        sw.title = preset.label;
        if (active) sw.innerHTML = iconMarkup('check', { size: 20 });
        sw.addEventListener('click', () => {
          triggerHaptic('select');
          setUiAccent(preset.id as UiAccentId);
          renderSwatches();
          showToast(`Đã chọn sắc màu "${preset.label}"`, 'success');
        });
        accentGrid.appendChild(sw);
      });
    };
    renderSwatches();

    const motionRow = document.createElement('div');
    motionRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:8px;border-top:1px solid var(--border-subtle);';
    motionRow.innerHTML = `
      <div>
        <strong style="display:block;font-size:13px;">Giảm hiệu ứng chuyển động</strong>
        <span class="u-text-secondary" style="font-size:11px;">Tắt hiệu ứng nảy và pháo tim cho máy tiết kiệm pin</span>
      </div>
    `;
    const motionSwitch = createSwitch({
      ariaLabel: 'Giảm hiệu ứng chuyển động',
      checked: getUiReducedMotion() === 'on',
      onChange: (on) => {
        setUiReducedMotion(on ? 'on' : 'off');
        triggerHaptic('select');
      },
    });
    motionRow.appendChild(motionSwitch.element);

    appearanceCard.append(themeHeader, themeSeg.element, accentHeader, accentGrid, motionRow);
    settingsContainer.appendChild(buildSection('Giao diện & Cá nhân hoá', appearanceCard));

    // ── Section 3: Thông báo & Nhắc hẹn ──
    settingsContainer.appendChild(buildSection('Thông báo & Nhắc hẹn', buildReminderCard()));

    // ── Section 4: Ứng dụng, Bảo mật & Tài khoản ──
    const apkCard = document.createElement('div');
    apkCard.className = 'p-profile-card';
    apkCard.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div style="display:flex;align-items:center;gap:10px;min-width:0;">
          <span style="width:36px;height:36px;border-radius:12px;background:var(--neutral-100);color:var(--text-primary);display:grid;place-items:center;flex-shrink:0;">
            ${iconMarkup('download', { size: 20 })}
          </span>
          <div style="min-width:0;">
            <strong style="display:block;font-size:14px;">Phiên bản ứng dụng Android</strong>
            <span id="apk-update-status" class="u-text-secondary" style="font-size:12px;display:block;">Kiểm tra bản cài đặt APK mới nhất trên GitHub.</span>
          </div>
        </div>
        <button type="button" id="check-apk-update-btn" class="c-btn c-btn--secondary c-btn--sm c-btn--pill">Kiểm tra</button>
      </div>
      <button type="button" id="download-apk-update-btn" class="c-btn c-btn--primary c-btn--sm c-btn--pill c-btn--block" style="display:none;">Tải APK mới</button>
    `;
    const statusEl = apkCard.querySelector<HTMLElement>('#apk-update-status');
    const checkBtn = apkCard.querySelector<HTMLButtonElement>('#check-apk-update-btn');
    const downloadBtn = apkCard.querySelector<HTMLButtonElement>('#download-apk-update-btn');
    if (statusEl && checkBtn && downloadBtn) {
      checkBtn.addEventListener('click', () => void checkApkUpdate(statusEl, checkBtn, downloadBtn));
      downloadBtn.addEventListener('click', () => {
        window.location.href = downloadBtn.dataset.updateUrl || GITHUB_RELEASES_PAGE;
      });
    }

    const authMethod = user.googleId ? 'Google Identity' : user.email ? `Email (${user.email})` : 'Thiết bị tin cậy';
    const securityRow = createListRow({
      title: 'Bảo mật & Thiết bị tin cậy',
      subtitle: `Đang xác thực qua: ${authMethod}`,
      leadingIcon: 'shield',
    });

    const installGuideRow = createListRow({
      title: 'Hướng dẫn thêm vào Màn hình chính',
      subtitle: 'Cài đặt biểu tượng PWA nhanh trên iPhone & Android',
      leadingIcon: 'install',
      chevron: true,
      onClick: () => navigate('/install'),
    });

    const logoutRow = createListRow({
      title: 'Đăng xuất khỏi thiết bị này',
      subtitle: 'Xoá phiên đăng nhập cục bộ, giữ nguyên dữ liệu trên máy chủ',
      leadingIcon: 'logout',
      onClick: () => {
        showModal({
          title: 'Đăng xuất tài khoản',
          content: 'Bạn muốn đăng xuất khỏi thiết bị này? Lần sau bạn có thể đăng nhập lại bằng Email, Google hoặc Couple Code.',
          confirmText: 'Đăng xuất',
          cancelText: 'Huỷ',
          danger: true,
          center: true,
          onConfirm: () => {
            clearPrivateClientState();
            navigate('/onboarding');
          },
        });
      },
    });

    settingsContainer.appendChild(
      buildSection('Ứng dụng & Bảo mật', apkCard, createListGroup([securityRow, installGuideRow, logoutRow])),
    );
  }

  function showEditProfileModal(user: User, couple: Couple): void {
    const form = document.createElement('div');
    form.style.cssText = 'display:flex;flex-direction:column;gap:12px;width:100%;text-align:left;';

    const originalDate = couple.loveStartDate ? new Date(couple.loveStartDate) : new Date();
    const dateString = originalDate.toISOString().substring(0, 10);

    form.innerHTML = `
      <div>
        <label class="c-field__label" for="edit-my-name">Tên hiển thị của bạn</label>
        <input type="text" id="edit-my-name" class="c-input" value="${user.displayName || ''}" style="margin-top:4px;" required />
      </div>
      <div>
        <label class="c-field__label" for="edit-partner-name">Tên người thương</label>
        <input type="text" id="edit-partner-name" class="c-input" value="${user.partnerName || ''}" style="margin-top:4px;" required />
      </div>
      <div>
        <label class="c-field__label" for="edit-love-date">Ngày bắt đầu yêu</label>
        <input type="date" id="edit-love-date" class="c-input" value="${dateString}" style="margin-top:4px;" required />
      </div>
    `;

    showModal({
      title: 'Chỉnh sửa thông tin',
      content: form,
      confirmText: 'Lưu thay đổi',
      cancelText: 'Huỷ',
      center: true,
      onConfirm: async () => {
        const displayName = (form.querySelector('#edit-my-name') as HTMLInputElement).value.trim();
        const partnerName = (form.querySelector('#edit-partner-name') as HTMLInputElement).value.trim();
        const loveStartDate = (form.querySelector('#edit-love-date') as HTMLInputElement).value;
        if (!displayName || !partnerName || !loveStartDate) {
          showToast('Vui lòng điền đầy đủ thông tin!', 'error');
          throw new Error('Fields missing');
        }
        await updateProfile({ displayName, partnerName, loveStartDate });
        showToast('Đã lưu thông tin cặp đôi!', 'success');
        void loadProfile();
      },
    });
  }

  void loadProfile();
  return root;
}
