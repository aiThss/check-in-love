export interface TypingIndicatorController {
  element: HTMLElement;
  setPartnerTyping: (isTyping: boolean) => void;
  destroy: () => void;
}

export function createTypingIndicator(): TypingIndicatorController {
  const el = document.createElement('div');
  el.className = 'messages-typing-bubble';
  el.hidden = true;
  el.setAttribute('aria-label', 'Người ấy đang nhập tin nhắn');
  el.innerHTML = '<span class="messages-typing-dot"></span><span class="messages-typing-dot"></span><span class="messages-typing-dot"></span>';

  let expireTimer: number | null = null;

  const setPartnerTyping = (isTyping: boolean): void => {
    if (expireTimer !== null) {
      window.clearTimeout(expireTimer);
      expireTimer = null;
    }
    el.hidden = !isTyping;
    if (isTyping) {
      expireTimer = window.setTimeout(() => {
        expireTimer = null;
        el.hidden = true;
      }, 5_000);
    }
  };

  const destroy = (): void => {
    if (expireTimer !== null) {
      window.clearTimeout(expireTimer);
      expireTimer = null;
    }
  };

  return { element: el, setPartnerTyping, destroy };
}
