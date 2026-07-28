const PROFILE_REMINDER_SELECTOR = '.profile-page .reminder-card';
const AVATAR_EDIT_BADGE_SELECTORS = [
  '#my-avatar-container > div',
  '#partner-avatar-container > div',
].join(',');

function removeProfileUi(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>(PROFILE_REMINDER_SELECTOR).forEach((card) => card.remove());

  root.querySelectorAll<HTMLElement>(AVATAR_EDIT_BADGE_SELECTORS).forEach((badge) => {
    if (badge.textContent?.trim() === 'Sửa') badge.remove();
  });
}

/**
 * Profile content is populated asynchronously, so remove deprecated controls
 * whenever its cards are mounted or refreshed.
 */
export function initProfileUiCleanup(): void {
  removeProfileUi();

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.addedNodes.length === 0) continue;
      removeProfileUi();
      break;
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
