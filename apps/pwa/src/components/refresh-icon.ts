export const REFRESH_ICON_ANIMATION_DURATION_MS = 3_000;

export const refreshIconMarkup = `
  <span class="refresh-icon-static" aria-hidden="true">
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
    >
      <circle
        cx="12"
        cy="12"
        r="8.25"
        stroke="currentColor"
        stroke-width="1.5"
        opacity="0.16"
      />
      <path
        d="M19.25 8.25A8.25 8.25 0 1 0 19.7 14.6"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
      <path
        d="M19.25 4.75V8.5H15.5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </span>
  <span
    class="refresh-icon-motion bubble-spinner"
    style="animation-duration: 900ms"
    aria-hidden="true"
  >
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
