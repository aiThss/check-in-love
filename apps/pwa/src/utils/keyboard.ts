/** Keep fixed chat controls aligned with the mobile browser's visual viewport. */
export function initKeyboardViewport(): void {
  const viewport = window.visualViewport;
  if (!viewport) return;

  let largestViewportHeight = Math.max(window.innerHeight, viewport.height);
  let lastViewportWidth = viewport.width;

  const isTextInputFocused = () => {
    const active = document.activeElement;
    return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
  };

  const update = () => {
    // A keyboard normally changes only the visual viewport height. A large width
    // change means the device rotated, so start measuring from the new orientation.
    if (Math.abs(viewport.width - lastViewportWidth) > 80) {
      largestViewportHeight = Math.max(window.innerHeight, viewport.height);
      lastViewportWidth = viewport.width;
    } else {
      // Safari and Android WebView may resize window.innerHeight together with the
      // keyboard. Preserve the largest known height so the layout does not collapse.
      largestViewportHeight = Math.max(largestViewportHeight, viewport.height, window.innerHeight);
    }

    const keyboardHeight = Math.max(0, largestViewportHeight - viewport.height - viewport.offsetTop);
    const isKeyboardOpen = isTextInputFocused() && keyboardHeight > 80;
    const root = document.documentElement;

    root.style.setProperty('--app-viewport-height', `${largestViewportHeight}px`);
    root.style.setProperty('--keyboard-offset', `${isKeyboardOpen ? keyboardHeight : 0}px`);
    root.classList.toggle('keyboard-open', isKeyboardOpen);
  };

  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  window.addEventListener('orientationchange', () => window.setTimeout(update, 180));
  document.addEventListener('focusin', () => window.setTimeout(update, 50));
  document.addEventListener('focusout', () => window.setTimeout(update, 120));
  update();
}
