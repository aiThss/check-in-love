/**
 * LoveMusic Liquid Glass Interactive Physics Engine for PWA
 * - Injects the shared SVG refraction filter (#lg-lens) and ambient background orbs
 * - Attaches spring physics (dampingRatio = 0.5, stiffness = 300) for hover/touch bulge,
 *   drag stretch, and cursor/finger radial glow without intercepting click events.
 */

export interface LiquidGlassOptions {
  /** Maximum scale bulge when pressed/touched (1.28 for buttons, 1.03 for cards, 1.035 for bars) */
  maxScale?: number
  /** Maximum scale bulge on pointer hover */
  hoverScale?: number
  /** Whether drag stretches the element along the drag vector */
  enableStretch?: boolean
}

interface SpringState {
  value: number
  velocity: number
  target: number
}

function stepSpring(
  state: SpringState,
  dt: number,
  stiffness = 300,
  dampingRatio = 0.5
): boolean {
  const safeDt = Math.min(dt, 0.032)
  const damping = 2 * dampingRatio * Math.sqrt(stiffness)
  const force = -stiffness * (state.value - state.target) - damping * state.velocity
  state.velocity += force * safeDt
  state.value += state.velocity * safeDt

  if (
    Math.abs(state.target - state.value) < 0.0008 &&
    Math.abs(state.velocity) < 0.005
  ) {
    state.value = state.target
    state.velocity = 0
    return false
  }
  return true
}

const BOUND_ATTR = 'data-lg-bound'

export function ensureLiquidGlassFilterAndOrbs(): void {
  if (typeof document === 'undefined' || !document.body) return

  if (!document.getElementById('lg-svg-defs')) {
    const svgWrap = document.createElement('div')
    svgWrap.id = 'lg-svg-defs'
    svgWrap.setAttribute('aria-hidden', 'true')
    svgWrap.style.cssText =
      'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;'
    svgWrap.innerHTML = `
      <svg width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="lg-lens" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
            <feColorMatrix in="blur" type="saturate" values="1.75" result="sat" />
            <feSpecularLighting in="blur" surfaceScale="3" specularConstant="0.7" specularExponent="28" lighting-color="#ffd6e8" result="spec">
              <fePointLight x="-120" y="-180" z="220" />
            </feSpecularLighting>
            <feComposite in="spec" in2="SourceAlpha" operator="in" result="specMask" />
            <feMerge>
              <feMergeNode in="sat" />
              <feMergeNode in="specMask" />
            </feMerge>
          </filter>
        </defs>
      </svg>
    `
    document.body.prepend(svgWrap)
  }

  if (!document.querySelector('.lg-ambient-orbs')) {
    const orbs = document.createElement('div')
    orbs.className = 'lg-ambient-orbs'
    orbs.setAttribute('aria-hidden', 'true')
    orbs.innerHTML = `
      <div class="lg-ambient-orb lg-ambient-orb--tl"></div>
      <div class="lg-ambient-orb lg-ambient-orb--tr"></div>
      <div class="lg-ambient-orb lg-ambient-orb--bl"></div>
    `
    document.body.prepend(orbs)
  }
}

export function attachLiquidGlass(
  el: HTMLElement,
  options: LiquidGlassOptions = {}
): void {
  if (!el || el.getAttribute(BOUND_ATTR) === '1') return
  el.setAttribute(BOUND_ATTR, '1')
  el.classList.add('lg-surface')

  const maxScale = options.maxScale ?? 1.18
  const hoverScale = options.hoverScale ?? Math.min(1 + (maxScale - 1) * 0.35, 1.07)
  const enableStretch = options.enableStretch ?? true

  const pressSpring: SpringState = { value: 0, velocity: 0, target: 0 }
  const glowSpring: SpringState = { value: 0, velocity: 0, target: 0 }
  const sxSpring: SpringState = { value: 1, velocity: 0, target: 1 }
  const sySpring: SpringState = { value: 1, velocity: 0, target: 1 }

  let rafId = 0
  let lastTime = 0
  let startX = 0
  let startY = 0
  let isPressed = false

  const applyVars = () => {
    el.style.setProperty('--press', pressSpring.value.toFixed(4))
    el.style.setProperty('--glow', glowSpring.value.toFixed(4))
    el.style.setProperty('--sx', sxSpring.value.toFixed(4))
    el.style.setProperty('--sy', sySpring.value.toFixed(4))
  }

  const tick = (now: number) => {
    const dt = lastTime ? (now - lastTime) / 1000 : 0.016
    lastTime = now

    const a = stepSpring(pressSpring, dt, 300, 0.5)
    const b = stepSpring(glowSpring, dt, 260, 0.65)
    const c = stepSpring(sxSpring, dt, 300, 0.5)
    const d = stepSpring(sySpring, dt, 300, 0.5)

    applyVars()

    if (a || b || c || d) {
      rafId = requestAnimationFrame(tick)
    } else {
      rafId = 0
      lastTime = 0
    }
  }

  const scheduleTick = () => {
    if (!rafId && typeof requestAnimationFrame === 'function') {
      lastTime = 0
      rafId = requestAnimationFrame(tick)
    } else {
      applyVars()
    }
  }

  const updatePointerCoords = (e: PointerEvent) => {
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
    const minDim = Math.max(36, Math.min(rect.width, rect.height))
    el.style.setProperty('--touch-x', `${x.toFixed(1)}px`)
    el.style.setProperty('--touch-y', `${y.toFixed(1)}px`)
    el.style.setProperty('--min-dim', `${minDim.toFixed(0)}px`)
  }

  el.addEventListener(
    'pointerenter',
    (e: PointerEvent) => {
      updatePointerCoords(e)
      if (!isPressed && e.pointerType === 'mouse') {
        glowSpring.target = 0.24
        sxSpring.target = hoverScale
        sySpring.target = hoverScale
        scheduleTick()
      }
    },
    { passive: true }
  )

  el.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      isPressed = true
      startX = e.clientX
      startY = e.clientY
      updatePointerCoords(e)
      pressSpring.target = 1
      glowSpring.target = 0.42
      sxSpring.target = maxScale
      sySpring.target = maxScale
      scheduleTick()
    },
    { passive: true }
  )

  el.addEventListener(
    'pointermove',
    (e: PointerEvent) => {
      updatePointerCoords(e)
      if (isPressed && enableStretch) {
        const dx = e.clientX - startX
        const dy = e.clientY - startY
        const stretchX = Math.max(-0.06, Math.min(0.08, (Math.abs(dx) - Math.abs(dy)) / 420))
        const stretchY = Math.max(-0.06, Math.min(0.08, (Math.abs(dy) - Math.abs(dx)) / 420))
        sxSpring.target = maxScale + stretchX
        sySpring.target = maxScale + stretchY
      } else if (!isPressed && e.pointerType === 'mouse') {
        glowSpring.target = 0.26
      }
      scheduleTick()
    },
    { passive: true }
  )

  const release = (e?: PointerEvent) => {
    isPressed = false
    pressSpring.target = 0
    const isHoveringMouse = e && e.pointerType === 'mouse' && e.type === 'pointerup'
    glowSpring.target = isHoveringMouse ? 0.22 : 0
    sxSpring.target = isHoveringMouse ? hoverScale : 1
    sySpring.target = isHoveringMouse ? hoverScale : 1
    scheduleTick()
  }

  el.addEventListener('pointerup', release, { passive: true })
  el.addEventListener('pointercancel', () => release(), { passive: true })
  el.addEventListener('pointerleave', () => release(), { passive: true })
}

const BUTTON_SELECTOR = [
  '.nav-checkin-btn',
  '.btn-icon',
  '.btn-ghost',
  '.btn-primary',
  '.mem-icon-btn',
  '.reaction-pill',
  '.reply-button',
  '.messages-menu-button',
  '.theme-choice',
  '.lg-dock-chip',
].join(',')

const BAR_SELECTOR = [
  '.bottom-nav-inner',
  '.lg-quick-dock',
  '.messages-composer',
].join(',')

const CARD_SELECTOR = [
  '.checkin-card',
  '.card',
  '.card-solid',
  '.recent-memory-card',
  '.memory-item',
].join(',')

export function scanAndAttachLiquidGlass(root: ParentNode = document): void {
  if (!root || typeof root.querySelectorAll !== 'function') return

  root.querySelectorAll<HTMLElement>(BUTTON_SELECTOR).forEach((el) => {
    attachLiquidGlass(el, { maxScale: 1.24, hoverScale: 1.07, enableStretch: true })
  })

  root.querySelectorAll<HTMLElement>(BAR_SELECTOR).forEach((el) => {
    attachLiquidGlass(el, { maxScale: 1.032, hoverScale: 1.01, enableStretch: true })
  })

  root.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach((el) => {
    attachLiquidGlass(el, { maxScale: 1.022, hoverScale: 1.008, enableStretch: false })
  })
}

let initialized = false

export function initLiquidGlass(): void {
  ensureLiquidGlassFilterAndOrbs()
  scanAndAttachLiquidGlass(document)

  if (initialized || typeof MutationObserver === 'undefined' || !document.body) {
    return
  }
  initialized = true

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          if (node.matches(BUTTON_SELECTOR)) {
            attachLiquidGlass(node, { maxScale: 1.24, hoverScale: 1.07, enableStretch: true })
          } else if (node.matches(BAR_SELECTOR)) {
            attachLiquidGlass(node, { maxScale: 1.032, hoverScale: 1.01, enableStretch: true })
          } else if (node.matches(CARD_SELECTOR)) {
            attachLiquidGlass(node, { maxScale: 1.022, hoverScale: 1.008, enableStretch: false })
          }
          scanAndAttachLiquidGlass(node)
        }
      })
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
}
