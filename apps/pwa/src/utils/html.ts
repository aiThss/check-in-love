// ── HTML Utilities ────────────────────────────────────────────────────────────

/**
 * Escape user-supplied text before inserting it into innerHTML.
 * Prevents XSS when rendering data from the API or user input.
 */
export function escapeHtml(value: string | undefined | null): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
