/** Keep fixed chat controls aligned with the mobile browser's visual viewport. */
export function initKeyboardViewport(): void {
  const viewport = window.visualViewport;
  if (!viewport) return;

  const update = () => {
    const keyboardHeight = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    const isKeyboardOpen = keyboardHeight > 120;
    document.documentElement.style.setProperty('--keyboard-offset', `${isKeyboardOpen ? keyboardHeight : 0}px`);
    document.documentElement.classList.toggle('keyboard-open', isKeyboardOpen);
  };

  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  window.addEventListener('orientationchange', update);
  update();
}
