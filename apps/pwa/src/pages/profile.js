import { navigate } from '../router';
import { store } from '../store/index';
import { updateProfile, uploadAvatar, uploadPartnerAvatar } from '../api/profile';
import { getMe } from '../api/auth';
import { createNav } from '../components/nav';
import { showToast } from '../components/toast';
import { showModal } from '../components/modal';
import { openCamera, openGallery } from '../components/camera';
function calcDaysTogether(loveStartDate) {
    if (!loveStartDate)
        return 0;
    const start = new Date(loveStartDate);
    const diff = Date.now() - start.getTime();
    return Math.max(0, Math.floor(diff / 86400000));
}
export function renderProfilePage() {
    const root = document.createElement('div');
    root.className = 'page profile-page animate-fade-in';
    root.style.cssText = `
    padding: 24px 16px 100px 16px;
    max-width: 480px;
    margin: 0 auto;
    min-height: 100vh;
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
        profileCard.innerHTML = `<div class="spinner" style="width:28px;height:28px;margin:16px 0;"></div>`;
        try {
            const res = await getMe();
            // Update local store
            store.set({
                user: res.user,
                couple: res.couple
            });
            renderProfileCard(res);
            renderSettings(res);
        }
        catch (err) {
            showToast('Không thể tải thông tin profile: ' + err.message, 'error');
        }
    }
    function renderProfileCard(data) {
        const user = data.user;
        const couple = data.couple;
        const partner = data.partnerUser;
        const days = calcDaysTogether(couple.loveStartDate);
        const myAvatar = user.avatarUrl ? `<img src="${user.avatarUrl}" style="width:100%;height:100%;object-fit:cover;" />` : '👤';
        const partnerAvatar = user.partnerAvatarUrl ? `<img src="${user.partnerAvatarUrl}" style="width:100%;height:100%;object-fit:cover;" />` : '💖';
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
      
      <div style="text-align:center;">
        <h2 style="font-size:18px;font-weight:700;">
          ${user.displayName} & ${user.partnerName}
        </h2>
        <div class="streak-banner" style="margin-top:8px;">
          🔥 ${couple.streak || 0} ngày streak
        </div>
      </div>

      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;border-top:1px solid var(--border);width:100%;padding-top:16px;">
        <span style="font-size:32px;font-weight:800;color:var(--accent);">${days}</span>
        <span style="font-size:13px;font-weight:600;color:var(--text-secondary);">ngày bên nhau 💕</span>
        <span style="font-size:11px;color:var(--text-secondary);margin-top:2px;">Bắt đầu từ: ${new Date(couple.loveStartDate).toLocaleDateString('vi-VN')}</span>
      </div>

      <div style="
        background:var(--surface-solid);
        border:1px solid var(--border);
        border-radius:12px;
        padding:10px 14px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        width:100%;
        font-size:13px;
        cursor:pointer;
      " id="copy-code-container">
        <span style="color:var(--text-secondary);">Couple Code:</span>
        <strong style="color:var(--accent);font-family:monospace;font-size:15px;letter-spacing:1px;">${couple.code}</strong>
        <span style="font-size:11px;color:var(--text-secondary);background:var(--border);padding:2px 6px;border-radius:4px;">Sao chép</span>
      </div>
    `;
        // Click to copy code
        profileCard.querySelector('#copy-code-container')?.addEventListener('click', () => {
            navigator.clipboard.writeText(couple.code);
            showToast('Đã sao chép couple code!', 'success');
        });
        // Avatar Upload Triggers
        profileCard.querySelector('#my-avatar-container')?.addEventListener('click', () => {
            promptAvatarUpload('my');
        });
        profileCard.querySelector('#partner-avatar-container')?.addEventListener('click', () => {
            promptAvatarUpload('partner');
        });
    }
    function promptAvatarUpload(type) {
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
        const handleAvatarResult = async (res) => {
            showToast('Đang tải ảnh lên...', 'info');
            try {
                if (type === 'my') {
                    await uploadAvatar(res.file);
                }
                else {
                    await uploadPartnerAvatar(res.file);
                }
                showToast('Cập nhật avatar thành công!', 'success');
                loadProfile();
            }
            catch (err) {
                showToast('Lỗi tải ảnh lên: ' + err.message, 'error');
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
    function renderSettings(data) {
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
            showEditProfileModal(user, couple);
        });
        settingsContainer.appendChild(editRow);
        // 2. Theme Toggle Row
        const themeRow = document.createElement('div');
        themeRow.className = 'card-solid';
        themeRow.style.cssText = 'padding:16px;display:flex;justify-content:between;align-items:center;';
        const state = store.get();
        const curTheme = state.theme || 'system';
        themeRow.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:20px;">🎨</span>
        <div style="display:flex;flex-direction:column;">
          <span style="font-size:14px;font-weight:600;">Giao diện (Theme)</span>
          <span style="font-size:11px;color:var(--text-secondary);">Chọn Light, Dark hoặc tự động</span>
        </div>
      </div>
      <select id="theme-select" style="
        background:var(--bg);
        border:1px solid var(--border);
        padding:6px 12px;
        border-radius:8px;
        font-size:13px;
        font-weight:600;
        color:var(--text-primary);
        outline:none;
      ">
        <option value="light" ${curTheme === 'light' ? 'selected' : ''}>Sáng</option>
        <option value="dark" ${curTheme === 'dark' ? 'selected' : ''}>Tối</option>
        <option value="system" ${curTheme === 'system' ? 'selected' : ''}>Hệ thống</option>
      </select>
    `;
        themeRow.querySelector('#theme-select')?.addEventListener('change', (e) => {
            const selected = e.target.value;
            store.set({ theme: selected });
            // Trigger apply theme
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const useDark = selected === 'dark' || (selected === 'system' && prefersDark);
            document.documentElement.setAttribute('data-theme', useDark ? 'dark' : 'light');
            showToast('Đã đổi giao diện thành công!', 'success');
        });
        settingsContainer.appendChild(themeRow);
        // 3. Logout Row
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
                    store.clear();
                    navigate('/onboarding');
                }
            });
        });
        settingsContainer.appendChild(logoutRow);
    }
    function showEditProfileModal(user, couple) {
        const form = document.createElement('div');
        form.style.cssText = 'display:flex;flex-direction:column;gap:14px;width:100%;text-align:left;';
        // Format loveStartDate to YYYY-MM-DD for date input
        const originalDate = new Date(couple.loveStartDate);
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
                const displayName = form.querySelector('#edit-my-name').value.trim();
                const partnerName = form.querySelector('#edit-partner-name').value.trim();
                const loveStartDate = form.querySelector('#edit-love-date').value;
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
                }
                catch (err) {
                    showToast('Lỗi cập nhật: ' + err.message, 'error');
                    throw err;
                }
            }
        });
    }
    loadProfile();
    // Inject Nav
    root.appendChild(createNav('/app/profile'));
    return root;
}
