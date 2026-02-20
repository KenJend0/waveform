export function Avatar04() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="texture-04" x="0%" y="0%" width="100%" height="100%">
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
        d="M 20 50 Q 30 38, 40 50 T 60 50 T 80 50"
        stroke="#A4AFA1"
        strokeWidth="8"
        fill="none"
        opacity="0.65"
        filter="url(#texture-04)"
        strokeLinecap="round"
      />
    </svg>
  );
}
