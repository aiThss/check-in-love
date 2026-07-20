export const loveSparkLoaderMarkup = `<svg class="loveSpark" viewBox="0 0 100 100" width="112" height="112" xmlns="http://www.w3.org/2000/svg" aria-label="love spark loader">
  <style>
    .loveSpark .heart {
      transform-box: fill-box;
      transform-origin: center;
      animation: ls-heart 3s ease-in-out infinite;
    }

    .loveSpark .star {
      transform-box: fill-box;
      transform-origin: center;
      animation: ls-star 3s ease-in-out infinite;
    }

    .loveSpark .s2 { animation-delay: -.5s; }
    .loveSpark .s3 { animation-delay: -1s; }
    .loveSpark .s4 { animation-delay: -1.5s; }

    @keyframes ls-heart {
      0%,100% { transform: scale(.82) rotate(-3deg); }
      50% { transform: scale(1.06) rotate(3deg); }
    }

    @keyframes ls-star {
      0%,100% { transform: scale(.25) rotate(0deg); opacity: 0; }
      45% { transform: scale(1) rotate(90deg); opacity: 1; }
      65% { transform: scale(.65) rotate(160deg); opacity: .4; }
    }
  </style>

  <g fill="#FFF0F6">
    <path class="star s1" d="M15 18 18 27 27 30 18 33 15 42 12 33 3 30 12 27Z"/>
    <path class="star s2" d="M82 10 84 17 91 19 84 21 82 28 80 21 73 19 80 17Z"/>
    <path class="star s3" d="M87 64 90 73 99 76 90 79 87 88 84 79 75 76 84 73Z"/>
    <path class="star s4" d="M15 68 17 74 23 76 17 78 15 84 13 78 7 76 13 74Z"/>
  </g>

  <path class="heart"
    d="M50 80C30 67 20 56 20 40c0-12 8-20 19-20 7 0 12 4 16 10 4-6 9-10 16-10 11 0 19 8 19 20 0 16-10 27-40 40Z"
    fill="url(#lg1)"/>

  <defs>
    <linearGradient id="lg1" x1="20" y1="20" x2="84" y2="80">
      <stop stop-color="#ff6fae"/>
      <stop offset="1" stop-color="#b69cff"/>
    </linearGradient>
  </defs>
</svg>`;
