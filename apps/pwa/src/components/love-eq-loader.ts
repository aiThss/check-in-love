let loveEqSequence = 0;

export function createLoveEqLoaderMarkup(): string {
  const gradientId = `loveEqGrad-${loveEqSequence++}`;

  return `<svg class="loveEq" viewBox="0 0 120 120" width="28" height="28" xmlns="http://www.w3.org/2000/svg" aria-label="love equalizer loader">
  <style>
    .loveEq rect{transform-box:fill-box;transform-origin:center;animation:love-eq-wave 1.25s ease-in-out infinite}.loveEq .b2,.loveEq .b10{animation-delay:-.12s}.loveEq .b3,.loveEq .b9{animation-delay:-.24s}.loveEq .b4,.loveEq .b8{animation-delay:-.36s}.loveEq .b5,.loveEq .b7{animation-delay:-.48s}.loveEq .b6{animation-delay:-.6s}
    @keyframes love-eq-wave{0%,100%{transform:scaleY(.62);opacity:.46}50%{transform:scaleY(1);opacity:1}}
    @media(prefers-reduced-motion:reduce){.loveEq *{animation:none!important}}
  </style>
  <defs><linearGradient id="${gradientId}" x1="22" y1="27" x2="98" y2="93" gradientUnits="userSpaceOnUse"><stop stop-color="#ff6fae"/><stop offset="1" stop-color="#b69cff"/></linearGradient></defs>
  <g fill="url(#${gradientId})">
    <rect class="b1" x="21" y="43" width="6" height="26" rx="3"/><rect class="b2" x="29" y="35" width="6" height="43" rx="3"/><rect class="b3" x="37" y="29" width="6" height="57" rx="3"/><rect class="b4" x="45" y="33" width="6" height="61" rx="3"/><rect class="b5" x="53" y="42" width="6" height="59" rx="3"/><rect class="b6" x="61" y="42" width="6" height="59" rx="3"/><rect class="b7" x="69" y="33" width="6" height="61" rx="3"/><rect class="b8" x="77" y="29" width="6" height="57" rx="3"/><rect class="b9" x="85" y="35" width="6" height="43" rx="3"/><rect class="b10" x="93" y="43" width="6" height="26" rx="3"/>
  </g>
</svg>`;
}
