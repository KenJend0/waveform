export function Avatar03() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="texture-03" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="3"
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="saturate"
            values="0"
            result="monoNoise"
          />
          <feBlend in="SourceGraphic" in2="monoNoise" mode="multiply" />
        </filter>
      </defs>
      <path
        d="M 65 25 Q 75 25, 75 35 L 75 65 Q 75 75, 65 75 L 50 75 Q 40 75, 40 65 L 40 35 Q 40 25, 50 25 Z"
        fill="#C2BCB0"
        opacity="0.7"
        filter="url(#texture-03)"
      />
    </svg>
  );
}
