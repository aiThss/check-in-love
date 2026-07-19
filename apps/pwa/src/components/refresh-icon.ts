export const REFRESH_ICON_ANIMATION_DURATION_MS = 3_000;

export const refreshIconMarkup = `
  <span class="refresh-icon-static" aria-hidden="true">
    <svg
      viewBox="0 0 90 90"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
    >
      <g transform="rotate(75 45 45)">
        <path
          fill="currentColor"
          d="M81.521 31.109c-.86-1.73-2.959-2.438-4.692-1.575-1.73.86-2.436 2.961-1.575 4.692 2.329 4.685 3.51 9.734 3.51 15.01C78.764 67.854 63.617 83 45 83S11.236 67.854 11.236 49.236c0-16.222 11.501-29.805 26.776-33.033l-3.129 4.739c-1.065 1.613-.62 3.784.992 4.85.594.392 1.264.579 1.926.579 1.136 0 2.251-.553 2.924-1.571l7.176-10.87.002-.003.018-.027c.063-.096.106-.199.159-.299.049-.093.108-.181.149-.279.087-.207.152-.419.197-.634.009-.041.008-.085.015-.126.031-.182.053-.364.055-.547 0-.014.004-.028.004-.042 0-.066-.016-.128-.019-.193-.008-.145-.018-.288-.043-.431-.018-.097-.045-.189-.071-.283-.032-.118-.065-.236-.109-.35-.037-.095-.081-.185-.125-.276-.052-.107-.107-.211-.17-.313-.054-.087-.114-.168-.175-.25-.07-.093-.143-.183-.223-.27-.074-.08-.153-.155-.234-.228-.047-.042-.085-.092-.135-.132L36.679.775c-1.503-1.213-3.708-.977-4.921.53-1.213 1.505-.976 3.709.53 4.921l3.972 3.2C17.97 13.438 4.236 29.759 4.236 49.236 4.236 71.714 22.522 90 45 90s40.764-18.286 40.764-40.764c0-6.366-1.427-12.464-4.243-18.127Z"
        />
      </g>
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
