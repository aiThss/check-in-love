export interface LoadingDemo {
  id: string;
  name: string;
  description: string;
  markup: string;
}

export const loadingDemos: LoadingDemo[] = [
  {
    id: 'heartbeat',
    name: 'Nhịp tim',
    description: 'Trái tim đập nhẹ, hai vòng sáng lan ra.',
    markup: `<svg class="ld-heartbeat" viewBox="0 0 120 120" role="img" aria-label="Loading nhịp tim">
      <style>
        .ld-heartbeat .core{transform-box:fill-box;transform-origin:center;animation:ld-hb-core 1.45s ease-in-out infinite}.ld-heartbeat .ring{transform-origin:60px 60px;animation:ld-hb-ring 1.45s ease-out infinite}.ld-heartbeat .r2{animation-delay:.5s}
        @keyframes ld-hb-core{0%,100%{transform:scale(.82)}18%{transform:scale(1.08)}34%{transform:scale(.9)}50%{transform:scale(1)}}@keyframes ld-hb-ring{0%{transform:scale(.45);opacity:.65}75%,100%{transform:scale(1.2);opacity:0}}
        @media(prefers-reduced-motion:reduce){.ld-heartbeat *{animation:none!important}}
      </style><defs><linearGradient id="ldHbGrad" x1="34" y1="31" x2="86" y2="88"><stop stop-color="#ff88b8"/><stop offset="1" stop-color="#a887ff"/></linearGradient></defs>
      <circle class="ring" cx="60" cy="60" r="38" fill="none" stroke="#ff8fbd" stroke-width="3"/><circle class="ring r2" cx="60" cy="60" r="38" fill="none" stroke="#c1a5ff" stroke-width="2"/>
      <path class="core" d="M60 91C38 77 27 64 27 48c0-12 8-20 19-20 7 0 12 4 14 10 3-6 8-10 15-10 11 0 19 8 19 20 0 16-11 29-34 43Z" fill="url(#ldHbGrad)"/>
    </svg>`,
  },
  {
    id: 'love-letter',
    name: 'Thư tình',
    description: 'Lá thư mở ra và gửi một trái tim nhỏ.',
    markup: `<svg class="ld-letter" viewBox="0 0 120 120" role="img" aria-label="Loading thư tình">
      <style>
        .ld-letter .envelope{transform-origin:60px 76px;animation:ld-letter-bob 2s ease-in-out infinite}.ld-letter .flap{transform-origin:60px 55px;animation:ld-letter-flap 2s ease-in-out infinite}.ld-letter .mini-heart{transform-box:fill-box;transform-origin:center;animation:ld-letter-fly 2s ease-in-out infinite}
        @keyframes ld-letter-bob{0%,100%{transform:translateY(3px)}50%{transform:translateY(-2px)}}@keyframes ld-letter-flap{0%,18%,100%{transform:scaleY(1)}42%,75%{transform:scaleY(-.72)}}@keyframes ld-letter-fly{0%,20%{transform:translateY(22px) scale(.5);opacity:0}48%{opacity:1}78%,100%{transform:translateY(-25px) scale(1.08);opacity:0}}
        @media(prefers-reduced-motion:reduce){.ld-letter *{animation:none!important}}
      </style><defs><linearGradient id="ldLetterGrad" x1="25" y1="49" x2="95" y2="91"><stop stop-color="#ffb3cf"/><stop offset="1" stop-color="#bd9cff"/></linearGradient></defs>
      <g class="envelope"><rect x="24" y="50" width="72" height="46" rx="10" fill="url(#ldLetterGrad)"/><path d="M27 55 60 78 93 55" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="m27 91 25-22M93 91 68 69" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/></g>
      <path class="flap" d="M26 53 60 77 94 53 84 43H36Z" fill="#ffe5ef"/><path class="mini-heart" d="M60 55c-10-6-14-11-14-17 0-5 4-9 9-9 3 0 5 2 7 5 2-3 4-5 7-5 5 0 9 4 9 9 0 6-5 11-18 17Z" fill="#ff5f9f"/>
    </svg>`,
  },
  {
    id: 'infinity',
    name: 'Mãi bên nhau',
    description: 'Điểm sáng chạy liên tục trên dấu vô cực.',
    markup: `<svg class="ld-infinity" viewBox="0 0 120 120" role="img" aria-label="Loading mãi bên nhau">
      <style>
        .ld-infinity .trace{stroke-dasharray:18 145;animation:ld-inf-run 1.8s linear infinite}.ld-infinity .heart{transform-box:fill-box;transform-origin:center;animation:ld-inf-beat 1.8s ease-in-out infinite}
        @keyframes ld-inf-run{to{stroke-dashoffset:-163}}@keyframes ld-inf-beat{0%,100%{transform:scale(.72);opacity:.55}50%{transform:scale(1.08);opacity:1}}
        @media(prefers-reduced-motion:reduce){.ld-infinity *{animation:none!important}}
      </style><defs><linearGradient id="ldInfGrad" x1="17" y1="60" x2="103" y2="60"><stop stop-color="#ff6fae"/><stop offset="1" stop-color="#9d87ff"/></linearGradient></defs>
      <path d="M19 60c12-25 27-25 41 0s29 25 41 0c-12-25-27-25-41 0S31 85 19 60Z" fill="none" stroke="#f4d7e7" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <path class="trace" d="M19 60c12-25 27-25 41 0s29 25 41 0c-12-25-27-25-41 0S31 85 19 60Z" fill="none" stroke="url(#ldInfGrad)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <path class="heart" d="M60 67c-8-5-11-9-11-14 0-4 3-7 7-7 2 0 4 1 5 4 2-3 4-4 6-4 4 0 7 3 7 7 0 5-4 9-14 14Z" fill="#fff" stroke="#ff79ae" stroke-width="1.5"/>
    </svg>`,
  },
  {
    id: 'orbit',
    name: 'Hai đứa',
    description: 'Hai chấm màu xoay quanh trái tim chung.',
    markup: `<svg class="ld-orbit" viewBox="0 0 120 120" role="img" aria-label="Loading hai đứa">
      <style>
        .ld-orbit .system{transform-origin:60px 60px;animation:ld-orbit-spin 2.4s linear infinite}.ld-orbit .center{transform-box:fill-box;transform-origin:center;animation:ld-orbit-beat 1.2s ease-in-out infinite}
        @keyframes ld-orbit-spin{to{transform:rotate(360deg)}}@keyframes ld-orbit-beat{0%,100%{transform:scale(.82)}50%{transform:scale(1.06)}}
        @media(prefers-reduced-motion:reduce){.ld-orbit *{animation:none!important}}
      </style><defs><filter id="ldOrbitGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      <circle cx="60" cy="60" r="38" fill="none" stroke="#f1ddea" stroke-width="2" stroke-dasharray="3 7"/><g class="system"><circle cx="60" cy="22" r="8" fill="#ff71a9" filter="url(#ldOrbitGlow)"/><circle cx="60" cy="98" r="8" fill="#9d88ff" filter="url(#ldOrbitGlow)"/></g>
      <path class="center" d="M60 79C43 68 36 59 36 48c0-8 6-14 14-14 5 0 8 3 11 7 2-4 6-7 10-7 8 0 14 6 14 14 0 11-8 20-25 31Z" fill="#fff" stroke="#ff83b5" stroke-width="3"/>
    </svg>`,
  },
  {
    id: 'heart-equalizer',
    name: 'Love EQ',
    description: 'Equalizer bo tròn chuyển động thành dáng trái tim.',
    markup: `<svg class="ld-eq" viewBox="0 0 120 120" role="img" aria-label="Loading love equalizer">
      <style>
        .ld-eq rect{transform-box:fill-box;transform-origin:center;animation:ld-eq-wave 1.25s ease-in-out infinite}.ld-eq .b2,.ld-eq .b10{animation-delay:-.12s}.ld-eq .b3,.ld-eq .b9{animation-delay:-.24s}.ld-eq .b4,.ld-eq .b8{animation-delay:-.36s}.ld-eq .b5,.ld-eq .b7{animation-delay:-.48s}.ld-eq .b6{animation-delay:-.6s}
        @keyframes ld-eq-wave{0%,100%{transform:scaleY(.62);opacity:.46}50%{transform:scaleY(1);opacity:1}}
        @media(prefers-reduced-motion:reduce){.ld-eq *{animation:none!important}}
      </style><defs><linearGradient id="ldEqGrad" x1="22" y1="27" x2="98" y2="93"><stop stop-color="#ff719f"/><stop offset="1" stop-color="#a78cff"/></linearGradient></defs>
      <g fill="url(#ldEqGrad)"><rect class="b1" x="21" y="43" width="6" height="26" rx="3"/><rect class="b2" x="29" y="35" width="6" height="43" rx="3"/><rect class="b3" x="37" y="29" width="6" height="57" rx="3"/><rect class="b4" x="45" y="33" width="6" height="61" rx="3"/><rect class="b5" x="53" y="42" width="6" height="59" rx="3"/><rect class="b6" x="61" y="42" width="6" height="59" rx="3"/><rect class="b7" x="69" y="33" width="6" height="61" rx="3"/><rect class="b8" x="77" y="29" width="6" height="57" rx="3"/><rect class="b9" x="85" y="35" width="6" height="43" rx="3"/><rect class="b10" x="93" y="43" width="6" height="26" rx="3"/></g>
    </svg>`,
  },
];
