import type { RoutePage } from '../router';
import '../styles/scratch-card-demos.css';

type ScratchTheme = 'love-foil' | 'midnight-stars' | 'secret-note' | 'memory-bloom';

interface ScratchDemoConfig {
  id: ScratchTheme;
  order: string;
  name: string;
  description: string;
  badge: string;
  revealEyebrow: string;
  revealTitle: string;
  revealText: string;
  revealIcon: string;
  threshold: number;
}

const REVEAL_THRESHOLD = 0.75;

const SCRATCH_DEMOS: ScratchDemoConfig[] = [
  {
    id: 'love-foil',
    order: '01',
    name: 'Love Foil',
    description: 'Lớp nhũ hồng ánh tím, hợp khoảnh khắc couple ngọt ngào.',
    badge: 'Romantic',
    revealEyebrow: 'Kỷ niệm hôm nay',
    revealTitle: 'Hai đứa là điều dễ thương nhất 💞',
    revealText: 'Một tấm thẻ mềm, nổi bật và khớp accent hồng hiện tại của LoveCheck.',
    revealIcon: '💗',
    threshold: REVEAL_THRESHOLD,
  },
  {
    id: 'midnight-stars',
    order: '02',
    name: 'Midnight Stars',
    description: 'Bầu trời đêm, sao nhỏ và ánh trăng cho ảnh hẹn hò buổi tối.',
    badge: 'Dreamy',
    revealEyebrow: 'Điều ước bí mật',
    revealTitle: 'Ước gì tối nay dài thêm một chút ✨',
    revealText: 'Tông tối giúp ảnh và nội dung sau khi mở khóa có cảm giác điện ảnh hơn.',
    revealIcon: '🌙',
    threshold: REVEAL_THRESHOLD,
  },
  {
    id: 'secret-note',
    order: '03',
    name: 'Secret Note',
    description: 'Mảnh giấy viết tay nhẹ nhàng, giống một lời nhắn giấu kín.',
    badge: 'Message',
    revealEyebrow: 'Lời nhắn dành cho bạn',
    revealTitle: 'Cảm ơn vì vẫn luôn ở đây cùng mình 💌',
    revealText: 'Hợp với tin nhắn yêu thương, anniversary note hoặc lời xin lỗi nhỏ.',
    revealIcon: '✉️',
    threshold: REVEAL_THRESHOLD,
  },
  {
    id: 'memory-bloom',
    order: '04',
    name: 'Memory Bloom',
    description: 'Cánh hoa trong suốt, glassmorphism và màu pastel dịu.',
    badge: 'Premium',
    revealEyebrow: 'Một ký ức vừa nở',
    revealTitle: 'Khoảnh khắc nhỏ, nhưng mình muốn nhớ thật lâu 🌸',
    revealText: 'Concept tinh tế nhất để dùng cho Memories hoặc ảnh milestone đặc biệt.',
    revealIcon: '🌷',
    threshold: REVEAL_THRESHOLD,
  },
];

interface ScratchSurface {
  reset: () => void;
  destroy: () => void;
}

export function renderScratchCardDemosPage(): RoutePage {
  const root = document.createElement('div');
  root.className = 'page scratch-demos-page animate-fade-in';
  root.innerHTML = `
    <header class="scratch-demos-hero">
      <div class="scratch-demos-kicker"><span></span> LoveCheck interaction lab</div>
      <h1>4 demo scratch card</h1>
      <p>Cào trực tiếp từng mẫu để so sánh cảm giác, độ rõ và phong cách trước khi gắn vào Home hoặc Memories.</p>
      <div class="scratch-demos-tip">
        <span class="scratch-demos-tip-icon">↗</span>
        <span>Dùng chuột hoặc ngón tay. Cào ít nhất 75% diện tích để mở khóa.</span>
      </div>
    </header>

    <main class="scratch-demos-grid">
      ${SCRATCH_DEMOS.map(renderDemoMarkup).join('')}
    </main>
  `;

  const surfaces: ScratchSurface[] = [];

  root.querySelectorAll<HTMLElement>('[data-scratch-demo]').forEach((card) => {
    const theme = card.dataset.scratchDemo as ScratchTheme | undefined;
    const config = SCRATCH_DEMOS.find((item) => item.id === theme);
    const stage = card.querySelector<HTMLElement>('[data-scratch-stage]');
    const canvas = card.querySelector<HTMLCanvasElement>('canvas');
    const progress = card.querySelector<HTMLElement>('[data-scratch-progress]');
    const progressText = card.querySelector<HTMLElement>('[data-scratch-progress-text]');
    const resetButton = card.querySelector<HTMLButtonElement>('[data-scratch-reset]');

    if (!config || !stage || !canvas || !progress || !progressText || !resetButton) return;

    const surface = mountScratchSurface({ stage, canvas, progress, progressText, config });
    resetButton.addEventListener('click', surface.reset);
    surfaces.push({
      reset: surface.reset,
      destroy: () => {
        resetButton.removeEventListener('click', surface.reset);
        surface.destroy();
      },
    });
  });

  return {
    element: root,
    destroy: () => surfaces.forEach((surface) => surface.destroy()),
  };
}

function renderDemoMarkup(config: ScratchDemoConfig): string {
  return `
    <article class="scratch-demo-card scratch-demo-card--${config.id}" data-scratch-demo="${config.id}">
      <div class="scratch-demo-card-head">
        <div>
          <span class="scratch-demo-order">${config.order}</span>
          <h2>${config.name}</h2>
        </div>
        <span class="scratch-demo-badge">${config.badge}</span>
      </div>
      <p class="scratch-demo-description">${config.description}</p>

      <div class="scratch-demo-stage" data-scratch-stage>
        <div class="scratch-demo-reveal">
          <div class="scratch-demo-reveal-glow"></div>
          <span class="scratch-demo-reveal-icon">${config.revealIcon}</span>
          <span class="scratch-demo-reveal-eyebrow">${config.revealEyebrow}</span>
          <strong>${config.revealTitle}</strong>
          <p>${config.revealText}</p>
        </div>
        <canvas aria-label="Cào để mở ${config.name}"></canvas>
        <div class="scratch-demo-complete" aria-live="polite">
          <span>Đã mở khóa</span>
          <b>♥</b>
        </div>
        <div class="scratch-demo-meter" aria-hidden="true">
          <div class="scratch-demo-meter-track"><span data-scratch-progress></span></div>
          <small data-scratch-progress-text>0%</small>
        </div>
      </div>

      <button class="scratch-demo-reset" type="button" data-scratch-reset>
        <span>↻</span> Cào lại demo
      </button>
    </article>
  `;
}

function mountScratchSurface(params: {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  progress: HTMLElement;
  progressText: HTMLElement;
  config: ScratchDemoConfig;
}): ScratchSurface {
  const { stage, canvas, progress, progressText, config } = params;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return { reset: () => undefined, destroy: () => undefined };

  const ctx: CanvasRenderingContext2D = context;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pointer = { active: false, lastX: 0, lastY: 0 };
  let width = 0;
  let height = 0;
  let revealed = false;
  let ratioFrame: number | null = null;

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);

  function resize(): void {
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCover(ctx, config.id, width, height);
    updateProgress(0);
    revealed = false;
    stage.classList.remove('is-revealed');
  }

  function reset(): void {
    if (ratioFrame !== null) cancelAnimationFrame(ratioFrame);
    ratioFrame = null;
    pointer.active = false;
    revealed = false;
    stage.classList.remove('is-revealed');
    canvas.style.opacity = '1';
    canvas.style.pointerEvents = 'auto';
    drawCover(ctx, config.id, width, height);
    updateProgress(0);
  }

  function updateProgress(value: number): void {
    const percentage = Math.min(100, Math.round(value * 100));
    progress.style.width = `${percentage}%`;
    progressText.textContent = `${percentage}%`;
  }

  function scheduleRatioCheck(): void {
    if (ratioFrame !== null || revealed) return;
    ratioFrame = requestAnimationFrame(() => {
      ratioFrame = null;
      const ratio = getClearedRatio(ctx, canvas);
      updateProgress(ratio);
      if (ratio >= config.threshold) reveal();
    });
  }

  function reveal(): void {
    if (revealed) return;
    revealed = true;
    pointer.active = false;
    updateProgress(1);
    stage.classList.add('is-revealed');
    canvas.style.opacity = '0';
    canvas.style.pointerEvents = 'none';
  }

  function getPoint(event: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function scratchAt(x: number, y: number): void {
    if (revealed || width <= 0 || height <= 0) return;

    const brush = Math.max(24, Math.min(width, height) * 0.1);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brush * 1.65;
    ctx.beginPath();
    ctx.moveTo(pointer.lastX, pointer.lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, brush, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    pointer.lastX = x;
    pointer.lastY = y;
    scheduleRatioCheck();
  }

  const onPointerDown = (event: PointerEvent): void => {
    if (revealed) return;
    event.preventDefault();
    const point = getPoint(event);
    pointer.active = true;
    pointer.lastX = point.x;
    pointer.lastY = point.y;
    canvas.setPointerCapture(event.pointerId);
    scratchAt(point.x, point.y);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!pointer.active || revealed) return;
    event.preventDefault();
    const point = getPoint(event);
    scratchAt(point.x, point.y);
  };

  const onPointerUp = (event: PointerEvent): void => {
    pointer.active = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    scheduleRatioCheck();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);

  requestAnimationFrame(resize);

  return {
    reset,
    destroy: () => {
      if (ratioFrame !== null) cancelAnimationFrame(ratioFrame);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerUp);
    },
  };
}

function getClearedRatio(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): number {
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const sampleStride = 4 * 20;
  let cleared = 0;
  let sampled = 0;

  for (let index = 3; index < data.length; index += sampleStride) {
    sampled += 1;
    if (data[index] < 32) cleared += 1;
  }

  return sampled > 0 ? cleared / sampled : 0;
}

function drawCover(ctx: CanvasRenderingContext2D, theme: ScratchTheme, width: number, height: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, width, height);

  switch (theme) {
    case 'love-foil':
      drawLoveFoil(ctx, width, height);
      break;
    case 'midnight-stars':
      drawMidnightStars(ctx, width, height);
      break;
    case 'secret-note':
      drawSecretNote(ctx, width, height);
      break;
    case 'memory-bloom':
      drawMemoryBloom(ctx, width, height);
      break;
  }

  ctx.restore();
}

function drawLoveFoil(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#ff2f7d');
  gradient.addColorStop(0.35, '#ff82af');
  gradient.addColorStop(0.65, '#b65cff');
  gradient.addColorStop(1, '#6f5cff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  for (let x = -height; x < width + height; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - height, height);
    ctx.stroke();
  }
  ctx.restore();

  const hearts = [
    [0.16, 0.22, 22], [0.82, 0.18, 16], [0.73, 0.73, 24], [0.2, 0.78, 14],
  ] as const;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  hearts.forEach(([x, y, size]) => {
    ctx.font = `${size}px serif`;
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('♥', width * x, height * y);
  });

  drawCenteredCoverLabel(ctx, width, height, 'LOVE NOTE', 'CÀO ĐỂ MỞ', '#ffffff');
}

function drawMidnightStars(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = ctx.createRadialGradient(width * 0.7, height * 0.22, 10, width * 0.5, height * 0.5, width);
  gradient.addColorStop(0, '#3f4b9a');
  gradient.addColorStop(0.45, '#18234f');
  gradient.addColorStop(1, '#090d22');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const stars = [
    [0.08, 0.18, 1.4], [0.17, 0.42, 2.1], [0.28, 0.12, 1.2], [0.39, 0.28, 1.8],
    [0.52, 0.15, 1.3], [0.64, 0.35, 2.2], [0.78, 0.12, 1.5], [0.9, 0.42, 1.2],
    [0.12, 0.75, 1.7], [0.32, 0.86, 1.1], [0.56, 0.75, 1.4], [0.84, 0.82, 2],
  ] as const;
  stars.forEach(([x, y, radius], index) => {
    ctx.beginPath();
    ctx.fillStyle = index % 3 === 0 ? '#ffd8f1' : '#ffffff';
    ctx.globalAlpha = 0.55 + (index % 4) * 0.1;
    ctx.arc(width * x, height * y, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalAlpha = 0.24;
  ctx.fillStyle = '#d9dcff';
  ctx.beginPath();
  ctx.arc(width * 0.82, height * 0.22, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(width * 0.86, height * 0.19, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  drawCenteredCoverLabel(ctx, width, height, 'MIDNIGHT MEMORY', 'VUỐT QUA BẦU TRỜI', '#f8f7ff');
}

function drawSecretNote(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#fff7ed');
  gradient.addColorStop(0.5, '#ffe4e6');
  gradient.addColorStop(1, '#fce7f3');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.24;
  ctx.strokeStyle = '#db8ea6';
  ctx.lineWidth = 1;
  for (let y = 36; y < height; y += 22) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = '#a8557a';
  ctx.lineWidth = 2;
  const envelopeWidth = Math.min(86, width * 0.26);
  const envelopeHeight = envelopeWidth * 0.62;
  const envelopeX = width / 2 - envelopeWidth / 2;
  const envelopeY = height * 0.2;
  ctx.strokeRect(envelopeX, envelopeY, envelopeWidth, envelopeHeight);
  ctx.beginPath();
  ctx.moveTo(envelopeX, envelopeY);
  ctx.lineTo(width / 2, envelopeY + envelopeHeight * 0.58);
  ctx.lineTo(envelopeX + envelopeWidth, envelopeY);
  ctx.stroke();

  drawCenteredCoverLabel(ctx, width, height * 1.1, 'A SECRET FOR YOU', 'CÀO NHẸ THÔI NHÉ', '#8f315c');
}

function drawMemoryBloom(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = ctx.createRadialGradient(width * 0.3, height * 0.25, 10, width * 0.5, height * 0.5, width);
  gradient.addColorStop(0, '#fdf2f8');
  gradient.addColorStop(0.48, '#dbeafe');
  gradient.addColorStop(1, '#ddd6fe');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const petals = [
    [0.14, 0.24, -0.8], [0.82, 0.18, 0.7], [0.72, 0.76, 1.1],
    [0.24, 0.82, -1.2], [0.48, 0.12, 0.2], [0.9, 0.55, 0.9],
  ] as const;

  petals.forEach(([x, y, rotation], index) => {
    ctx.save();
    ctx.translate(width * x, height * y);
    ctx.rotate(rotation);
    ctx.globalAlpha = 0.24 + (index % 3) * 0.07;
    ctx.fillStyle = index % 2 === 0 ? '#ff4f9a' : '#7c3aed';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  ctx.globalAlpha = 0.34;
  ctx.fillStyle = '#ffffff';
  for (let index = 0; index < 18; index += 1) {
    const x = ((index * 47) % 97) / 100;
    const y = ((index * 71) % 89) / 100;
    ctx.beginPath();
    ctx.arc(width * x, height * y, 1 + (index % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  drawCenteredCoverLabel(ctx, width, height, 'MEMORY BLOOM', 'CHẠM VÀ CÀO', '#55378c');
}

function drawCenteredCoverLabel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  title: string,
  subtitle: string,
  color: string,
): void {
  ctx.save();
  ctx.globalAlpha = 0.94;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = "800 17px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText(title, width / 2, height / 2 - 5);
  ctx.globalAlpha = 0.78;
  ctx.font = "700 10px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText(subtitle, width / 2, height / 2 + 19);
  ctx.restore();
}
