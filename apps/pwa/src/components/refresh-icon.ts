export const REFRESH_ICON_ANIMATION_DURATION_MS = 3_000;

export const refreshIconMarkup = `
  <span class="refresh-icon-static" aria-hidden="true">
    <img src="/icons8-refresh-ios7-32.png" alt="" width="32" height="32" />
  </span>
  <span class="refresh-icon-motion bubble-spinner" aria-hidden="true">
    <span style="--i: 0"></span><span style="--i: 1"></span>
    <span style="--i: 2"></span><span style="--i: 3"></span>
    <span style="--i: 4"></span><span style="--i: 5"></span>
    <span style="--i: 6"></span><span style="--i: 7"></span>
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
