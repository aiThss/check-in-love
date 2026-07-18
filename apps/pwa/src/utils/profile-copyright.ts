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
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      margin-top: 2px;
      padding: 18px 12px 4px;
      color: var(--text-secondary);
      text-align: center;
    }

    .${FOOTER_CLASS} .profile-copyright-brand {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.4;
    }

    .${FOOTER_CLASS} .profile-copyright-signature {
      background: linear-gradient(135deg, var(--accent), #ff8fb8 54%, var(--text-primary));
      background-clip: text;
      color: var(--accent);
      font-weight: 800;
      letter-spacing: -0.02em;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .${FOOTER_CLASS} .profile-copyright-contact {
      margin-top: 6px;
      font-size: 11px;
      font-weight: 650;
      line-height: 1.3;
    }

    .${FOOTER_CLASS} .profile-copyright-arrow {
      width: 18px;
      height: 18px;
      margin-block: -1px;
      color: var(--text-secondary);
      opacity: 0.72;
    }

    .${FOOTER_CLASS} .profile-copyright-email {
      display: inline-block;
      max-width: calc(100vw - 40px);
      padding: 3px 5px;
      background: linear-gradient(90deg, var(--text-primary), var(--accent), var(--text-primary));
      background-clip: text;
      color: var(--text-primary);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: clamp(14px, 4vw, 17px);
      font-weight: 700;
      letter-spacing: -0.035em;
      line-height: 1.3;
      text-decoration: none;
      text-wrap: nowrap;
      text-shadow: 0 0 14px color-mix(in srgb, var(--accent) 28%, transparent);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      transition: transform var(--duration-fast) var(--ease), text-shadow var(--duration-fast) var(--ease);
    }

    .${FOOTER_CLASS} .profile-copyright-email:active {
      transform: scale(0.98);
    }

    .${FOOTER_CLASS} .profile-copyright-email:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 3px;
      border-radius: 6px;
    }

    @media (prefers-reduced-motion: reduce) {
      .${FOOTER_CLASS} .profile-copyright-email {
        transition: none;
      }
    }
  `;
  document.head.appendChild(style);
}

function createFooter(): HTMLElement {
  const footer = document.createElement('footer');
  footer.className = FOOTER_CLASS;
  footer.setAttribute('aria-label', 'Thông tin bản quyền và liên hệ');
  footer.innerHTML = `
    <div class="profile-copyright-brand">
      <span>© ${new Date().getFullYear()} • Made with 💕 by</span>
      <span class="profile-copyright-signature">aiThs</span>
    </div>
    <div class="profile-copyright-contact">Liên hệ công việc</div>
    <svg class="profile-copyright-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
    <a
      class="profile-copyright-email"
      href="mailto:danhthai4560@gmail.com"
      aria-label="Gửi email công việc tới danhthai4560@gmail.com"
    >danhthai4560@gmail.com</a>
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
