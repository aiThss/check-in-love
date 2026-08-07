import type { CheckInReply } from '../api/types';

export interface ReplyToggleView {
  toggle: HTMLButtonElement;
  panel: HTMLDivElement;
  sync: () => void;
  open: () => void;
}

export function getReplyPagePath(checkinId: string): string {
  return `/app/replies?checkinId=${encodeURIComponent(checkinId)}`;
}

export function createReplyToggle(
  getReplies: () => CheckInReply[],
  onOpen: () => void,
  emptyLabel = 'Trả lời',
  onEmptyClick: () => void = onOpen,
): ReplyToggleView {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'reply-toggle-button reply-button';
  toggle.setAttribute('aria-expanded', 'false');

  // Kept as a hidden compatibility node for existing card layouts. Replies now
  // render on the dedicated reply page instead of under the source card.
  const panel = document.createElement('div');
  panel.className = 'reply-preview-list reply-toggle-panel';
  panel.hidden = true;

  const sync = () => {
    const replies = getReplies();
    toggle.textContent = replies.length
      ? `💬 Xem phản hồi (${replies.length})`
      : `💬 ${emptyLabel}`;
    toggle.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
    panel.replaceChildren();

    replies.slice(-2).forEach((reply) => {
      const item = document.createElement('div');
      item.className = `reply-preview${reply.isOwn ? ' own' : ''}`;

      const name = document.createElement('strong');
      name.textContent = reply.userName;
      const message = document.createElement('span');
      message.textContent = reply.message;

      item.append(name, message);
      panel.appendChild(item);
    });
  };

  const open = () => {
    sync();
  };

  toggle.addEventListener('click', () => {
    if (getReplies().length === 0) {
      onEmptyClick();
      return;
    }
    onOpen();
  });

  sync();
  return { toggle, panel, sync, open };
}
