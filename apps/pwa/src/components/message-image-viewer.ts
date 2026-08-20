let activeClose: (() => void) | null = null;

/** Opens a lightweight, chat-only image viewer (separate from the Memories foil viewer). */
export function openMessageImageViewer(imageUrl: string, alt = 'Ảnh tin nhắn'): { close: () => void } {
  activeClose?.();

  const backdrop = document.createElement('div');
  backdrop.className = 'message-image-viewer-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Xem ảnh');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'message-image-viewer-close';
  closeButton.setAttribute('aria-label', 'Đóng ảnh');
  closeButton.textContent = '×';

  const image = document.createElement('img');
  image.className = 'message-image-viewer-image';
  image.src = imageUrl;
  image.alt = alt;
  image.decoding = 'async';

  const previousOverflow = document.body.style.overflow;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown);
    document.body.style.overflow = previousOverflow;
    backdrop.remove();
    if (activeClose === close) activeClose = null;
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
  };

  closeButton.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  image.addEventListener('click', (event) => event.stopPropagation());

  backdrop.append(closeButton, image);
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKeyDown);
  activeClose = close;
  window.setTimeout(() => closeButton.focus(), 0);
  return { close };
}
