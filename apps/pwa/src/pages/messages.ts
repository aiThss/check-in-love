import { createCheckin, getCheckins } from '../api/checkins';
import { createNav } from '../components/nav';
import { openCamera, processImage, revokePreviewUrl } from '../components/camera';
import { showToast } from '../components/toast';
import type { CheckIn } from '../api/types';

const MESSAGE_START_KEY = 'lovecheck_messages_started_at_v2';

function escapeHtml(value: string | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function getLatestActivityTime(item: CheckIn): number {
  const replyTimes = (item.replies ?? []).map((reply) => new Date(reply.createdAt).getTime());
  return Math.max(new Date(item.createdAt).getTime(), ...replyTimes);
}

export function renderMessagesPage(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page messages-page animate-fade-in';

  // Android WebView + adjustResize can leave 100dvh stuck at the keyboard-sized
  // viewport. Use the largest visual viewport measured by keyboard.ts instead.
  if (document.documentElement.classList.contains('android-wrapper')) {
    const stableViewportHeight = 'var(--app-viewport-height, 100vh)';
    page.style.minHeight = stableViewportHeight;
    page.style.height = stableViewportHeight;
    page.style.maxHeight = stableViewportHeight;
  }

  page.innerHTML = `
    <header class="messages-header">
      <div>
        <span class="messages-eyebrow">Hai đứa mình</span>
        <h1>Tin nhắn</h1>
      </div>
    </header>
    <main class="messages-thread" aria-live="polite"></main>
    <form class="messages-composer">
      <input id="message-photo" type="file" accept="image/*" hidden />
      <button class="messages-photo-button" type="button" aria-label="Mở tùy chọn đính kèm">+</button>
      <div class="messages-attach-menu" hidden>
        <button type="button" data-attach="gallery">Chọn ảnh</button>
        <button type="button" data-attach="camera">Chụp check-in</button>
      </div>
      <div class="messages-input-wrap">
        <span class="messages-photo-preview" hidden>Ảnh đã chọn</span>
        <input id="message-input" maxlength="280" placeholder="Gửi tin nhắn..." aria-label="Nội dung tin nhắn" />
      </div>
      <button class="messages-send" type="submit" aria-label="Gửi tin nhắn">↑</button>
    </form>
  `;

  const thread = page.querySelector<HTMLElement>('.messages-thread')!;
  const form = page.querySelector<HTMLFormElement>('.messages-composer')!;
  const messageInput = page.querySelector<HTMLInputElement>('#message-input')!;
  const photoInput = page.querySelector<HTMLInputElement>('#message-photo')!;
  const photoButton = page.querySelector<HTMLButtonElement>('.messages-photo-button')!;
  const attachMenu = page.querySelector<HTMLElement>('.messages-attach-menu')!;
  const preview = page.querySelector<HTMLElement>('.messages-photo-preview')!;
  const sendButton = page.querySelector<HTMLButtonElement>('.messages-send')!;
  let selectedPhoto: File | null = null;
  let previewUrl: string | null = null;
  const messageStartedAt = localStorage.getItem(MESSAGE_START_KEY) ?? new Date().toISOString();
  localStorage.setItem(MESSAGE_START_KEY, messageStartedAt);

  function renderCheckin(item: CheckIn): HTMLElement {
    if (!item.photoUrl) {
      const message = document.createElement('article');
      message.className = `chat-text-message${item.isOwn ? ' own' : ''}`;
      message.innerHTML = `
        <div class="chat-text-bubble"><p>${escapeHtml(item.caption)}</p></div>
        <time>${formatTime(item.createdAt)}</time>
      `;
      return message;
    }

    const group = document.createElement('section');
    group.className = 'chat-checkin-group';
    const hasPhoto = Boolean(item.photoUrl);
    const caption = escapeHtml(item.caption || (item.type === 'mood' ? 'Đang gửi một cảm xúc' : ''));
    group.innerHTML = `
      <article class="chat-checkin">
        <div class="chat-bubble${hasPhoto ? ' has-photo' : ''}">
          ${hasPhoto ? `<img src="${escapeHtml(item.photoUrl)}" alt="Ảnh check-in" loading="lazy" />` : ''}
          ${caption ? `<p>${caption}</p>` : ''}
        </div>
        <time>${formatTime(item.createdAt)}</time>
      </article>
    `;

    const replies = [...(item.replies ?? [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    replies.forEach((reply) => {
      const bubble = document.createElement('article');
      bubble.className = `chat-reply${reply.isOwn ? ' own' : ''}`;
      bubble.innerHTML = `
        <div class="chat-reply-bubble"><p>${escapeHtml(reply.message)}</p></div>
        <time>${formatTime(reply.createdAt)}</time>
      `;
      group.appendChild(bubble);
    });
    return group;
  }

  async function loadMessages(): Promise<void> {
    thread.innerHTML = '<div class="messages-loading skeleton"></div>';
    try {
      // Load a recent window when opening the tab; older photos stay in Memories.
      const response = await getCheckins(1, 50, messageStartedAt);
      const messages = response.data.sort(
        (a, b) => getLatestActivityTime(a) - getLatestActivityTime(b),
      );
      thread.innerHTML = '';

      if (messages.length === 0) {
        thread.innerHTML = '<p class="messages-empty">Gửi một điều nhỏ đầu tiên cho người ấy nhé.</p>';
        return;
      }

      let previousActivity = 0;
      const scrollToLatest = () => {
        requestAnimationFrame(() => {
          // Do not scroll while WebView is reporting a collapsed flex viewport.
          // Later image/timer callbacks will retry after layout has recovered.
          if (thread.clientHeight <= 1) return;

          const previousScrollBehavior = thread.style.scrollBehavior;
          thread.style.scrollBehavior = 'auto';
          thread.scrollTop = Math.max(0, thread.scrollHeight - thread.clientHeight);
          thread.style.scrollBehavior = previousScrollBehavior;
        });
      };

      messages.forEach((item) => {
        const message = renderCheckin(item);
        const activityTime = getLatestActivityTime(item);
        if (previousActivity > 0 && activityTime - previousActivity >= 20 * 60 * 1000) {
          message.classList.add('show-timestamp');
        }
        previousActivity = activityTime;
        message.addEventListener('click', () => message.classList.toggle('show-timestamp'));
        thread.appendChild(message);
      });
      thread.querySelectorAll('img').forEach((image) => {
        image.addEventListener('load', scrollToLatest, { once: true });
      });
      scrollToLatest();
      window.setTimeout(scrollToLatest, 150);
      window.setTimeout(scrollToLatest, 500);
    } catch {
      thread.innerHTML = '<p class="messages-empty">Chưa tải được tin nhắn. Hãy thử lại nhé.</p>';
    }
  }

  function clearSelectedPhoto(): void {
    selectedPhoto = null;
    revokePreviewUrl(previewUrl);
    previewUrl = null;
    preview.hidden = true;
    preview.textContent = '';
    photoInput.value = '';
  }

  photoButton.addEventListener('click', () => {
    attachMenu.hidden = !attachMenu.hidden;
  });
  attachMenu.querySelector('[data-attach="gallery"]')?.addEventListener('click', () => {
    attachMenu.hidden = true;
    photoInput.click();
  });
  attachMenu.querySelector('[data-attach="camera"]')?.addEventListener('click', () => {
    attachMenu.hidden = true;
    openCamera((result) => {
      void (async () => {
        try {
          const processed = await processImage(result.file, { aspectRatio: 1, maxSize: 1600, quality: 0.85 });
          revokePreviewUrl(result.preview);
          clearSelectedPhoto();
          selectedPhoto = processed.file;
          preview.textContent = 'Ảnh đã chọn';
          preview.hidden = false;
        } catch {
          showToast('Không xử lý được ảnh này', 'error');
        }
      })();
    });
  });
  photoInput.addEventListener('change', async () => {
    const source = photoInput.files?.[0];
    if (!source) return;

    try {
      photoButton.disabled = true;
      const processed = await processImage(source, { aspectRatio: 1, maxSize: 1600, quality: 0.85 });
      clearSelectedPhoto();
      selectedPhoto = processed.file;
      previewUrl = processed.preview;
      preview.textContent = 'Ảnh đã chọn';
      preview.hidden = false;
    } catch {
      showToast('Không xử lý được ảnh này, thử ảnh khác nhé', 'error');
    } finally {
      photoButton.disabled = false;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = messageInput.value.trim();
    if (!message && !selectedPhoto) return;

    try {
      sendButton.disabled = true;
      if (selectedPhoto) {
        const formData = new FormData();
        formData.append('type', 'photo');
        formData.append('file', selectedPhoto, selectedPhoto.name || 'message-photo.jpg');
        if (message) formData.append('caption', message);
        await createCheckin(formData);
      } else {
        await createCheckin({ type: 'text', caption: message });
      }
      messageInput.value = '';
      clearSelectedPhoto();
      await loadMessages();
    } catch {
      showToast('Không gửi được tin nhắn, thử lại nhé', 'error');
    } finally {
      sendButton.disabled = false;
    }
  });

  page.appendChild(createNav('/app/messages'));
  void loadMessages();
  return page;
}
