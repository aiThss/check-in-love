export const refreshIconMarkup = `
  <span class="refresh-icon-static" aria-hidden="true">🔄</span>
  <lottie-player class="refresh-icon-motion" src="/icons8-refresh.json" background="transparent" speed="1" loop aria-hidden="true"></lottie-player>
`;

type LottiePlayerElement = HTMLElement & {
  play?: () => void;
  stop?: () => void;
};

export function setRefreshButtonLoading(button: HTMLButtonElement, loading: boolean): void {
  button.classList.toggle('is-refreshing', loading);

  const animation = button.querySelector<LottiePlayerElement>('.refresh-icon-motion');
  if (loading) {
    animation?.play?.();
  } else {
    animation?.stop?.();
  }
}
