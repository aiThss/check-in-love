import '../styles/polaroid-cover.css';

export interface PolaroidCoverOptions {
  imageUrl: string;
  title?: string;
  dateText?: string;
  timerSeconds?: number;
  revealThreshold?: number;
  brushRadius?: number;
  textColumns?: string[];
  onRevealed?: () => void;
}

const DEFAULT_POETRY = [
  "春江潮水连海平海上明月共潮生滟滟随波千万里何处春江无月明",
  "江流宛转绕芳甸月照花林皆似霰空里流霜不觉飞汀上白沙看不见",
  "江天一色无纤尘皎皎空中孤月轮江畔何人初见月江月何年初照人",
  "人生代代无穷已江月年年只相似不知江月待何人but见长江送流水",
  "白云一片去悠悠青枫浦上不胜愁谁家今夜扁舟子何处相思明月楼",
];

class WaterCharNode {
  char: string;
  colIndex: number;
  rowIndex: number;
  x0 = 0;
  y0 = 0;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  phaseX: number;
  phaseY: number;

  constructor(char: string, colIndex: number, rowIndex: number) {
    this.char = char;
    this.colIndex = colIndex;
    this.rowIndex = rowIndex;
    this.phaseX = colIndex * 0.4 + rowIndex * 0.25;
    this.phaseY = colIndex * 0.3 + rowIndex * 0.35;
  }

  updateBase(centerX: number, centerY: number, fontSize: number, colSpacing: number, lineSpacing: number, totalCols: number) {
    const totalWidth = (totalCols - 1) * colSpacing;
    const colX = centerX + totalWidth / 2 - this.colIndex * colSpacing;
    const rowY = centerY - 140 + this.rowIndex * lineSpacing;

    this.x0 = colX;
    this.y0 = rowY;
    if (this.x === 0 && this.y === 0) {
      this.x = colX;
      this.y = rowY;
    }
  }

  step(timeSec: number, pointer: { x: number; y: number; active: boolean }) {
    const waveX = Math.cos(timeSec * 1.6 + this.phaseX) * 3.5;
    const waveY = Math.sin(timeSec * 1.6 + this.phaseY) * 8;

    const targetX = this.x0 + waveX;
    const targetY = this.y0 + waveY;

    const ax = (targetX - this.x) * 0.15;
    const ay = (targetY - this.y) * 0.15;

    this.vx = (this.vx + ax) * 0.92;
    this.vy = (this.vy + ay) * 0.92;

    if (pointer.active) {
      const dx = this.x - pointer.x;
      const dy = this.y - pointer.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 110 && dist > 0.001) {
        const force = (1 - dist / 110) * 10;
        this.vx += (dx / dist) * force;
        this.vy += (dy / dist) * force;
      }
    }

    this.x += this.vx;
    this.y += this.vy;
  }
}

export function openPolaroidCoverModal(options: PolaroidCoverOptions): { close: () => void } {
  const {
    imageUrl,
    title = 'Kỷ niệm ngọt ngào 💖',
    dateText = new Date().toLocaleDateString('vi-VN'),
    timerSeconds = 5,
    revealThreshold = 0.65,
    brushRadius = 45,
    textColumns = DEFAULT_POETRY,
    onRevealed,
  } = options;

  let timerLeft = timerSeconds;
  let timerInterval: number | null = null;
  let animFrameId: number | null = null;
  let isScratching = false;
  let scratchedRatio = 0;
  let isRevealed = false;

  const backdrop = document.createElement('div');
  backdrop.className = 'polaroid-modal-backdrop';

  backdrop.innerHTML = `
    <div class="polaroid-modal-container">
      <button class="polaroid-modal-close" aria-label="Đóng">✕</button>

      <div class="polaroid-stage-view">
        <img class="polaroid-stage-photo" src="${imageUrl}" alt="Memory Photo" />
        <canvas class="polaroid-stage-canvas"></canvas>

        <div class="polaroid-stage-intro">
          <div class="polaroid-card-box">
            <div class="polaroid-card-thumb">
              <img src="${imageUrl}" alt="Polaroid Thumbnail" />
              <div class="polaroid-card-badge">
                <span class="polaroid-timer-num">${timerLeft}s</span>
                <span style="font-size: 11px; opacity: 0.9;">Chuẩn bị màn che chữ...</span>
              </div>
            </div>
            <div class="polaroid-card-footer">
              <span class="polaroid-card-title">${title}</span>
              <span class="polaroid-card-date">${dateText}</span>
            </div>
          </div>
          <button class="polaroid-intro-btn">✍️ Chuyển sang cào màn che chữ</button>
        </div>

        <div class="polaroid-hud hidden">
          <span class="polaroid-hud-text">✨ Vuốt màn hình để tẩy lớp chữ thuỷ ấn!</span>
          <div class="polaroid-hud-progress"><div class="polaroid-hud-bar"></div></div>
          <span class="polaroid-hud-pct">0%</span>
        </div>

        <div class="polaroid-success hidden">
          <span>🎉</span>
          <div>
            <h4>Đã mở khóa bức ảnh!</h4>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const container = backdrop.querySelector('.polaroid-stage-view') as HTMLElement;
  const canvas = backdrop.querySelector('.polaroid-stage-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  const introCard = backdrop.querySelector('.polaroid-stage-intro') as HTMLElement;
  const introBtn = backdrop.querySelector('.polaroid-intro-btn') as HTMLElement;
  const closeBtn = backdrop.querySelector('.polaroid-modal-close') as HTMLElement;
  const timerNum = backdrop.querySelector('.polaroid-timer-num') as HTMLElement;
  const hud = backdrop.querySelector('.polaroid-hud') as HTMLElement;
  const hudBar = backdrop.querySelector('.polaroid-hud-bar') as HTMLElement;
  const hudPct = backdrop.querySelector('.polaroid-hud-pct') as HTMLElement;
  const successBanner = backdrop.querySelector('.polaroid-success') as HTMLElement;

  const maskCanvas = document.createElement('canvas');
  const maskCtx = maskCanvas.getContext('2d')!;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;

  const pointer = { x: -1000, y: -1000, lastX: -1000, lastY: -1000, active: false };
  const nodes: WaterCharNode[] = [];

  for (let c = 0; c < textColumns.length; c++) {
    const colStr = textColumns[c];
    for (let r = 0; r < colStr.length; r++) {
      nodes.push(new WaterCharNode(colStr[r], c, r));
    }
  }

  function resize() {
    const rect = container.getBoundingClientRect();
    width = rect.width;
    height = rect.height;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    maskCanvas.width = Math.round(width * dpr);
    maskCanvas.height = Math.round(height * dpr);
    maskCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    resetMask();

    const fontSize = Math.min(Math.max(width / 22, 16), 26);
    const colSpacing = fontSize * 2.0;
    const lineSpacing = fontSize * 1.3;
    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < nodes.length; i++) {
      nodes[i].updateBase(centerX, centerY, fontSize, colSpacing, lineSpacing, textColumns.length);
    }
  }

  function resetMask() {
    maskCtx.save();
    maskCtx.setTransform(1, 0, 0, 1, 0, 0);
    maskCtx.fillStyle = '#ffffff';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskCtx.restore();
    scratchedRatio = 0;
    updateHUD();
  }

  function updateTimer() {
    timerNum.textContent = `${timerLeft}s`;
  }

  function transitionToScratch() {
    if (timerInterval) clearInterval(timerInterval);
    introCard.classList.add('hidden');
    hud.classList.remove('hidden');
    resetMask();
  }

  function triggerReveal() {
    if (isRevealed) return;
    isRevealed = true;
    hud.classList.add('hidden');
    successBanner.classList.remove('hidden');
    canvas.classList.add('fading');
    if (onRevealed) onRevealed();
  }

  function scratchAt(x: number, y: number) {
    if (isRevealed) return;

    maskCtx.save();
    maskCtx.globalCompositeOperation = 'destination-out';
    maskCtx.beginPath();
    maskCtx.arc(x, y, brushRadius, 0, Math.PI * 2);
    maskCtx.fill();

    if (pointer.lastX > 0 && pointer.lastY > 0) {
      const dist = Math.hypot(x - pointer.lastX, y - pointer.lastY);
      const steps = Math.ceil(dist / 8);
      for (let i = 0; i < steps; i++) {
        const ix = pointer.lastX + (x - pointer.lastX) * (i / steps);
        const iy = pointer.lastY + (y - pointer.lastY) * (i / steps);
        maskCtx.beginPath();
        maskCtx.arc(ix, iy, brushRadius, 0, Math.PI * 2);
        maskCtx.fill();
      }
    }
    maskCtx.restore();

    pointer.lastX = x;
    pointer.lastY = y;
    calcRatio();
  }

  function calcRatio() {
    const imgData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const data = imgData.data;
    let cleared = 0;
    const step = 4 * 16;
    for (let i = 3; i < data.length; i += step) {
      if (data[i] === 0) cleared++;
    }
    scratchedRatio = cleared / (data.length / step);
    updateHUD();

    if (scratchedRatio >= revealThreshold) {
      triggerReveal();
    }
  }

  function updateHUD() {
    const pct = Math.round(scratchedRatio * 100);
    hudBar.style.width = `${pct}%`;
    hudPct.textContent = `${pct}%`;
  }

  // Event Listeners
  const getCoords = (e: MouseEvent | Touch) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: MouseEvent | Touch) => {
    isScratching = true;
    const c = getCoords(e);
    pointer.x = c.x;
    pointer.y = c.y;
    pointer.lastX = c.x;
    pointer.lastY = c.y;
    pointer.active = true;
    scratchAt(c.x, c.y);
  };

  const onMove = (e: MouseEvent | Touch) => {
    const c = getCoords(e);
    pointer.x = c.x;
    pointer.y = c.y;
    pointer.active = true;
    if (isScratching) scratchAt(c.x, c.y);
  };

  const onUp = () => {
    isScratching = false;
    pointer.lastX = -1000;
    pointer.lastY = -1000;
  };

  canvas.addEventListener('mousedown', (e) => onDown(e));
  canvas.addEventListener('mousemove', (e) => onMove(e));
  window.addEventListener('mouseup', onUp);

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) onDown(e.touches[0]);
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) onMove(e.touches[0]);
  }, { passive: true });

  window.addEventListener('touchend', onUp);

  introBtn.addEventListener('click', transitionToScratch);
  closeBtn.addEventListener('click', destroy);

  // Timer interval
  timerInterval = window.setInterval(() => {
    timerLeft--;
    updateTimer();
    if (timerLeft <= 0) {
      transitionToScratch();
    }
  }, 1000);

  // Animation Loop
  let timeSec = 0;
  function loop() {
    timeSec += 0.016;
    ctx.clearRect(0, 0, width, height);

    if (!isRevealed) {
      // Dark Water background
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#060d1a');
      grad.addColorStop(1, '#051120');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Render Text Nodes
      const fontSize = Math.min(Math.max(width / 22, 16), 26);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${fontSize}px "Noto Serif SC", serif`;

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.step(timeSec, pointer);
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.shadowColor = 'rgba(125, 211, 252, 0.5)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = 'rgba(240, 249, 255, 0.9)';
        ctx.fillText(n.char, 0, 0);
        ctx.restore();
      }

      // Clip mask
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(maskCanvas, 0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    }

    animFrameId = requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', resize);
  animFrameId = requestAnimationFrame(loop);

  function destroy() {
    if (timerInterval) clearInterval(timerInterval);
    if (animFrameId) cancelAnimationFrame(animFrameId);
    window.removeEventListener('resize', resize);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('touchend', onUp);
    backdrop.remove();
  }

  return { close: destroy };
}
