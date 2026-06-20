import { navigate } from '../router';
import { createCheckin } from '../api/checkins';
import { store } from '../store/index';
import { createNav } from '../components/nav';
import { showToast } from '../components/toast';
import { openCamera, openGallery } from '../components/camera';
import type { CheckIn } from '../api/types';

const MOODS = [
  { value: 'happy', emoji: '😊', label: 'Vui vẻ' },
  { value: 'love', emoji: '🥰', label: 'Đang yêu' },
  { value: 'sad', emoji: '😢', label: 'Buồn' },
  { value: 'excited', emoji: '🤩', label: 'Hào hứng' },
  { value: 'tired', emoji: '😴', label: 'Mệt mỏi' },
  { value: 'calm', emoji: '😌', label: 'Bình yên' },
  { value: 'miss', emoji: '🥺', label: 'Nhớ nhung' }
];

const QUICK_MESSAGES = [
  'Đang nhớ người ấy ghê 💕',
  'Đang ăn nè, thèm quá 🍲',
  'Đang học/làm việc chăm chỉ ✍️',
  'Hôm nay mệt xỉu luôn 😴',
  'Cần ôm một cái thật chặt 🫂',
  'Đang đi chơi nè 🌸',
  'Có tin vui muốn khoe 🎉'
];

export function renderCheckinPage(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page checkin-page animate-fade-in';
  root.style.cssText = `
    padding: calc(var(--safe-top) + 16px) 16px calc(170px + var(--safe-bottom)) 16px;
    display: flex;
    flex-direction: column;
    gap: clamp(10px, 2vh, 16px);
    margin: 0 auto;
    width: 100%;
    max-width: min(480px, 100%);
    box-sizing: border-box;
    min-height: 100dvh;
    overflow-x: hidden;
    overflow-y: auto;
  `;

  // Header with back button
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:0;min-width:0;';
  header.innerHTML = `
    <button id="back-btn" class="btn-icon" style="border-radius:50%;width:44px;height:44px;">←</button>
    <div>
      <h1 style="font-size:20px;font-weight:700;letter-spacing:-0.02em;">Gửi khoảnh khắc</h1>
      <p style="font-size:13px;color:var(--text-secondary);">Chia sẻ hiện tại của bạn với người ấy</p>
    </div>
  `;
  root.appendChild(header);

  const backButton = header.querySelector<HTMLButtonElement>('#back-btn');
  if (backButton) {
    backButton.style.width = '40px';
    backButton.style.height = '40px';
    backButton.style.flexShrink = '0';
  }

  const headerText = header.querySelector<HTMLElement>('div');
  if (headerText) {
    headerText.style.minWidth = '0';
    const subtitle = headerText.querySelector<HTMLElement>('p');
    if (subtitle) {
      subtitle.style.fontSize = '12px';
      subtitle.style.lineHeight = '1.35';
    }
  }

  header.querySelector('#back-btn')?.addEventListener('click', () => {
    navigate('/app/home');
  });

  // Type Selector Tab
  const tabsWrapper = document.createElement('div');
  tabsWrapper.style.cssText = `
    display: flex;
    background: var(--surface-solid);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    padding: 4px;
    gap: 4px;
    width:100%;
    max-width:100%;
    overflow:hidden;
  `;
  
  const modes = [
    { id: 'photo', label: '📸 Ảnh' },
    { id: 'text', label: '✍️ Tin nhắn' },
    { id: 'mood', label: '😊 Cảm xúc' }
  ];

  let activeMode = 'photo';

  modes.forEach(mode => {
    const tab = document.createElement('button');
    tab.className = `tab-btn ${mode.id === activeMode ? 'active' : ''}`;
    tab.style.cssText = `
      flex: 1;
      min-width:0;
      padding: 8px 6px;
      font-size: clamp(12px, 3.4vw, 14px);
      font-weight: 600;
      border-radius: var(--radius-pill);
      text-align: center;
      transition: all var(--duration-fast) var(--ease);
      color: ${mode.id === activeMode ? 'var(--accent)' : 'var(--text-secondary)'};
      background: ${mode.id === activeMode ? 'var(--bg)' : 'transparent'};
      box-shadow: ${mode.id === activeMode ? 'var(--shadow)' : 'none'};
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    `;
    tab.textContent = mode.label;
    tab.dataset.mode = mode.id;
    tabsWrapper.appendChild(tab);
  });
  root.appendChild(tabsWrapper);

  // Content Area
  const contentArea = document.createElement('div');
  contentArea.className = 'card';
  contentArea.style.cssText = 'padding: clamp(14px, 3.5vw, 18px); display: flex; flex-direction: column; gap: 12px; min-height: 0; width:100%; max-width:100%; overflow:hidden;';
  root.appendChild(contentArea);

  // Form State
  let selectedFile: File | null = null;
  let selectedPreviewUrl: string | null = null;
  let selectedMood: string | null = null;
  let selectedQuickMsg: string | null = null;

  function compactUploadPicker(picker: HTMLElement): void {
    const icon = picker.children[0] as HTMLElement | undefined;
    const copy = picker.children[1] as HTMLElement | undefined;
    const title = copy?.querySelector<HTMLElement>('p:first-child');
    const subtitle = copy?.querySelector<HTMLElement>('p:last-child');

    if (icon) {
      icon.style.fontSize = 'clamp(46px, 13vw, 56px)';
      icon.style.lineHeight = '1';
    }

    if (copy) {
      copy.style.maxWidth = '100%';
      copy.style.padding = '0 10px';
    }

    if (title) {
      title.style.fontSize = 'clamp(13px, 3.6vw, 15px)';
      title.style.lineHeight = '1.25';
    }

    if (subtitle) {
      subtitle.style.fontSize = '11px';
      subtitle.style.lineHeight = '1.25';
    }
  }

  function compactCaptionGroup(group: HTMLElement): void {
    group.querySelector('label')?.remove();
    group.style.gap = '0';

    const input = group.querySelector<HTMLInputElement>('#caption-input');
    if (input) {
      input.style.minHeight = '46px';
      input.style.padding = '12px 14px';
      input.style.fontSize = '14px';
      input.style.borderRadius = '16px';
    }
  }

  // Render content depending on activeMode
  function renderContentForm() {
    contentArea.innerHTML = '';

    if (activeMode === 'photo') {
      // Photo Picker Container
      const picker = document.createElement('div');
      picker.style.cssText = `
        border: 2px dashed var(--border);
        border-radius: 20px;
        height: clamp(188px, 28vh, 232px);
        min-height: 188px;
        max-height: 232px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        overflow: hidden;
        position: relative;
        background: var(--surface-solid);
        transition: border-color var(--duration-fast);
      `;

      if (selectedPreviewUrl) {
        picker.innerHTML = `
          <img src="${selectedPreviewUrl}" style="width:100%;height:100%;object-fit:cover;" />
          <button id="remove-photo" style="
            position:absolute;
            top:12px;
            right:12px;
            background:rgba(0,0,0,0.6);
            color:#fff;
            border-radius:50%;
            width:32px;
            height:32px;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:16px;
            font-weight:bold;
            border:none;
            backdrop-filter:blur(4px);
            z-index: 10;
          ">×</button>
        `;
        picker.querySelector('#remove-photo')?.addEventListener('click', (e) => {
          e.stopPropagation();
          selectedFile = null;
          selectedPreviewUrl = null;
          renderContentForm();
        });
      } else {
        picker.innerHTML = `
          <div style="font-size:44px;line-height:1;">📸</div>
          <div style="text-align:center;">
            <p style="font-size:15px;font-weight:600;color:var(--text-primary);">Chụp ảnh hoặc Chọn từ album</p>
            <p style="font-size:12px;color:var(--text-secondary);margin-top:2px;">Nhấn vào để tải hình ảnh lên</p>
          </div>
        `;
        compactUploadPicker(picker);
        picker.addEventListener('click', () => {
          // Show options: Camera or Gallery
          const modalContent = document.createElement('div');
          modalContent.style.cssText = 'display:flex;flex-direction:column;gap:12px;padding:8px 0;';
          modalContent.innerHTML = `
            <button id="opt-camera" class="btn-ghost" style="width:100%;padding:14px;font-weight:600;">📷 Chụp ảnh mới</button>
            <button id="opt-gallery" class="btn-ghost" style="width:100%;padding:14px;font-weight:600;">🖼️ Chọn từ thư viện</button>
          `;

          // Custom small bottom sheet or modal
          const overlay = document.createElement('div');
          overlay.className = 'modal-overlay';
          overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:flex-end;justify-content:center;z-index:1000;';
          
          const sheet = document.createElement('div');
          sheet.className = 'modal animate-slide-up';
          sheet.style.cssText = 'background:var(--bg);border-radius:24px 24px 0 0;padding:20px;width:100%;max-width:440px;box-shadow:var(--shadow-elevated);';
          sheet.innerHTML = `
            <div style="width:36px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 16px auto;"></div>
            <h3 style="font-size:16px;font-weight:700;text-align:center;margin-bottom:16px;">Chọn phương thức</h3>
            <div style="display:flex;flex-direction:column;gap:10px;">
              <button id="btn-camera" class="btn-primary" style="width:100%;padding:12px;">📷 Chụp ảnh mới</button>
              <button id="btn-gallery" class="btn-ghost" style="width:100%;padding:12px;">🖼️ Chọn ảnh có sẵn</button>
              <button id="btn-cancel-sheet" class="btn-ghost" style="width:100%;padding:12px;border:none;margin-top:4px;">Hủy bỏ</button>
            </div>
          `;
          overlay.appendChild(sheet);
          document.body.appendChild(overlay);

          const closeSheet = () => document.body.removeChild(overlay);

          sheet.querySelector('#btn-cancel-sheet')?.addEventListener('click', closeSheet);
          sheet.querySelector('#btn-camera')?.addEventListener('click', () => {
            closeSheet();
            openCamera((res) => {
              selectedFile = res.file;
              selectedPreviewUrl = res.preview;
              renderContentForm();
            });
          });
          sheet.querySelector('#btn-gallery')?.addEventListener('click', () => {
            closeSheet();
            openGallery((res) => {
              selectedFile = res.file;
              selectedPreviewUrl = res.preview;
              renderContentForm();
            });
          });
        });
      }
      contentArea.appendChild(picker);

      // Caption
      const capGroup = document.createElement('div');
      capGroup.className = 'input-group';
      capGroup.innerHTML = `
        <label class="input-label">Mô tả (Không bắt buộc)</label>
        <input type="text" id="caption-input" class="input" placeholder="Viết vài dòng ngọt ngào..." maxlength="280" />
      `;
      compactCaptionGroup(capGroup);
      contentArea.appendChild(capGroup);

      // Quick message selection
      const quickHeader = document.createElement('label');
      quickHeader.className = 'input-label';
      quickHeader.textContent = 'Chọn nhanh tin nhắn';
      quickHeader.style.marginBottom = '0';
      contentArea.appendChild(quickHeader);

      const chipsWrapper = document.createElement('div');
      chipsWrapper.style.cssText = 'display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;padding-bottom:4px;margin-top:-8px;max-width:100%;scrollbar-width:none;-webkit-overflow-scrolling:touch;';
      QUICK_MESSAGES.forEach(msg => {
        const chip = document.createElement('button');
        chip.className = `btn-ghost ${selectedQuickMsg === msg ? 'active' : ''}`;
        chip.style.cssText = `
          white-space:nowrap;
          flex-shrink:0;
          font-size:12px;
          padding:5px 10px;
          border-radius:12px;
          background: ${selectedQuickMsg === msg ? 'var(--accent-soft)' : 'var(--surface-solid)'};
          color: ${selectedQuickMsg === msg ? 'var(--accent)' : 'var(--text-primary)'};
          border-color: ${selectedQuickMsg === msg ? 'var(--accent)' : 'var(--border)'};
        `;
        chip.textContent = msg;
        chip.addEventListener('click', () => {
          if (selectedQuickMsg === msg) {
            selectedQuickMsg = null;
          } else {
            selectedQuickMsg = msg;
            const captionInput = contentArea.querySelector('#caption-input') as HTMLInputElement;
            if (captionInput) captionInput.value = msg;
          }
          renderContentFormOnlyChips();
        });
        chipsWrapper.appendChild(chip);
      });
      contentArea.appendChild(chipsWrapper);

      function renderContentFormOnlyChips() {
        // Just visual updates to chips
        const chips = chipsWrapper.querySelectorAll('button');
        chips.forEach((btn, idx) => {
          const msg = QUICK_MESSAGES[idx];
          const isSelected = selectedQuickMsg === msg;
          btn.style.background = isSelected ? 'var(--accent-soft)' : 'var(--surface-solid)';
          btn.style.color = isSelected ? 'var(--accent)' : 'var(--text-primary)';
          btn.style.borderColor = isSelected ? 'var(--accent)' : 'var(--border)';
        });
      }

    } else if (activeMode === 'text') {
      // Text Checkin
      const textGroup = document.createElement('div');
      textGroup.className = 'input-group';
      textGroup.style.flex = '1';
      textGroup.innerHTML = `
        <label class="input-label">Viết gì đó gửi người ấy</label>
        <textarea id="text-input" class="input" placeholder="Hôm nay của bạn thế nào? Kể cho người ấy nghe nhé..." maxlength="280" style="flex:1;min-height:140px;"></textarea>
      `;
      const textInput = textGroup.querySelector<HTMLTextAreaElement>('#text-input');
      if (textInput) {
        textInput.style.minHeight = '112px';
        textInput.style.lineHeight = '1.45';
      }
      contentArea.appendChild(textGroup);

      // Quick message selection
      const quickHeader = document.createElement('label');
      quickHeader.className = 'input-label';
      quickHeader.textContent = 'Gợi ý tin nhắn';
      quickHeader.style.marginBottom = '0';
      contentArea.appendChild(quickHeader);

      const chipsWrapper = document.createElement('div');
      chipsWrapper.style.cssText = 'display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;padding-bottom:4px;margin-top:-8px;max-width:100%;scrollbar-width:none;-webkit-overflow-scrolling:touch;';
      QUICK_MESSAGES.forEach(msg => {
        const chip = document.createElement('button');
        chip.style.cssText = `
          white-space:nowrap;
          flex-shrink:0;
          font-size:12px;
          padding:5px 10px;
          border-radius:12px;
          background: var(--surface-solid);
          border: 1px solid var(--border);
          color: var(--text-primary);
        `;
        chip.textContent = msg;
        chip.addEventListener('click', () => {
          const textarea = contentArea.querySelector('#text-input') as HTMLTextAreaElement;
          if (textarea) {
            textarea.value = msg;
            textarea.focus();
          }
        });
        chipsWrapper.appendChild(chip);
      });
      contentArea.appendChild(chipsWrapper);

    } else if (activeMode === 'mood') {
      // Mood Grid selection
      const label = document.createElement('label');
      label.className = 'input-label';
      label.textContent = 'Cảm xúc hiện tại của bạn';
      contentArea.appendChild(label);

      const grid = document.createElement('div');
      grid.className = 'mood-grid';
      grid.style.cssText = 'grid-template-columns:repeat(2, minmax(0, 1fr));gap:10px;width:100%;max-width:100%;';
      MOODS.forEach(mood => {
        const btn = document.createElement('button');
        btn.className = `mood-btn ${selectedMood === mood.value ? 'selected' : ''}`;
        btn.innerHTML = `
          <span class="mood-emoji">${mood.emoji}</span>
          <span class="mood-label">${mood.label}</span>
        `;
        btn.style.padding = '12px 8px';
        btn.style.minWidth = '0';
        btn.style.borderRadius = '18px';
        btn.querySelector<HTMLElement>('.mood-emoji')!.style.fontSize = 'clamp(34px, 10vw, 42px)';
        btn.querySelector<HTMLElement>('.mood-label')!.style.fontSize = '12px';
        btn.querySelector<HTMLElement>('.mood-label')!.style.lineHeight = '1.2';
        btn.addEventListener('click', () => {
          selectedMood = mood.value;
          // Re-render only mood buttons selection
          grid.querySelectorAll('.mood-btn').forEach((b, idx) => {
            const m = MOODS[idx];
            if (m.value === selectedMood) {
              b.classList.add('selected');
            } else {
              b.classList.remove('selected');
            }
          });
        });
        grid.appendChild(btn);
      });
      contentArea.appendChild(grid);

      // Extra Caption for mood
      const capGroup = document.createElement('div');
      capGroup.className = 'input-group';
      capGroup.innerHTML = `
        <label class="input-label">Lời nhắn kèm theo (Không bắt buộc)</label>
        <input type="text" id="caption-input" class="input" placeholder="Tại sao bạn cảm thấy vậy..." maxlength="280" />
      `;
      compactCaptionGroup(capGroup);
      contentArea.appendChild(capGroup);
    }
  }

  // Switch tab event handlers
  tabsWrapper.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.tab-btn') as HTMLButtonElement | null;
    if (!btn) return;
    const mode = btn.dataset.mode;
    if (!mode || mode === activeMode) return;

    activeMode = mode;
    tabsWrapper.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach(b => {
      const isAct = b.getAttribute('data-mode') === activeMode;
      b.style.color = isAct ? 'var(--accent)' : 'var(--text-secondary)';
      b.style.background = isAct ? 'var(--bg)' : 'transparent';
      b.style.boxShadow = isAct ? 'var(--shadow)' : 'none';
    });

    renderContentForm();
  });

  renderContentForm();

  // Send Button
  const sendBtn = document.createElement('button');
  sendBtn.className = 'btn-primary btn-primary-full';
  sendBtn.style.cssText = `
    position:fixed;
    left:50%;
    bottom:calc(92px + var(--safe-bottom));
    transform:translateX(-50%);
    z-index:90;
    width:min(448px, calc(100% - 32px));
    padding:16px;
    font-size:17px;
    font-weight:700;
    box-shadow:0 12px 32px var(--accent-glow);
  `;
  sendBtn.innerHTML = `Gửi ngay 💕`;
  root.appendChild(sendBtn);

  // Send Action handler
  sendBtn.addEventListener('click', async () => {
    let payload: FormData | Record<string, any>;
    
    if (activeMode === 'photo') {
      if (!selectedFile) {
        showToast('Vui lòng chọn hoặc chụp ảnh!', 'error');
        return;
      }
      const caption = (root.querySelector('#caption-input') as HTMLInputElement)?.value.trim();
      const fd = new FormData();
      fd.append('type', 'photo');
      fd.append('file', selectedFile);
      if (caption) {
        fd.append('caption', caption);
      }
      payload = fd;
    } else if (activeMode === 'text') {
      const text = (root.querySelector('#text-input') as HTMLTextAreaElement)?.value.trim();
      if (!text) {
        showToast('Nội dung tin nhắn không được để trống!', 'error');
        return;
      }
      payload = {
        type: 'text',
        caption: text
      };
    } else {
      // mood mode
      if (!selectedMood) {
        showToast('Vui lòng chọn cảm xúc của bạn!', 'error');
        return;
      }
      const caption = (root.querySelector('#caption-input') as HTMLInputElement)?.value.trim();
      payload = {
        type: 'mood',
        mood: selectedMood,
        caption: caption || undefined
      };
    }

    sendBtn.disabled = true;
    sendBtn.innerHTML = `<span class="spinner" style="width:20px;height:20px;border-width:2px;border-color:#fff transparent transparent transparent;"></span> Đang gửi...`;

    try {
      const result = await createCheckin(payload);
      if (typeof result.streak === 'number') {
        const current = store.get();
        if (current.couple) {
          store.set({ couple: { ...current.couple, streak: result.streak } });
        }
      }
      
      // Success Heart Burst animation
      showHeartBurstEffect();
      showToast('Gửi check-in thành công!', 'success');
      
      setTimeout(() => {
        navigate('/app/home');
      }, 1200);

    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Gửi check-in thất bại!', 'error');
      sendBtn.disabled = false;
      sendBtn.innerHTML = `Gửi ngay 💕`;
    }
  });

  // Helper for Heart Burst Effect
  function showHeartBurstEffect() {
    const burstContainer = document.createElement('div');
    burstContainer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;display:flex;align-items:center;justify-content:center;';
    document.body.appendChild(burstContainer);

    for (let i = 0; i < 24; i++) {
      const heart = document.createElement('div');
      heart.textContent = ['💖', '💕', '❤️', '🌸', '✨'][Math.floor(Math.random() * 5)];
      heart.style.cssText = `
        position: absolute;
        font-size: ${Math.floor(Math.random() * 24) + 16}px;
        opacity: 0;
        transform: translate(0, 0) scale(0.5);
        transition: all 1s cubic-bezier(0.1, 0.8, 0.3, 1);
      `;
      burstContainer.appendChild(heart);

      const angle = Math.random() * Math.PI * 2;
      const distance = Math.floor(Math.random() * 150) + 50;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;

      requestAnimationFrame(() => {
        heart.style.opacity = '1';
        heart.style.transform = `translate(${tx}px, ${ty}px) scale(1) rotate(${Math.floor(Math.random() * 180) - 90}deg)`;
        
        // fade out
        setTimeout(() => {
          heart.style.opacity = '0';
        }, 600);
      });
    }

    setTimeout(() => {
      document.body.removeChild(burstContainer);
    }, 1200);
  }

  // Inject Nav
  root.appendChild(createNav('/app/checkin'));

  return root;
}
