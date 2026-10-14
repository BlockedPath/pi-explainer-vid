import { Composition } from "remotion";
import { StarlinkSafety } from "./Video";
import wordsRaw from "./words.json";

type W = { t: string; s: number; e: number };
const words = wordsRaw as W[];
const voEnd = words.length ? words[words.length - 1].e : 156.09;
// narration + ~1.4s tail + ~6.5s sources card, at 30 fps
export const TOTAL_FRAMES = Math.ceil((voEnd + 1.4 + 6.5) * 30);

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="StarlinkSafety"
      component={StarlinkSafety}
      durationInFrames={TOTAL_FRAMES}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
