import { navigate } from '../router';
import { getCheckins } from '../api/checkins';
import { createMessage } from '../api/messages';
import type { CheckIn, CheckInReply } from '../api/types';
import { showToast } from '../components/toast';
import { store } from '../store/index';

function escapeHtml(value: string | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderReplyList(container: HTMLElement, replies: CheckInReply[]): void {
  container.replaceChildren();

  if (replies.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'reply-page-empty';
    empty.textContent = 'Chưa có phản hồi. Viết điều đầu tiên nhé 💕';
    container.appendChild(empty);
    return;
  }

  replies.forEach((reply) => {
    const item = document.createElement('article');
    item.className = `reply-page-item${reply.isOwn ? ' own' : ''}`;
    item.innerHTML = `
      <div class="reply-page-item-head">
        <strong>${escapeHtml(reply.userName)}</strong>
        <time>${formatTime(reply.createdAt)}</time>
      </div>
      <p>${escapeHtml(reply.message)}</p>
    `;
    container.appendChild(item);
  });
}

function renderMissingState(content: HTMLElement, message: string): void {
  content.innerHTML = `
    <div class="reply-page-empty-state">
      <div class="reply-page-empty-icon">💬</div>
      <h2>Không tìm thấy khoảnh khắc</h2>
      <p>${escapeHtml(message)}</p>
      <button type="button" class="btn-primary" data-back-to-memories>Về Kỷ niệm</button>
    </div>
  `;
  content.querySelector<HTMLButtonElement>('[data-back-to-memories]')?.addEventListener('click', () => {
    navigate('/app/memories');
  });
}

function renderReplyThread(content: HTMLElement, checkin: CheckIn): void {
  const photo = checkin.photoUrl
    ? `<img class="reply-page-photo" src="${escapeHtml(checkin.photoUrl)}" alt="Ảnh check-in" loading="eager" />`
    : '';

  content.innerHTML = `
    <article class="reply-page-card">
      ${photo}
      <div class="reply-page-card-copy">
        <span class="reply-page-owner">${escapeHtml(checkin.ownerName)}</span>
        <h2>${escapeHtml(checkin.caption || 'Một khoảnh khắc đáng yêu')}</h2>
        <time>${formatTime(checkin.createdAt)}</time>
      </div>
    </article>
    <section class="reply-page-thread" aria-labelledby="reply-page-title">
      <div class="reply-page-thread-heading">
        <div>
          <span class="reply-page-eyebrow">Phản hồi</span>
          <h1 id="reply-page-title">Xem phản hồi <span class="reply-page-count">${checkin.replies.length}</span></h1>
        </div>
        <span class="reply-page-thread-hint">Nhắn như Messenger</span>
      </div>
      <div class="reply-page-list"></div>
      <form class="reply-page-form">
        <input maxlength="500" aria-label="Viết phản hồi" placeholder="Viết phản hồi..." />
        <button type="submit" aria-label="Gửi phản hồi">↑</button>
      </form>
    </section>
  `;

  const list = content.querySelector<HTMLElement>('.reply-page-list');
  const count = content.querySelector<HTMLElement>('.reply-page-count');
  const form = content.querySelector<HTMLFormElement>('.reply-page-form');
  const input = form?.querySelector<HTMLInputElement>('input');
  const submit = form?.querySelector<HTMLButtonElement>('button');
  if (list) renderReplyList(list, checkin.replies);

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = input?.value.trim() ?? '';
    if (!message || submit?.disabled) return;
    if (submit) submit.disabled = true;

    try {
      await createMessage({
        type: 'text',
        text: message,
        referencedCheckinId: checkin.id,
        clientMutationId: crypto.randomUUID?.() ?? String(Date.now()),
      });
      const user = store.get().user;
      checkin.replies = [
        ...checkin.replies,
        {
          userId: user?.id ?? 'me',
          userName: user?.displayName ?? 'Bạn',
          message,
          isOwn: true,
          createdAt: new Date().toISOString(),
        },
      ];
      if (list) renderReplyList(list, checkin.replies);
      if (count) count.textContent = String(checkin.replies.length);
      if (input) input.value = '';
      showToast('Đã gửi phản hồi vào Tin nhắn', 'success');
    } catch {
      showToast('Không gửi được phản hồi', 'error');
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}

export function renderRepliesPage(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page replies-page animate-fade-in';
  root.innerHTML = `
    <header class="reply-page-header">
      <button type="button" class="reply-page-back" aria-label="Quay lại">←</button>
      <div>
        <span class="reply-page-eyebrow">Kỷ niệm</span>
        <h1>Phản hồi</h1>
      </div>
    </header>
    <main class="reply-page-content">
      <div class="reply-page-loading">Đang tải phản hồi...</div>
    </main>
  `;

  root.querySelector<HTMLButtonElement>('.reply-page-back')?.addEventListener('click', () => {
    navigate('/app/memories');
  });

  const content = root.querySelector<HTMLElement>('.reply-page-content');
  const checkinId = new URLSearchParams(window.location.search).get('checkinId');
  if (!content || !checkinId) {
    if (content) renderMissingState(content, 'Liên kết phản hồi không hợp lệ.');
    return root;
  }

  void getCheckins(1, 100)
    .then((response) => {
      const checkin = response.data.find((item) => item.id === checkinId);
      if (checkin) renderReplyThread(content, checkin);
      else renderMissingState(content, 'Khoảnh khắc này không còn trong danh sách.');
    })
    .catch(() => renderMissingState(content, 'Chưa tải được dữ liệu, hãy thử lại.'));

  return root;
}
