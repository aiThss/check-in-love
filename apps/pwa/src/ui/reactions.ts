import type { IconName } from './icons/icons';
import { triggerHaptic } from './haptics';
import type { Reaction, ReactionType } from '../api/types';

export interface BespokeReactionDef {
  type: ReactionType;
  icon: IconName;
  label: string;
}

export const BESPOKE_REACTIONS: readonly BespokeReactionDef[] = [
  { type: '❤️', icon: 'heart', label: 'Yêu' },
  { type: '🥰', icon: 'react-love', label: 'Thương' },
  { type: '😘', icon: 'react-hug', label: 'Hôn' },
  { type: '😂', icon: 'react-haha', label: 'Cười' },
  { type: '🥺', icon: 'react-ouch', label: 'Nhớ' },
  { type: '🤗', icon: 'react-hug', label: 'Ôm' },
  { type: '🔥', icon: 'react-fire', label: 'Cháy' },
  { type: '✨', icon: 'sparkle', label: 'Lấp lánh' },
  { type: '😍', icon: 'react-love', label: 'Mê' },
  { type: '😭', icon: 'react-ouch', label: 'Xúc động' },
];

export const MOOD_ICON_LOOKUP: Record<string, { icon: IconName; label: string }> = {
  happy: { icon: 'sparkle', label: 'Vui vẻ' },
  love: { icon: 'react-love', label: 'Đang yêu' },
  sad: { icon: 'react-ouch', label: 'Buồn' },
  excited: { icon: 'star', label: 'Hào hứng' },
  tired: { icon: 'moon', label: 'Mệt mỏi' },
  calm: { icon: 'sun', label: 'Bình yên' },
  miss: { icon: 'heart', label: 'Nhớ nhung' },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderReactionSymbolHtml(type: string, _active = false): string {
  return `<span class="c-reaction-emoji">${escapeHtml(type)}</span>`;
}

export interface ReactionTrayController {
  element: HTMLElement;
  sync: () => void;
}

/**
 * Hidden-by-default reaction/sticker/emoji tray placed directly beneath the message bar.
 * Remains completely hidden (`hidden = true`) until at least one reaction/sticker/emoji exists.
 */
export function createReactionTray(
  getReactions: () => Reaction[],
  onToggleReaction?: (type: ReactionType) => void,
): ReactionTrayController {
  const tray = document.createElement('div');
  tray.className = 'c-reaction-tray';
  tray.hidden = true;

  const sync = (): void => {
    const active = (getReactions() ?? []).filter((r) => r.count > 0);
    if (active.length === 0) {
      tray.hidden = true;
      tray.replaceChildren();
      return;
    }

    tray.hidden = false;
    tray.replaceChildren();

    active.forEach((reaction) => {
      const pill = document.createElement(onToggleReaction ? 'button' : 'span');
      if (pill instanceof HTMLButtonElement) {
        pill.type = 'button';
        pill.setAttribute('aria-label', `Cảm xúc ${reaction.type} (${reaction.count})`);
        pill.addEventListener('click', (event) => {
          event.stopPropagation();
          triggerHaptic('tap');
          onToggleReaction?.(reaction.type);
        });
      }
      pill.className = `reaction-pill c-reaction-chip${reaction.reactedByMe ? ' selected' : ''}`;
      pill.innerHTML = `<span class="c-reaction-emoji" aria-hidden="true">${escapeHtml(reaction.type)}</span>${reaction.count > 1 ? `<strong>${reaction.count}</strong>` : ''}`;
      tray.appendChild(pill);
    });
  };

  sync();
  return { element: tray, sync };
}
