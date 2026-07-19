export const refreshIconMarkup = `
  <span class="refresh-icon-static" aria-hidden="true">🔄</span>
  <span class="refresh-icon-motion bubble-spinner" aria-hidden="true">
    <span style="--i: 0"></span><span style="--i: 1"></span>
    <span style="--i: 2"></span><span style="--i: 3"></span>
    <span style="--i: 4"></span><span style="--i: 5"></span>
    <span style="--i: 6"></span><span style="--i: 7"></span>
  </span>
`;

export function setRefreshButtonLoading(button: HTMLButtonElement, loading: boolean): void {
  button.classList.toggle('is-refreshing', loading);
}
