export function Avatar10() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="texture-10" x="0%" y="0%" width="100%" height="100%">
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
        d="M 30 50 Q 30 30, 50 30 Q 70 30, 70 50"
        stroke="#A3AAB0"
        strokeWidth="7"
        fill="none"
        opacity="0.68"
        filter="url(#texture-10)"
        strokeLinecap="round"
      />
    </svg>
  );
}
