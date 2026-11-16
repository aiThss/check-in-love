/**
 * Lightweight Liquid Glass Spring Interaction Engine
 * Zero idle timers or DOM mutation observers: runs spring RAF strictly while pressed
 * and stops automatically on settle.
 */

const REDUCED_MOTION_QUERY =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

interface SpringEntry {
  press: number;
  pressV: number;
  targetPress: number;
  glow: number;
  glowV: number;
  targetGlow: number;
  tx: number;
  ty: number;
  targetTx: number;
  targetTy: number;
  rectWidth: number;
  rectHeight: number;
}

const activeSprings = new Map<HTMLElement, SpringEntry>();
let rafId: number | null = null;
let initialized = false;

const SURFACE_SELECTOR = [
  '.btn',
  '.btn-icon',
  '.chip',
  '.nav-item',
  '.nav-checkin-btn',
  '.lg-dock-chip',
  '.mood-btn',
  '.reaction-pill',
  '.reaction-option',
  '.streak-banner',
].join(', ');

function prefersReducedMotion(): boolean {
  return Boolean(REDUCED_MOTION_QUERY?.matches);
}

function getOrCreateSpring(el: HTMLElement): SpringEntry {
  let entry = activeSprings.get(el);
  if (!entry) {
    const rect = el.getBoundingClientRect();
    entry = {
      press: 0,
      pressV: 0,
      targetPress: 0,
      glow: 0,
      glowV: 0,
      targetGlow: 0,
      tx: 0,
      ty: 0,
      targetTx: 0,
      targetTy: 0,
      rectWidth: Math.max(rect.width, 32),
      rectHeight: Math.max(rect.height, 32),
    };
    activeSprings.set(el, entry);
  }
  return entry;
}

function stepSprings(): void {
  const stiffness = 0.24;
  const damping = 0.62;

  for (const [el, s] of activeSprings) {
    if (!el.isConnected) {
      activeSprings.delete(el);
      continue;
    }

    s.pressV = (s.pressV + (s.targetPress - s.press) * stiffness) * damping;
    s.press += s.pressV;

    s.glowV = (s.glowV + (s.targetGlow - s.glow) * 0.2) * 0.68;
    s.glow += s.glowV;

    s.tx += (s.targetTx - s.tx) * 0.28;
    s.ty += (s.targetTy - s.ty) * 0.28;

    const minDim = Math.min(s.rectWidth, s.rectHeight);
    const scaleAmount = minDim > 180 ? 0.014 : minDim > 90 ? 0.028 : 0.045;
    const sx = 1 - s.press * scaleAmount;
    const sy = 1 - s.press * scaleAmount;

    el.style.setProperty('--press', s.press.toFixed(4));
    el.style.setProperty('--glow', s.glow.toFixed(4));
    el.style.setProperty('--sx', sx.toFixed(4));
    el.style.setProperty('--sy', sy.toFixed(4));
    el.style.setProperty('--tx', `${s.tx.toFixed(2)}px`);
    el.style.setProperty('--ty', `${s.ty.toFixed(2)}px`);

    const settled =
      s.targetPress === 0 &&
      s.targetGlow === 0 &&
      Math.abs(s.press) < 0.002 &&
      Math.abs(s.pressV) < 0.002 &&
      Math.abs(s.glow) < 0.004 &&
      Math.abs(s.tx) < 0.08 &&
      Math.abs(s.ty) < 0.08;

    if (settled) {
      el.style.removeProperty('--press');
      el.style.removeProperty('--glow');
      el.style.removeProperty('--sx');
      el.style.removeProperty('--sy');
      el.style.removeProperty('--tx');
      el.style.removeProperty('--ty');
      activeSprings.delete(el);
    }
  }

  if (activeSprings.size > 0) {
    rafId = requestAnimationFrame(stepSprings);
  } else {
    rafId = null;
  }
}

function scheduleFrame(): void {
  if (rafId === null) {
    rafId = requestAnimationFrame(stepSprings);
  }
}

function updatePointerCoords(el: HTMLElement, clientX: number, clientY: number): void {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const entry = getOrCreateSpring(el);
  entry.rectWidth = rect.width;
  entry.rectHeight = rect.height;

  const relX = ((clientX - rect.left) / rect.width) * 100;
  const relY = ((clientY - rect.top) / rect.height) * 100;
  el.style.setProperty('--touch-x', `${Math.max(0, Math.min(100, relX)).toFixed(1)}%`);
  el.style.setProperty('--touch-y', `${Math.max(0, Math.min(100, relY)).toFixed(1)}%`);

  const normX = (clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
  const normY = (clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
  entry.targetTx = Math.max(-1, Math.min(1, normX)) * 1.5;
  entry.targetTy = Math.max(-1, Math.min(1, normY)) * 1.5;
}

export interface LiquidGlassOptions {
  maxScale?: number;
  hoverScale?: number;
  enableStretch?: boolean;
}

export function attachLiquidGlass(
  el: HTMLElement,
  _options: LiquidGlassOptions = {},
): () => void {
  el.classList.add('lg-surface');
  return () => {
    el.classList.remove('lg-surface');
    activeSprings.delete(el);
  };
}

export function initLiquidGlass(): void {
  if (initialized || typeof document === 'undefined') return;
  initialized = true;

  let activeTarget: HTMLElement | null = null;

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (prefersReducedMotion()) return;
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>(SURFACE_SELECTOR);
      if (!target) return;

      target.classList.add('lg-surface');
      activeTarget = target;
      const spring = getOrCreateSpring(target);
      spring.targetPress = 1;
      spring.targetGlow = 1;
      updatePointerCoords(target, e.clientX, e.clientY);
      scheduleFrame();
    },
    { passive: true },
  );

  document.addEventListener(
    'pointermove',
    (e) => {
      if (!activeTarget) return;
      updatePointerCoords(activeTarget, e.clientX, e.clientY);
    },
    { passive: true },
  );

  const release = () => {
    if (!activeTarget) return;
    const spring = activeSprings.get(activeTarget);
    if (spring) {
      spring.targetPress = 0;
      spring.targetGlow = 0;
      spring.targetTx = 0;
      spring.targetTy = 0;
      scheduleFrame();
    }
    activeTarget = null;
  };

  document.addEventListener('pointerup', release, { passive: true });
  document.addEventListener('pointercancel', release, { passive: true });
}
