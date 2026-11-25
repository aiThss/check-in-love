import '../styles/20-pages/secondary.css';
import { navigate } from '../router';
import { getCheckins } from '../api/checkins';
import { createMessage } from '../api/messages';
import { showToast } from '../components/toast';
import { store } from '../store/index';
import { iconMarkup } from '../ui/icons/icons';
import { createIconButton } from '../ui/primitives';
import { createEmptyState, createSkeleton } from '../ui/feedback';
import { triggerHaptic } from '../ui/haptics';
import type { CheckIn, CheckInReply } from '../api/types';

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
    empty.className = 'reply-page-empty u-text-secondary';
    empty.style.cssText = 'text-align:center;padding:24px 0;font-size:13px;';
    empty.textContent = 'Chưa có phản hồi nào. Hãy viết dòng đầu tiên cho khoảnh khắc này nhé.';
    container.appendChild(empty);
    return;
  }

  replies.forEach((reply) => {
    const item = document.createElement('article');
    item.className = `reply-page-item p-reply-bubble${reply.isOwn ? ' own' : ''}`;
    item.innerHTML = `
      <div class="reply-page-item-head" style="display:flex;justify-content:space-between;gap:12px;font-size:11px;opacity:0.82;margin-bottom:2px;">
        <strong>${escapeHtml(reply.userName)}</strong>
        <time>${formatTime(reply.createdAt)}</time>
      </div>
      <p style="margin:0;font-size:14px;line-height:1.45;">${escapeHtml(reply.message)}</p>
    `;
    container.appendChild(item);
  });
}

function renderMissingState(content: HTMLElement, message: string): void {
  content.replaceChildren(
    createEmptyState({
      illustration: 'messages',
      title: 'Không tìm thấy khoảnh khắc',
      description: message,
      action: {
        label: 'Về Kỷ niệm',
        variant: 'primary',
        pill: true,
        leadingIcon: 'memories',
        onClick: () => navigate('/app/memories'),
      },
    }),
  );
}

function renderReplyThread(content: HTMLElement, checkin: CheckIn): void {
  const photo = checkin.photoUrl
    ? `<img class="reply-page-photo p-reply-source__photo" src="${escapeHtml(checkin.photoUrl)}" alt="Ảnh check-in" loading="eager" />`
    : '';

  content.innerHTML = `
    <article class="reply-page-card p-reply-source u-grain-surface">
      ${photo}
      <div class="reply-page-card-copy p-reply-source__copy">
        <span class="p-sec-header__eyebrow">${escapeHtml(checkin.ownerName)}</span>
        <h2>${escapeHtml(checkin.caption || 'Khoảnh khắc đã lưu')}</h2>
        <time class="u-text-secondary" style="font-size:11px;">${formatTime(checkin.createdAt)}</time>
      </div>
    </article>
    <section class="reply-page-thread" aria-labelledby="reply-page-title" style="display:flex;flex-direction:column;gap:12px;margin-top:16px;">
      <div style="display:flex;align-items:baseline;justify-content:space-between;">
        <h2 id="reply-page-title" style="font-family:var(--font-display);font-size:18px;">Trò chuyện (<span class="reply-page-count">${checkin.replies.length}</span>)</h2>
        <span class="u-text-secondary" style="font-size:11px;">Đồng bộ sang Tin nhắn</span>
      </div>
      <div class="reply-page-list p-reply-list"></div>
      <form class="reply-page-form p-reply-composer" autocomplete="off">
        <input
          type="text"
          name="reply_text_input"
          maxlength="500"
          aria-label="Viết phản hồi"
          placeholder="Nhắn đôi lời về khoảnh khắc này..."
          autocomplete="off"
          autocorrect="off"
          autocapitalize="sentences"
          spellcheck="false"
          data-lpignore="true"
          data-form-type="other"
          data-1p-ignore="true"
        />
        <button type="submit" class="c-icon-btn c-icon-btn--accent" aria-label="Gửi phản hồi">
          ${iconMarkup('send', { size: 16 })}
        </button>
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
      triggerHaptic('tap');
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
  root.className = 'page replies-page p-secondary animate-fade-in';

  const header = document.createElement('header');
  header.className = 'reply-page-header p-sec-header';
  const backBtn = createIconButton({
    icon: 'back',
    ariaLabel: 'Quay lại',
    className: 'reply-page-back',
    onClick: () => navigate('/app/memories'),
  });
  const headCopy = document.createElement('div');
  headCopy.innerHTML = `
    <span class="p-sec-header__eyebrow">Kỷ niệm</span>
    <h1 class="p-sec-header__title">Phản hồi khoảnh khắc</h1>
  `;
  header.append(backBtn, headCopy);
  root.appendChild(header);

  const content = document.createElement('main');
  content.className = 'reply-page-content';
  content.appendChild(createSkeleton({ height: '96px' }));
  root.appendChild(content);

  const checkinId = new URLSearchParams(window.location.search).get('checkinId');
  if (!checkinId) {
    renderMissingState(content, 'Liên kết phản hồi không hợp lệ.');
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
