/** Keep fixed chat controls aligned with the mobile browser's visual viewport. */
export function initKeyboardViewport(): void {
  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  const root = document.documentElement;
  if (isIOS) {
    root.classList.add('is-ios');
  }

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

    root.style.setProperty('--app-viewport-height', `${largestViewportHeight}px`);
    // On iOS Safari / WebKit, fixed elements are anchored to the visual viewport automatically
    // or panned up by Safari when focused. Applying the full keyboardHeight causes double lift.
    const effectiveOffset = isIOS ? 0 : keyboardHeight;
    root.style.setProperty('--keyboard-offset', `${isKeyboardOpen ? effectiveOffset : 0}px`);
    root.style.setProperty('--ios-keyboard-height', `${isKeyboardOpen ? keyboardHeight : 0}px`);
    root.classList.toggle('keyboard-open', isKeyboardOpen);
  };

  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  window.addEventListener('orientationchange', () => window.setTimeout(update, 180));
  document.addEventListener('focusin', () => window.setTimeout(update, 50));
  document.addEventListener('focusout', () => window.setTimeout(update, 120));
  update();
}
