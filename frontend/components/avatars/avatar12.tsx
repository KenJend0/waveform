export function Avatar12() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="texture-12" x="0%" y="0%" width="100%" height="100%">
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
        d="M 50 25 Q 45 35, 50 45 T 50 65 T 50 75"
        stroke="#B8AFA4"
        strokeWidth="7"
        fill="none"
        opacity="0.7"
        filter="url(#texture-12)"
        strokeLinecap="round"
      />
    </svg>
  );
}
