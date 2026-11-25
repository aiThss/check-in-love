// Sinh 3 mock HTML tĩnh (A/B/C) từ cùng một markup + CSS riêng từng hướng.
// Chạy: node design/redesign-v2/build-mocks.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));

// ── Bộ icon mẫu (lưới 24×24, mở = nét hở nên fill="none") ───────────────────
const SYMBOLS = {
  home: '<path d="M4 11.2 12 4l8 7.2V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.2H9v5.2H5.5A1.5 1.5 0 0 1 4 19z"/>',
  memories: '<path d="M5 4h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 4z"/><path fill="none" d="M4 16.5l4.2-4 3.3 3 2.3-2 6.2 5"/><circle cx="8.2" cy="8.6" r="1.1"/>',
  lens: '<circle cx="12" cy="12" r="9"/><path d="M12 16.4s-3.7-2.3-3.7-5.1a2.1 2.1 0 0 1 3.7-1.4 2.1 2.1 0 0 1 3.7 1.4c0 2.8-3.7 5.1-3.7 5.1z"/>',
  chat: '<path d="M20.5 11.3a7.5 7 0 0 1-11 6.2L4 19l1.4-4.2a7 7 0 1 1 15.1-3.5z"/>',
  user: '<circle cx="12" cy="8" r="3.7"/><path d="M5 20.2c.8-3.6 3.7-5.4 7-5.4s6.2 1.8 7 5.4z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  send: '<path d="M20.5 4 3.8 10.6l6.2 2.4 2.4 6.2z"/><path fill="none" d="M10 13l10.5-9"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.2"/>',
  reply: '<path fill="none" d="M10 7.5 4.5 12 10 16.5M5 12h8.5a6 6 0 0 1 6 6"/>',
  check2: '<path fill="none" d="M2.8 12.8l3.6 3.6 6-7.2M10.4 16l.8.8 7.4-8.6"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path fill="none" d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  pin: '<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
  flip: '<path fill="none" d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path fill="none" d="M8.5 14.2c1 1.4 2.1 2 3.5 2s2.5-.6 3.5-2M9 9.8h.01M15 9.8h.01"/>',
  wow: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="15.6" r="1.8"/><path fill="none" d="M9 9.6h.01M15 9.6h.01"/>',
  sad: '<circle cx="12" cy="12" r="9"/><path fill="none" d="M8.7 16.3c1-1.2 2-1.7 3.3-1.7s2.3.5 3.3 1.7M9 9.8h.01M15 9.8h.01"/>',
  flash: '<path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12z"/>',
  close: '<path fill="none" d="M6 6l12 12M18 6 6 18"/>',
  gallery: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path fill="none" d="M4.5 16l4.5-4.2 3.5 3 2.5-2 4.5 4"/>',
};
const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(SYMBOLS)
  .map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`)
  .join('')}</defs></svg>`;
const ic = (n, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;

// ── Thành phần dùng chung ────────────────────────────────────────────────────
const status = '<div class="status"><span>9:41</span><span>●●● ▮</span></div>';
const nav = (active) => {
  const item = (key, icon, label) =>
    `<button class="nav-item${active === key ? ' active' : ''}" aria-label="${label}">${ic(icon)}<span>${label}</span></button>`;
  return `<nav class="nav" aria-label="Điều hướng chính">
    ${item('home', 'home', 'Home')}${item('mem', 'memories', 'Kỷ niệm')}
    <button class="nav-checkin${active === 'checkin' ? ' active' : ''}" aria-label="Tạo check-in mới">${ic('lens')}</button>
    ${item('chat', 'chat', 'Tin nhắn')}${item('me', 'user', 'Hồ sơ')}
  </nav>`;
};
const avatar = (t, c = '') => `<span class="avatar ${c}" aria-hidden="true">${t}</span>`;

const screenHome = `<section class="phone" aria-label="Home">${status}<div class="screen">
  <header class="top"><div><p class="eyebrow">Tối thứ Tư</p><h1 class="display">Chào Linh ${ic('heart', 'acc')}</h1></div>
    <div class="pair">${avatar('L', 'a1')}${avatar('M', 'a2')}</div></header>
  <article class="card hero"><p class="eyebrow">Ngày yêu thứ</p>
    <p class="big display">428</p>
    <div class="streak"><span class="chip">${ic('heart')} 12 ngày liên tiếp</span><span class="chip ghost">Còn 3 ngày tới 431</span></div>
    <div class="who"><div>${avatar('L', 'a1')}<small>Đã check-in</small></div><div>${avatar('M', 'a2 dim')}<small>Chưa check-in</small></div></div>
    <button class="btn primary block">${ic('camera')} Check-in ngay</button></article>
  <article class="card polaroid"><div class="photo p1"></div><p class="cap display">Minh vừa gửi một khoảnh khắc</p><small class="muted">12 phút trước · Quán cà phê Nhà Đèn</small></article>
  <h2 class="sec">Gần đây</h2>
  <ul class="list">
    <li class="row">${avatar('M', 'a2')}<div><b>Minh thả tim ảnh của bạn</b><small class="muted">Hôm nay, 20:14</small></div>${ic('heart', 'acc')}</li>
    <li class="row">${avatar('L', 'a1')}<div><b>Bạn đã check-in lúc 08:02</b><small class="muted">Hôm nay</small></div>${ic('check2', 'acc')}</li>
  </ul></div>${nav('home')}</section>`;

const screenChat = `<section class="phone chat" aria-label="Chat">${status}
  <header class="chat-head">${ic('close', 'back')}${avatar('M', 'a2')}<div><b>Minh</b><small class="muted online">đang hoạt động</small></div>${ic('bell')}</header>
  <div class="screen thread"><span class="daychip">Hôm nay</span>
    <div class="msg them first"><p>Em ăn tối chưa?</p></div>
    <div class="msg them last"><p>Anh đặt bàn ở chỗ hôm trước rồi nè</p></div>
    <div class="msg me first"><div class="quote">${ic('reply')}<span>Anh đặt bàn ở chỗ hôm trước rồi nè</span></div><p>Ôi thật hả, chỗ có đèn lồng đúng không 🥹</p></div>
    <div class="msg me last"><p>Em ra liền!</p><span class="meta">20:11 ${ic('check2', 'seen')}</span></div>
    <div class="msg them imgmsg"><div class="photo p2"></div><span class="react">${ic('heart')}</span></div>
    <div class="typing"><i></i><i></i><i></i></div></div>
  <div class="composer">${ic('camera')}<div class="field">Nhắn gì đó cho Minh…</div><button class="send" aria-label="Gửi">${ic('send')}</button></div></section>`;

const screenCheckin = `<section class="phone cam" aria-label="Check-in">${status}
  <div class="viewfinder"><div class="grid3"></div><div class="focus"></div></div>
  <div class="cam-top"><button class="circle" aria-label="Đóng">${ic('close')}</button><button class="circle" aria-label="Flash">${ic('flash')}</button></div>
  <div class="cam-note"><span class="chip">${ic('pin')} Quán cà phê Nhà Đèn</span></div>
  <div class="cam-bottom"><button class="circle" aria-label="Thư viện">${ic('gallery')}</button>
    <button class="shutter" aria-label="Chụp"><i></i></button><button class="circle" aria-label="Đổi camera">${ic('flip')}</button></div></section>`;

const tile = (c, span = '') => `<div class="tile ${c} ${span}"><span class="count">${ic('heart')}3</span></div>`;
const screenMem = `<section class="phone" aria-label="Kỷ niệm">${status}<div class="screen">
  <header class="top"><div><p class="eyebrow">Kỷ niệm</p><h1 class="display">Tháng 11</h1></div><button class="circle" aria-label="Bản đồ">${ic('pin')}</button></header>
  <div class="seg"><button class="on">Tất cả</button><button>Của mình</button><button>Của Minh</button></div>
  <div class="masonry">${tile('p1', 'tall')}${tile('p3')}${tile('p2')}${tile('p4', 'tall')}${tile('p5')}${tile('p6')}${tile('p2')}${tile('p1')}</div>
  </div>${nav('mem')}</section>`;

const screenMe = `<section class="phone" aria-label="Hồ sơ">${status}<div class="screen">
  <article class="card couple"><div class="pair big">${avatar('L', 'a1')}<span class="knot">${ic('heart')}</span>${avatar('M', 'a2')}</div>
    <h1 class="display">Linh &amp; Minh</h1><p class="muted">Bên nhau từ 24/09/2025</p></article>
  <h2 class="sec">Giao diện</h2>
  <div class="card group">
    <div class="row"><b>Chế độ</b><div class="seg mini"><button class="on">Sáng</button><button>Tối</button><button>Máy</button></div></div>
    <div class="row"><b>Màu nhấn</b><div class="dots"><i class="d1 on"></i><i class="d2"></i><i class="d3"></i><i class="d4"></i><i class="d5"></i></div></div>
    <div class="row"><b>Giảm chuyển động</b><span class="switch"></span></div></div>
  <h2 class="sec">Thông báo</h2>
  <div class="card group">
    <div class="row">${ic('bell')}<b>Thông báo đẩy</b><span class="switch on"></span></div>
    <div class="row">${ic('chat')}<b>Tin nhắn mới</b><span class="switch on"></span></div></div>
  <button class="btn danger block">Đăng xuất</button></div>${nav('me')}</section>`;

const comps = `<section class="phone comps" aria-label="Component">${status}<div class="screen">
  <h2 class="sec">Nút</h2>
  <div class="btns"><button class="btn primary">Check-in</button><button class="btn secondary">Để sau</button><button class="btn ghost">Bỏ qua</button><button class="btn danger">Xoá</button><button class="btn primary" disabled>Đang gửi</button><button class="circle" aria-label="Gửi">${ic('send')}</button></div>
  <h2 class="sec">Icon mẫu (outline · active = filled)</h2>
  <div class="icons">${['home', 'memories', 'lens', 'chat', 'user', 'heart', 'send', 'camera', 'reply', 'check2', 'bell', 'pin']
    .map((n, i) => `<div class="icell${i % 4 === 0 ? ' on' : ''}">${ic(n)}<small>${n}</small></div>`)
    .join('')}</div>
  </div>
  <div class="scrim"></div>
  <div class="sheet"><i class="grab"></i>
    <div class="reactbar"><span>${ic('heart')}</span><span>${ic('smile')}</span><span>${ic('wow')}</span><span>${ic('sad')}</span></div>
    <div class="row">${ic('reply')}<b>Trả lời</b></div><div class="row">${ic('send')}<b>Chuyển tiếp</b></div><div class="row del">${ic('close')}<b>Thu hồi</b></div></div></section>`;

// ── CSS dùng chung (đọc biến theo hướng) ────────────────────────────────────
const BASE = `
*{box-sizing:border-box;margin:0}
html{color-scheme:light dark}
body{font-family:var(--font-body);background:var(--stage);color:var(--text);padding:24px;min-height:100vh}
.bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:0 auto 20px;max-width:1500px}
.bar h1{font:700 18px var(--font-body);flex:1;min-width:260px}
.bar a,.bar button{font:600 13px var(--font-body);padding:8px 14px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;text-decoration:none}
.stage{display:flex;flex-wrap:wrap;gap:28px;justify-content:center;max-width:1500px;margin:0 auto}
.phone{width:390px;height:844px;border-radius:44px;overflow:hidden;position:relative;background:var(--page);box-shadow:0 30px 70px rgba(60,10,30,.28),0 0 0 8px var(--bezel);isolation:isolate}
.status{position:absolute;inset:0 0 auto 0;height:47px;display:flex;justify-content:space-between;align-items:flex-end;padding:0 28px 6px;font:600 14px var(--font-body);z-index:5;color:var(--text)}
.screen{height:100%;overflow:hidden;padding:60px 20px 120px}
.ic{width:24px;height:24px;stroke:currentColor;stroke-width:var(--ic-sw);stroke-linecap:round;stroke-linejoin:round;fill:var(--ic-fill,none);flex:none;transition:fill .2s}
.ic.acc{color:var(--accent-strong)}
.muted{color:var(--text-3);font-size:13px}small{font-size:12px}
.eyebrow{font:600 12px var(--font-body);letter-spacing:.08em;text-transform:uppercase;color:var(--text-3)}
.display{font-family:var(--font-display);font-weight:var(--display-w);letter-spacing:var(--display-ls)}
h1.display{font-size:28px;line-height:1.15}.sec{font:700 15px var(--font-body);margin:22px 0 10px}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.card{background:var(--surface);border:var(--card-border);border-radius:var(--r-card);box-shadow:var(--shadow);padding:18px;margin-bottom:14px;position:relative}
.hero .big{font-size:76px;line-height:1;margin:2px 0 12px;color:var(--accent-strong)}
.streak{display:flex;gap:8px;flex-wrap:wrap}.who{display:flex;gap:28px;margin:16px 0}.who>div{display:flex;align-items:center;gap:10px}
.chip{display:inline-flex;align-items:center;gap:6px;font:600 12px var(--font-body);padding:6px 10px;border-radius:999px;background:var(--accent-soft);color:var(--accent-ink)}
.chip .ic{width:14px;height:14px}.chip.ghost{background:transparent;border:1px solid var(--border);color:var(--text-2)}
.avatar{width:40px;height:40px;border-radius:50%;display:inline-grid;place-items:center;font:700 15px var(--font-body);color:#fff;border:var(--av-border)}
.a1{background:linear-gradient(135deg,#ff6b9d,#c2185b)}.a2{background:linear-gradient(135deg,#8e6bff,#4a2fb0)}.dim{opacity:.45}
.pair{display:flex}.pair .avatar+.avatar{margin-left:-10px}.pair.big .avatar{width:64px;height:64px;font-size:24px}
.knot{width:34px;height:34px;border-radius:50%;background:var(--surface);display:grid;place-items:center;margin:0 -8px;z-index:2;color:var(--accent-strong);box-shadow:var(--shadow)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 20px;font:700 15px var(--font-body);border-radius:var(--r-btn);border:var(--btn-border);cursor:pointer;transition:transform .15s,filter .15s;color:var(--text);background:var(--surface)}
.btn:active{transform:var(--press)}.btn.block{width:100%}
.btn.primary{background:var(--accent-strong);color:#fff;box-shadow:var(--btn-shadow)}.btn.secondary{background:var(--accent-soft);color:var(--accent-ink)}
.btn.ghost{background:transparent;border-color:transparent;color:var(--accent-ink)}.btn.danger{background:transparent;color:var(--danger);border-color:var(--danger);margin-top:18px}
.btn:disabled{opacity:.5;cursor:not-allowed}.btns{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.circle{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--surface);border:var(--btn-border);color:var(--text);cursor:pointer}
.photo{border-radius:calc(var(--r-card) - 8px);aspect-ratio:16/10;width:100%}
.p1{background:radial-gradient(circle at 70% 25%,#ffe3a3,transparent 40%),linear-gradient(160deg,#ff9a9e,#fad0c4 55%,#a18cd1)}
.p2{background:linear-gradient(200deg,#f6d365,#fda085)}.p3{background:linear-gradient(160deg,#84fab0,#8fd3f4)}
.p4{background:linear-gradient(160deg,#a18cd1,#fbc2eb)}.p5{background:linear-gradient(160deg,#fccb90,#d57eeb)}.p6{background:linear-gradient(160deg,#ff758c,#ff7eb3)}
.cap{font-size:18px;margin:12px 0 2px}.list{list-style:none;padding:0}
.row{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 2px}.row>div{flex:1;display:flex;flex-direction:column;gap:2px}.row>.seg.mini,.row>.dots{flex:none;flex-direction:row}.row b{font-size:14px;flex:1}
.group .row+.row{border-top:1px solid var(--border)}
.nav{position:absolute;left:var(--nav-x);right:var(--nav-x);bottom:var(--nav-b);height:var(--nav-h);display:flex;align-items:center;justify-content:space-around;background:var(--nav-bg);border:var(--nav-border);border-radius:var(--nav-r);backdrop-filter:var(--nav-blur);-webkit-backdrop-filter:var(--nav-blur);box-shadow:var(--shadow);z-index:6;padding:0 6px}
.nav-item{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:56px;min-height:48px;justify-content:center;border:0;background:none;font:600 11px var(--font-body);color:var(--text-2);cursor:pointer;border-radius:16px;position:relative}
.nav-item.active{color:var(--accent-ink)}.nav-item.active .ic{--ic-fill:currentColor;fill:color-mix(in srgb,currentColor 22%,transparent)}
.nav-checkin{width:60px;height:60px;border-radius:50%;border:var(--ck-border);background:var(--accent-strong);color:#fff;display:grid;place-items:center;margin-top:-26px;box-shadow:var(--ck-shadow);cursor:pointer}
.nav-checkin .ic{width:30px;height:30px;--ic-fill:rgba(255,255,255,.3)}
.chat-head{position:absolute;inset:47px 0 auto 0;height:64px;display:flex;align-items:center;gap:12px;padding:0 18px;background:var(--head-bg);backdrop-filter:var(--nav-blur);border-bottom:1px solid var(--border);z-index:4}.chat-head>div{flex:1;display:flex;flex-direction:column}
.online::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#2fbf71;margin-right:6px}
.thread{padding:124px 16px 96px;display:flex;flex-direction:column;gap:4px}
.daychip{align-self:center;font:600 11px var(--font-body);padding:4px 10px;border-radius:999px;background:var(--surface);color:var(--text-3);margin-bottom:8px}
.msg{max-width:78%;padding:10px 14px;font-size:15px;line-height:1.35;position:relative}
.msg p{margin:0}.them{align-self:flex-start;background:var(--b-them);color:var(--b-them-t);border:var(--b-border)}.me{align-self:flex-end;background:var(--b-me);color:var(--b-me-t);border:var(--b-border-me,none)}
.them{border-radius:var(--b-r) var(--b-r) var(--b-r) 6px}.them.first{border-bottom-left-radius:6px}.them.last{border-radius:6px var(--b-r) var(--b-r) var(--b-r);margin-bottom:8px}
.me{border-radius:var(--b-r) var(--b-r) 6px var(--b-r)}.me.last{margin-bottom:6px}
.meta{display:flex;align-items:center;justify-content:flex-end;gap:4px;font-size:11px;opacity:.85;margin-top:2px}.meta .ic{width:16px;height:16px}.seen{color:var(--seen)}
.quote{display:flex;gap:6px;align-items:center;font-size:12px;opacity:.9;border-left:3px solid currentColor;padding:2px 8px;margin-bottom:6px;border-radius:4px;background:rgba(255,255,255,.18)}.quote .ic{width:14px;height:14px}
.imgmsg{padding:5px;width:220px;background:var(--b-them)}.imgmsg .photo{aspect-ratio:1;border-radius:calc(var(--b-r) - 4px)}
.react{position:absolute;right:-6px;bottom:-12px;width:28px;height:28px;border-radius:50%;background:var(--surface);display:grid;place-items:center;color:var(--accent-strong);box-shadow:var(--shadow);border:var(--b-border)}.react .ic{width:16px;height:16px;--ic-fill:currentColor}
.typing{align-self:flex-start;display:flex;gap:4px;padding:12px 14px;background:var(--b-them);border-radius:var(--b-r);margin-top:14px;border:var(--b-border)}.typing i{width:7px;height:7px;border-radius:50%;background:var(--text-3);animation:bob 1s infinite}.typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}
@keyframes bob{50%{transform:translateY(-4px)}}
.composer{position:absolute;left:12px;right:12px;bottom:18px;display:flex;align-items:center;gap:8px;padding:8px;border-radius:var(--r-comp);background:var(--nav-bg);backdrop-filter:var(--nav-blur);border:var(--nav-border);box-shadow:var(--shadow);z-index:4}
.composer>.ic{margin:0 6px;color:var(--text-2)}.field{flex:1;color:var(--text-3);font-size:15px;padding:10px 4px}
.send{width:44px;height:44px;border-radius:50%;border:var(--btn-border);background:var(--accent-strong);color:#fff;display:grid;place-items:center;cursor:pointer}
.cam{background:#120a10;color:#fff}.cam .status{color:#fff}.viewfinder{position:absolute;inset:0;background:radial-gradient(circle at 60% 40%,#7a3f5d,#2b1424 60%,#120a10)}
.grid3{position:absolute;inset:130px 0 200px;background:linear-gradient(transparent 33%,rgba(255,255,255,.18) 33.3%,transparent 33.6%,transparent 66%,rgba(255,255,255,.18) 66.3%,transparent 66.6%),linear-gradient(90deg,transparent 33%,rgba(255,255,255,.18) 33.3%,transparent 33.6%,transparent 66%,rgba(255,255,255,.18) 66.3%,transparent 66.6%)}
.focus{position:absolute;left:50%;top:44%;width:84px;height:84px;margin:-42px;border:2px solid #ffd54f;border-radius:20px}
.cam-top{position:absolute;top:60px;left:18px;right:18px;display:flex;justify-content:space-between;z-index:3}.cam .circle{background:rgba(255,255,255,.16);color:#fff;border-color:rgba(255,255,255,.3)}
.cam-note{position:absolute;top:122px;left:0;right:0;display:flex;justify-content:center}.cam .chip{background:rgba(0,0,0,.4);color:#fff}
.cam-bottom{position:absolute;left:0;right:0;bottom:44px;display:flex;justify-content:space-around;align-items:center}
.shutter{width:84px;height:84px;border-radius:50%;border:4px solid #fff;background:transparent;display:grid;place-items:center;cursor:pointer}.shutter i{width:64px;height:64px;border-radius:50%;background:var(--accent-strong);transition:transform .15s}.shutter:active i{transform:scale(.88)}
.seg{display:flex;padding:4px;border-radius:999px;background:var(--surface);border:var(--card-border);gap:2px;margin-bottom:14px}.seg button{flex:1;min-height:36px;border:0;border-radius:999px;background:transparent;font:600 13px var(--font-body);color:var(--text-2);cursor:pointer}.seg .on{background:var(--accent-strong);color:#fff}
.seg.mini{margin:0;flex:none}.seg.mini button{padding:0 12px;flex:none}
.masonry{columns:2;column-gap:10px}.tile{position:relative;border-radius:var(--r-tile);margin-bottom:10px;aspect-ratio:1;break-inside:avoid;border:var(--tile-border)}.tile.tall{aspect-ratio:3/4}
.count{position:absolute;left:8px;bottom:8px;display:flex;align-items:center;gap:4px;font:700 11px var(--font-body);padding:3px 8px;border-radius:999px;background:rgba(0,0,0,.42);color:#fff}.count .ic{width:12px;height:12px;--ic-fill:#ff7aa8}
.couple{text-align:center;padding-top:26px;margin-top:6px}.couple .pair{justify-content:center;margin-bottom:12px}
.dots{display:flex;gap:10px}.dots i{width:26px;height:26px;border-radius:50%;display:block}.dots .on{outline:3px solid var(--text);outline-offset:2px}
.d1{background:#ff3b7f}.d2{background:#ff7a45}.d3{background:#8e6bff}.d4{background:#14b8a6}.d5{background:#3b82f6}
.switch{width:50px;height:30px;border-radius:999px;background:var(--border);position:relative;flex:none}.switch::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.3);transition:transform .2s}.switch.on{background:var(--accent-strong)}.switch.on::after{transform:translateX(20px)}
.icons{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.icell{display:grid;place-items:center;gap:6px;padding:12px 4px;border-radius:var(--r-tile);background:var(--surface);border:var(--card-border)}.icell small{color:var(--text-3)}.icell.on{color:var(--accent-ink)}.icell.on .ic{--ic-fill:currentColor}
.scrim{position:absolute;inset:0;background:rgba(20,5,15,.38);z-index:7}.sheet{position:absolute;left:0;right:0;bottom:0;z-index:8;background:var(--sheet-bg);backdrop-filter:var(--nav-blur);border-radius:var(--r-sheet) var(--r-sheet) 0 0;padding:10px 20px 28px;box-shadow:0 -10px 40px rgba(0,0,0,.2);border:var(--nav-border)}
.grab{display:block;width:40px;height:5px;border-radius:3px;background:var(--border);margin:0 auto 12px}.reactbar{display:flex;justify-content:space-around;padding:10px;border-radius:999px;background:var(--surface);margin-bottom:8px;box-shadow:var(--shadow)}.reactbar .ic{width:30px;height:30px;color:var(--accent-strong)}.reactbar span:first-child .ic{--ic-fill:currentColor}
.sheet .del{color:var(--danger)}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
:focus-visible{outline:3px solid var(--accent-strong);outline-offset:2px}
`;

// ── Mỗi hướng: biến + CSS đặc trưng ─────────────────────────────────────────
const grain = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 .4 0 0 0 0 .2 0 0 0 0 .25 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const DIRS = {
  a: {
    file: 'mock-a-editorial.html',
    title: 'A — Soft Editorial Romance',
    css: `
:root{--font-body:ui-sans-serif,'Be Vietnam Pro',system-ui,sans-serif;--font-display:'Iowan Old Style','Palatino Linotype',Georgia,serif;--display-w:600;--display-ls:-.01em;
--stage:#e9cfd6;--bezel:#2a1a22;--page:#f8e2e7;--surface:#fff8f4;--text:#1f0f15;--text-2:#5e404b;--text-3:#7a5b66;--border:rgba(120,50,75,.2);
--accent:#ff3b7f;--accent-strong:#d9205f;--accent-ink:#b4124b;--accent-soft:#ffdbe6;--danger:#b3261e;--on-accent:#fff;
--r-card:22px;--r-btn:16px;--r-tile:14px;--r-sheet:28px;--r-comp:26px;--card-border:1px solid rgba(120,50,75,.16);--btn-border:1px solid transparent;
--shadow:0 1px 0 rgba(255,255,255,.9) inset,0 10px 24px rgba(150,40,75,.10);--btn-shadow:0 6px 14px rgba(217,32,95,.28);--press:scale(.97);
--ic-sw:1.6;--ic-fill:none;--av-border:2px solid var(--surface);
--nav-bg:rgba(255,248,244,.82);--nav-blur:blur(14px) saturate(160%);--nav-border:1px solid rgba(120,50,75,.14);--nav-x:14px;--nav-b:14px;--nav-h:72px;--nav-r:26px;
--ck-border:4px solid #fff8f4;--ck-shadow:0 8px 18px rgba(217,32,95,.4);--head-bg:rgba(248,226,231,.85);--sheet-bg:rgba(255,248,244,.94);
--b-r:20px;--b-me:#d9205f;--b-me-t:#fff;--b-them:#fff8f4;--b-them-t:#1f0f15;--b-border:1px solid rgba(120,50,75,.14);--seen:#ffe7ef;--tile-border:0}
[data-theme=dark]{--stage:#1a0f17;--bezel:#0c0509;--page:linear-gradient(180deg,#261824,#342039 52%,#632d4d);--surface:#3a2230;--text:#fff;--text-2:#d7c4cd;--text-3:#b8a2ad;--border:rgba(255,164,198,.22);
--accent-soft:rgba(255,59,127,.2);--accent-ink:#ff8fb6;--accent-strong:#e0246a;--danger:#ff8a80;--shadow:0 12px 30px rgba(0,0,0,.35),0 1px 0 rgba(255,255,255,.06) inset;
--card-border:1px solid rgba(255,164,198,.16);--nav-bg:rgba(58,34,48,.82);--nav-border:1px solid rgba(255,164,198,.18);--ck-border:4px solid #3a2230;--head-bg:rgba(38,24,36,.85);--sheet-bg:rgba(58,34,48,.96);
--b-them:#3f2635;--b-them-t:#fff;--b-border:1px solid rgba(255,164,198,.14)}
.phone::before{content:"";position:absolute;inset:0;background-image:${grain};opacity:.7;pointer-events:none;z-index:1;mix-blend-mode:multiply}
[data-theme=dark] .phone::before{mix-blend-mode:screen;opacity:.25}
.polaroid{padding:14px 14px 18px;transform:rotate(-1.6deg);border-radius:6px;box-shadow:0 14px 30px rgba(150,40,75,.18),0 1px 0 #fff inset}
.polaroid .photo{border-radius:3px;aspect-ratio:1.55}.polaroid::after{content:"";position:absolute;top:-10px;left:50%;width:76px;height:22px;margin-left:-38px;background:rgba(255,210,222,.7);transform:rotate(3deg);border:1px solid rgba(120,50,75,.12)}
.hero .big{font-style:italic}.sec{font-family:var(--font-display);font-size:18px;font-weight:600}
.tile{border-radius:4px;box-shadow:0 6px 14px rgba(150,40,75,.14);border:6px solid #fff8f4;border-bottom-width:22px}
[data-theme=dark] .tile{border-color:#3a2230}
.tile:nth-child(odd){transform:rotate(-1deg)}.tile:nth-child(even){transform:rotate(1.2deg)}
.nav-item.active::after{content:"";position:absolute;bottom:-2px;width:18px;height:3px;border-radius:2px;background:var(--accent-strong)}`,
  },
  b: {
    file: 'mock-b-liquid.html',
    title: 'B — Liquid Glass 2.0',
    css: `
:root{--font-body:-apple-system,BlinkMacSystemFont,'SF Pro Text','Be Vietnam Pro','Segoe UI',system-ui,sans-serif;--font-display:-apple-system,'SF Pro Display','Be Vietnam Pro','Segoe UI',system-ui,sans-serif;--display-w:800;--display-ls:-.03em;
--stage:#efd3dc;--bezel:#1d1218;--page:radial-gradient(circle at 85% 6%,#ffb3cf,transparent 42%),radial-gradient(circle at 5% 70%,#d9c2ff,transparent 45%),radial-gradient(circle at 80% 95%,#ffd9b8,transparent 40%),#f8e2e7;
--surface:rgba(255,255,255,.62);--text:#1f0f15;--text-2:#5a3d48;--text-3:#745662;--border:rgba(255,255,255,.7);
--accent:#ff3b7f;--accent-strong:#dd2468;--accent-ink:#b4124b;--accent-soft:rgba(255,59,127,.14);--danger:#b3261e;
--r-card:30px;--r-btn:999px;--r-tile:22px;--r-sheet:34px;--r-comp:999px;--card-border:1px solid rgba(255,255,255,.75);--btn-border:1px solid rgba(255,255,255,.55);
--shadow:0 18px 40px -8px rgba(180,40,80,.18),0 1px 1px rgba(255,255,255,.95) inset,0 -1px 1px rgba(255,255,255,.4) inset;--btn-shadow:0 10px 22px rgba(221,36,104,.35),0 1px 1px rgba(255,255,255,.5) inset;--press:scale(.96);
--ic-sw:1.5;--ic-fill:color-mix(in srgb,currentColor 14%,transparent);--av-border:2px solid rgba(255,255,255,.8);
--nav-bg:rgba(255,255,255,.55);--nav-blur:blur(28px) saturate(190%);--nav-border:1px solid rgba(255,255,255,.8);--nav-x:18px;--nav-b:18px;--nav-h:70px;--nav-r:999px;
--ck-border:1px solid rgba(255,255,255,.6);--ck-shadow:0 12px 26px rgba(221,36,104,.45),0 1px 2px rgba(255,255,255,.7) inset;--head-bg:rgba(255,255,255,.5);--sheet-bg:rgba(255,255,255,.72);
--b-r:24px;--b-me:linear-gradient(160deg,#ff5c97,#dd2468);--b-me-t:#fff;--b-them:rgba(255,255,255,.7);--b-them-t:#1f0f15;--b-border:1px solid rgba(255,255,255,.8);--seen:#fff;--tile-border:1px solid rgba(255,255,255,.7)}
[data-theme=dark]{--stage:#160c13;--bezel:#07030a;--page:radial-gradient(circle at 85% 6%,rgba(255,83,145,.38),transparent 40%),radial-gradient(circle at 5% 72%,rgba(142,87,218,.35),transparent 45%),linear-gradient(180deg,#261824,#342039 55%,#4b2342);
--surface:rgba(60,34,52,.6);--text:#fff;--text-2:#dccbd3;--text-3:#bba5b0;--border:rgba(255,170,205,.24);--accent-ink:#ff8fb6;--accent-soft:rgba(255,59,127,.22);--danger:#ff8a80;
--card-border:1px solid rgba(255,170,205,.22);--shadow:0 18px 44px -6px rgba(0,0,0,.5),0 1px 1px rgba(255,255,255,.14) inset;--nav-bg:rgba(52,30,46,.6);--nav-border:1px solid rgba(255,170,205,.28);--head-bg:rgba(38,24,36,.55);--sheet-bg:rgba(48,28,42,.78);
--b-them:rgba(70,40,60,.7);--b-them-t:#fff;--b-border:1px solid rgba(255,170,205,.2);--tile-border:1px solid rgba(255,170,205,.25)}
.card,.seg,.icell,.composer,.nav,.chat-head,.sheet,.reactbar{backdrop-filter:var(--nav-blur);-webkit-backdrop-filter:var(--nav-blur)}
.card::before{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(135deg,rgba(255,255,255,.6),transparent 38%);pointer-events:none;opacity:.6}
.hero .big{background:linear-gradient(120deg,#ff5c97,#8e6bff);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:900}
.btn.primary,.send,.nav-checkin,.seg .on{background:linear-gradient(160deg,#ff5c97,#dd2468)}
.nav-item.active{background:rgba(255,255,255,.55);box-shadow:0 1px 1px rgba(255,255,255,.9) inset,0 6px 14px rgba(180,40,80,.14)}
[data-theme=dark] .nav-item.active{background:rgba(255,255,255,.12)}
.tile{box-shadow:0 12px 24px -6px rgba(180,40,80,.3)}`,
  },
  c: {
    file: 'mock-c-sticker.html',
    title: 'C — Playful Sticker',
    css: `
:root{--font-body:ui-rounded,'SF Pro Rounded','Nunito','Be Vietnam Pro','Arial Rounded MT Bold',system-ui,sans-serif;--font-display:ui-rounded,'SF Pro Rounded','Nunito','Arial Rounded MT Bold',system-ui,sans-serif;--display-w:900;--display-ls:-.02em;
--stage:#ffc7da;--bezel:#1f0f15;--page:#ffd6e6;--surface:#fff;--text:#1f0f15;--text-2:#4a2a37;--text-3:#6b4756;--border:#1f0f15;
--accent:#ff3b7f;--accent-strong:#e0246a;--accent-ink:#a50f46;--accent-soft:#ffeaa7;--danger:#b3261e;
--r-card:24px;--r-btn:18px;--r-tile:18px;--r-sheet:30px;--r-comp:24px;--card-border:3px solid #1f0f15;--btn-border:3px solid #1f0f15;
--shadow:4px 5px 0 #1f0f15;--btn-shadow:3px 4px 0 #1f0f15;--press:translate(3px,4px);--ic-sw:2.3;--ic-fill:none;--av-border:3px solid #1f0f15;
--nav-bg:#fff;--nav-blur:none;--nav-border:3px solid #1f0f15;--nav-x:12px;--nav-b:12px;--nav-h:72px;--nav-r:26px;
--ck-border:3px solid #1f0f15;--ck-shadow:3px 4px 0 #1f0f15;--head-bg:#fff;--sheet-bg:#fff;
--b-r:20px;--b-me:#e0246a;--b-me-t:#fff;--b-them:#fff;--b-them-t:#1f0f15;--b-border:3px solid #1f0f15;--b-border-me:3px solid #1f0f15;--seen:#ffeaa7;--tile-border:3px solid #1f0f15}
[data-theme=dark]{--stage:#1b0d19;--bezel:#07030a;--page:#2a1428;--surface:#3b2038;--text:#fff;--text-2:#f0d7e4;--text-3:#cdb0c0;--border:#ffb3d1;
--accent-soft:#5a3b00;--accent-ink:#ffd36b;--danger:#ff8a80;--card-border:3px solid #ffb3d1;--btn-border:3px solid #ffb3d1;--shadow:4px 5px 0 #0c0509;--btn-shadow:3px 4px 0 #0c0509;
--av-border:3px solid #ffb3d1;--nav-bg:#3b2038;--nav-border:3px solid #ffb3d1;--ck-border:3px solid #ffb3d1;--ck-shadow:3px 4px 0 #0c0509;--head-bg:#3b2038;--sheet-bg:#3b2038;
--b-them:#3b2038;--b-them-t:#fff;--b-border:3px solid #ffb3d1;--b-border-me:3px solid #ffb3d1;--tile-border:3px solid #ffb3d1}
.ic{filter:drop-shadow(1.5px 2px 0 color-mix(in srgb,currentColor 28%,transparent))}
.nav-item.active{color:var(--text)}.nav-item.active .ic{fill:#ffd36b;--ic-fill:#ffd36b;stroke:var(--text)}
.nav-item.active::before{content:"";position:absolute;top:2px;width:44px;height:30px;border-radius:12px;background:#ffeaa7;border:2.5px solid var(--text);z-index:-1;transform:rotate(-4deg)}
[data-theme=dark] .nav-item.active::before{background:#5a3b00;border-color:#ffd36b}
[data-theme=dark] .nav-item.active .ic{fill:#ffd36b;stroke:#ffd36b}
.polaroid{transform:rotate(1.4deg)}.polaroid .photo{border:3px solid var(--text);border-radius:14px}
.hero .big{-webkit-text-stroke:2px var(--text);color:#ffd36b;text-shadow:4px 4px 0 var(--text);font-size:84px}
.chip{border:2.5px solid var(--text);background:#ffeaa7;color:#1f0f15;font-weight:800}[data-theme=dark] .chip{background:#5a3b00;color:#ffd36b;border-color:#ffd36b}
.btn,.circle,.send,.nav-checkin,.card{transition:transform .12s,box-shadow .12s}.btn:active,.send:active,.nav-checkin:active{box-shadow:0 0 0 #000}
.btn.danger{box-shadow:var(--btn-shadow)}.btn.ghost{border:3px dashed var(--border)}
.tile:nth-child(3n){transform:rotate(-1.5deg)}.tile:nth-child(3n+1){transform:rotate(1.2deg)}
.msg{box-shadow:3px 3px 0 var(--text)}.react,.knot{border:3px solid var(--text)}.seg .on{border:2px solid var(--text);box-shadow:2px 3px 0 var(--text)}
.sec{font-weight:900;font-size:17px}.reactbar{border:3px solid var(--text)}.shutter i{border:3px solid var(--text)}`,
  },
};

// ── Ráp trang ────────────────────────────────────────────────────────────────
const links = (cur) =>
  Object.entries(DIRS)
    .map(([k, d]) => `<a href="${d.file}"${k === cur ? ' aria-current="page"' : ''}>${k.toUpperCase()}</a>`)
    .join('');

for (const [key, d] of Object.entries(DIRS)) {
  const html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mock ${d.title}</title><style>${BASE}${d.css}</style></head>
<body><div class="bar"><h1>Check IN Love · Redesign v2 · ${d.title}</h1>${links(key)}<a href="index.html">So sánh</a>
<button id="t" aria-pressed="false">🌙 Dark / ☀️ Light</button></div>
${sprite}
<main class="stage">${screenHome}${screenChat}${screenCheckin}${screenMem}${screenMe}${comps}</main>
<script>
const r=document.documentElement,b=document.getElementById('t');
const dark=new URLSearchParams(location.search).get('theme')==='dark';
if(dark){r.dataset.theme='dark';b.setAttribute('aria-pressed','true')}
b.onclick=()=>{const d=r.dataset.theme==='dark';r.dataset.theme=d?'light':'dark';b.setAttribute('aria-pressed',String(!d))};
</script></body></html>`;
  writeFileSync(join(OUT, d.file), html, 'utf8');
}

const cards = Object.values(DIRS)
  .map(
    (d) =>
      `<a class="c" href="${d.file}"><h2>${d.title}</h2><p>Mở mock (6 khung: Home, Chat, Check-in, Memories, Profile, Component)</p></a>`,
  )
  .join('');
writeFileSync(
  join(OUT, 'index.html'),
  `<!DOCTYPE html><html lang="vi"><meta charset="utf-8"><title>Redesign v2 — 3 hướng</title>
<style>body{font:16px system-ui;background:#f8e2e7;color:#1f0f15;max-width:760px;margin:40px auto;padding:0 20px}.c{display:block;background:#fff;border-radius:18px;padding:20px;margin:14px 0;text-decoration:none;color:inherit;box-shadow:0 8px 24px rgba(150,40,75,.12)}h2{margin:0 0 6px}</style>
<h1>Check IN Love · Redesign v2</h1><p>Chọn 1 hướng (hoặc trộn). Thêm <code>?theme=dark</code> vào URL để mở sẵn dark.</p>${cards}</html>`,
  'utf8',
);
console.log('Đã sinh:', Object.values(DIRS).map((d) => d.file).join(', '), '+ index.html');
