import { isReducedMotionActive } from './theme/index';

export type HapticPattern = 'tap' | 'select' | 'threshold' | 'confirm' | 'warning';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 8,
  select: 10,
  threshold: 14,
  confirm: [10, 26, 14],
  warning: [18, 36, 18],
};

/**
 * Fires a subtle micro-vibration when supported by the device/WebView.
 * Automatically muted when reduced-motion is active or unsupported.
 */
export function triggerHaptic(pattern: HapticPattern = 'tap'): boolean {
  if (isReducedMotionActive()) return false;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return false;
  }
  try {
    return navigator.vibrate(PATTERNS[pattern]);
  } catch {
    return false;
  }
}
