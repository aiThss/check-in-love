/** Keep fixed chat controls aligned with the mobile browser's visual viewport. */
export function initKeyboardViewport(): void {
  const viewport = window.visualViewport;
  if (!viewport) return;

  let largestViewportHeight = Math.max(window.innerHeight, viewport.height);

  const isTextInputFocused = () => {
    const active = document.activeElement;
    return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
  };

  const update = () => {
    // Safari may resize window.innerHeight together with the keyboard. Preserve
    // the largest known viewport so its keyboard height remains measurable.
    largestViewportHeight = Math.max(largestViewportHeight, viewport.height, window.innerHeight);
    const keyboardHeight = Math.max(0, largestViewportHeight - viewport.height - viewport.offsetTop);
    const isKeyboardOpen = isTextInputFocused() && keyboardHeight > 80;
    document.documentElement.style.setProperty('--keyboard-offset', `${isKeyboardOpen ? keyboardHeight : 0}px`);
    document.documentElement.classList.toggle('keyboard-open', isKeyboardOpen);
  };

  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  window.addEventListener('orientationchange', update);
  document.addEventListener('focusin', () => window.setTimeout(update, 50));
  document.addEventListener('focusout', () => window.setTimeout(update, 120));
  update();
}
