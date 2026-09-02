import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

/** Chiffre qui compte de 0 (ou `from`) jusqu'a `to`, easing spring, jamais lineaire/robotique. */
export const AnimatedCounter: React.FC<{
  to: number;
  from?: number;
  delay?: number;
  durationInFrames?: number;
  decimals?: number;
  formatter?: (n: number) => string;
}> = ({ to, from = 0, delay = 0, durationInFrames = 40, decimals = 0, formatter }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - delay;
  const progress = spring({ frame: local, fps, durationInFrames, config: { damping: 200, mass: 1 } });
  const value = interpolate(progress, [0, 1], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const text = formatter ? formatter(value) : value.toFixed(decimals);
  return <>{text}</>;
};
