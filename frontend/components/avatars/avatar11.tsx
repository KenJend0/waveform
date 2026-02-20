export function Avatar11() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="texture-11" x="0%" y="0%" width="100%" height="100%">
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
        d="M 35 35 Q 45 30, 50 35 Q 55 30, 65 35 L 65 65 Q 55 70, 50 65 Q 45 70, 35 65 Z"
        fill="#A4AFA1"
        opacity="0.7"
        filter="url(#texture-11)"
      />
    </svg>
  );
}
