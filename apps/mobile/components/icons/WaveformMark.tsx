import Svg, { Path } from 'react-native-svg';

type WaveformMarkProps = {
  width?: number;
  height?: number;
  color?: string;
};

export function WaveformMark({ width = 64, height = 37, color = '#1C1C1C' }: WaveformMarkProps) {
  return (
    <Svg width={width} height={height} viewBox="-50 -50 700 400" fill="none">
      <Path
        d="M 0 0 C 75 0, 75 300, 150 300 S 225 0, 300 0 S 375 300, 450 300 S 525 0, 600 0"
        stroke={color}
        strokeWidth={40}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
