import "./index.css";
import { Composition } from 'remotion';
import { Video } from './Video';
import { TOTAL_DURATION } from './timings';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="OculoSaasAd"
        component={Video}
        durationInFrames={TOTAL_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
