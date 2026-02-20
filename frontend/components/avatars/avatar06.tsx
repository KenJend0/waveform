export function Avatar06() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="texture-06" x="0%" y="0%" width="100%" height="100%">
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
        d="M 30 35 Q 25 50, 30 65"
        stroke="#9BA3A8"
        strokeWidth="7"
        fill="none"
        opacity="0.7"
        filter="url(#texture-06)"
        strokeLinecap="round"
      />
      <path
        d="M 55 35 Q 50 50, 55 65"
        stroke="#9BA3A8"
        strokeWidth="7"
        fill="none"
        opacity="0.7"
        filter="url(#texture-06)"
        strokeLinecap="round"
      />
    </svg>
  );
}
