import { Composition } from "remotion";
import { AgathonPromo } from "./AgathonPromo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AgathonPromo"
        component={AgathonPromo}
        durationInFrames={510} // 17 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="AgathonPromoSquare"
        component={AgathonPromo}
        durationInFrames={510}
        fps={30}
        width={1080}
        height={1080}
      />
      <Composition
        id="AgathonPromoVertical"
        component={AgathonPromo}
        durationInFrames={510}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
