import { iconMarkup } from '../ui/icons/icons';

export const REFRESH_ICON_ANIMATION_DURATION_MS = 900;

export const refreshIconMarkup = `
  <span class="refresh-icon-static" aria-hidden="true">
    ${iconMarkup('refresh', { size: 20 })}
  </span>
  <span
    class="refresh-icon-motion"
    aria-hidden="true"
  >
    ${iconMarkup('refresh', { size: 20, motion: 'spin' })}
  </span>
`;

const refreshStartedAt = new WeakMap<HTMLButtonElement, number>();
const refreshStopTimers = new WeakMap<HTMLButtonElement, number>();

export function setRefreshButtonLoading(
  button: HTMLButtonElement,
  loading: boolean,
  minimumDurationMs = REFRESH_ICON_ANIMATION_DURATION_MS,
): void {
  const activeTimer = refreshStopTimers.get(button);
  if (activeTimer !== undefined) {
    window.clearTimeout(activeTimer);
    refreshStopTimers.delete(button);
  }

  if (loading) {
    refreshStartedAt.set(button, Date.now());
    button.classList.add('is-refreshing');
    return;
  }

  const startedAt = refreshStartedAt.get(button);
  const remainingDuration = Math.max(0, minimumDurationMs - (Date.now() - (startedAt ?? 0)));
  const stop = () => {
    refreshStartedAt.delete(button);
    refreshStopTimers.delete(button);
    button.classList.remove('is-refreshing');
  };

  if (remainingDuration === 0) {
    stop();
    return;
  }

  refreshStopTimers.set(button, window.setTimeout(stop, remainingDuration));
}
