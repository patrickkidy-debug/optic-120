import type { PropsWithChildren } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

/** Fondu d'entree/sortie generique pour habiller une scene dans sa Sequence. */
export const SceneFade: React.FC<PropsWithChildren<{ duration: number; fade?: number }>> = ({
  children,
  duration,
  fade = 10,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, fade, duration - fade, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};
