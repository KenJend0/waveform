export function Avatar08() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="texture-08" x="0%" y="0%" width="100%" height="100%">
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
        d="M 25 50 Q 35 45, 50 50 Q 65 55, 75 50"
        stroke="#AEA69B"
        strokeWidth="9"
        fill="none"
        opacity="0.7"
        filter="url(#texture-08)"
        strokeLinecap="round"
      />
    </svg>
  );
}
