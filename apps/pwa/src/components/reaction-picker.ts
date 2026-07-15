import { addReaction } from '../api/checkins';
import { closeModal, showModal } from './modal';
import { showToast } from './toast';
import type { CheckIn, ReactionType } from '../api/types';

const REACTIONS: ReactionType[] = ['❤️', '🥰', '😘', '😂', '😭', '🔥', '💛', '👏'];

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function reactionPillsHtml(checkin: CheckIn): string {
  return checkin.reactions
    .filter((reaction) => reaction.count > 0)
    .slice(0, 5)
    .map((reaction) => `<span class="reaction-pill${reaction.reactedByMe ? ' selected' : ''}">${escapeHtml(reaction.type)}<strong>${reaction.count}</strong></span>`)
    .join('');
}

export function openReactionPicker(checkin: CheckIn, onUpdated?: () => void): void {
  const content = document.createElement('div');
  content.className = 'choice-reaction-picker';

  REACTIONS.forEach((type) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = type;
    button.setAttribute('aria-label', `Thả ${type}`);
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        checkin.reactions = await addReaction(checkin.id, type);
        closeModal();
        onUpdated?.();
      } catch {
        button.disabled = false;
        showToast('Không gửi được cảm xúc, thử lại nhé', 'error');
      }
    });
    content.appendChild(button);
  });

  showModal({ title: 'Thả cảm xúc', content, center: true });
}
