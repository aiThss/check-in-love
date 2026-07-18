const FOOTER_CLASS = 'profile-copyright';
const STYLE_ID = 'profile-copyright-styles';

let initialized = false;
let frame: number | null = null;

function installStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${FOOTER_CLASS} {
      width: 100%;
      margin-top: 40px;
      padding-bottom: 4px;
      color: var(--text-tertiary, var(--text-secondary));
      font-family: "Inter", system-ui, sans-serif;
      font-size: 12px;
      line-height: 1.6;
      text-align: center;
      opacity: 0.7;
    }

    .${FOOTER_CLASS} .footer-brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .${FOOTER_CLASS} .footer-signature {
      font-weight: 700;
    }

    .${FOOTER_CLASS} .footer-contact-label {
      margin-top: 5px;
      font-size: 12px;
      font-weight: 650;
      line-height: 1.3;
    }

    .${FOOTER_CLASS} .footer-contact-arrow {
      display: block;
      width: 18px;
      height: 18px;
      margin: -1px auto;
      color: currentColor;
    }

    .${FOOTER_CLASS} .footer-email {
      display: block;
      margin-top: 1px;
      color: inherit;
      font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: clamp(15px, 2.8vw, 18px);
      font-weight: 600;
      letter-spacing: -0.025em;
      line-height: 1.3;
      text-wrap: nowrap;
    }
  `;
  document.head.appendChild(style);
}

function createFooter(): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = `${FOOTER_CLASS} footer site-footer`;
  footer.setAttribute('aria-label', 'Thông tin bản quyền và liên hệ');
  footer.innerHTML = `
    <div class="footer-brand">
      <span>© 2026 • Made by</span>
      <span class="footer-signature">aiThs</span>
    </div>
    <div class="footer-contact-label">Contact for work</div>
    <svg class="footer-contact-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
    <div class="footer-email">danhthai4560@gmail.com</div>
  `;
  return footer;
}

function ensureFooter(): void {
  installStyles();
  const page = document.querySelector<HTMLElement>('.profile-page');
  if (!page || page.querySelector(`:scope > .${FOOTER_CLASS}`)) return;
  page.appendChild(createFooter());
}

function scheduleFooter(): void {
  if (frame !== null) return;
  frame = window.requestAnimationFrame(() => {
    frame = null;
    ensureFooter();
  });
}

export function initProfileCopyright(): void {
  if (initialized) return;
  initialized = true;

  const observer = new MutationObserver((mutations) => {
    const profileChanged = mutations.some((mutation) =>
      Array.from(mutation.addedNodes).some((node) =>
        node instanceof Element
        && (node.matches('.profile-page') || Boolean(node.querySelector('.profile-page'))),
      ),
    );
    if (profileChanged) scheduleFooter();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  scheduleFooter();
}
