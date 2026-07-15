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

export function isEmojiOnlyReaction(value: string): boolean {
  const compact = value.replace(/\s/g, '');
  return compact.length > 0 && [...compact].every((character) => (
    /\p{Extended_Pictographic}/u.test(character)
    || /\p{Emoji_Component}/u.test(character)
    || character === '\u200D'
    || character === '\uFE0F'
  ));
}

export function openReactionPicker(checkin: CheckIn, onUpdated?: () => void): void {
  const content = document.createElement('div');
  content.className = 'choice-reaction-picker';

  const submitReaction = async (type: string): Promise<void> => {
    checkin.reactions = await addReaction(checkin.id, type);
    closeModal();
    onUpdated?.();
  };

  REACTIONS.forEach((type) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = type;
    button.setAttribute('aria-label', `Thả ${type}`);
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await submitReaction(type);
      } catch {
        button.disabled = false;
        showToast('Không gửi được cảm xúc, thử lại nhé', 'error');
      }
    });
    content.appendChild(button);
  });

  const custom = document.createElement('form');
  custom.className = 'choice-reaction-custom';
  custom.innerHTML = `
    <input maxlength="32" placeholder="React tùy chọn" aria-label="React tùy chọn" />
    <button type="submit">Gửi</button>
  `;
  custom.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = custom.querySelector<HTMLInputElement>('input');
    const value = input?.value.trim();
    if (!value) return;
    try {
      await submitReaction(value);
    } catch {
      showToast('Không gửi được cảm xúc, thử lại nhé', 'error');
    }
  });
  content.appendChild(custom);

  showModal({ title: 'Thả cảm xúc', content, center: true });
}
