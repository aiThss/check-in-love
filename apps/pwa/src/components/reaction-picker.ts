import { addReaction } from '../api/checkins';
import { closeModal, showModal } from './modal';
import { showToast } from './toast';
import { iconMarkup } from '../ui/icons/icons';
import { BESPOKE_REACTIONS, renderReactionSymbolHtml } from '../ui/reactions';
import { triggerHaptic } from '../ui/haptics';
import type { CheckIn } from '../api/types';

export { BESPOKE_REACTIONS, MOOD_ICON_LOOKUP, renderReactionSymbolHtml } from '../ui/reactions';

export function reactionPillsHtml(checkin: CheckIn): string {
  return checkin.reactions
    .filter((reaction) => reaction.count > 0)
    .slice(0, 5)
    .map(
      (reaction) =>
        `<span class="reaction-pill${reaction.reactedByMe ? ' selected' : ''}">${renderReactionSymbolHtml(reaction.type, Boolean(reaction.reactedByMe))}<strong>${reaction.count}</strong></span>`,
    )
    .join('');
}

export function isEmojiOnlyReaction(value: string): boolean {
  const compact = value.replace(/\s/g, '');
  return (
    compact.length > 0
    && [...compact].every(
      (character) =>
        /\p{Extended_Pictographic}/u.test(character)
        || /\p{Emoji_Component}/u.test(character)
        || character === '\u200D'
        || character === '\uFE0F',
    )
  );
}

export function openReactionPicker(checkin: CheckIn, onUpdated?: () => void): void {
  const content = document.createElement('div');
  content.className = 'choice-reaction-picker c-reaction-modal-grid';

  const submitReaction = async (type: string): Promise<void> => {
    triggerHaptic('tap');
    checkin.reactions = await addReaction(checkin.id, type);
    closeModal();
    onUpdated?.();
  };

  BESPOKE_REACTIONS.forEach(({ type, icon: iconName, label }) => {
    const existing = checkin.reactions.find((r) => r.type === type);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `c-reaction-modal-btn${existing?.reactedByMe ? ' is-selected' : ''}`;
    button.setAttribute('aria-label', `Thả cảm xúc ${label}`);
    button.innerHTML = `${iconMarkup(iconName, { size: 24, variant: existing?.reactedByMe ? 'filled' : 'outline' })}<span>${label}</span>`;
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
    <input maxlength="32" placeholder="Lời nhắn ngắn hoặc ký hiệu..." aria-label="Cảm xúc tùy chọn" />
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
