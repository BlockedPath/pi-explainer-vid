# Remotion patterns that work for narrated explainers

Short, original snippets distilled from working projects. For API details prefer the
official docs (https://www.remotion.dev/docs/) or Remotion's own agent skills
(https://www.remotion.dev/docs/ai/skills); they are linked, not copied, here.

## Word-anchored timing
```tsx
import wordsRaw from "./words.json";
type W = { t: string; s: number; e: number };
const words = wordsRaw as W[];
const FPS = 30;
const norm = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
// frame of the nth occurrence of a spoken word
export const at = (w: string, n = 0) => {
  const m = words.filter((x) => norm(x.t) === norm(w));
  if (!m.length) throw new Error(`word not in narration: ${w}`);
  return Math.round((m[n] ?? m[0]).s * FPS);
};
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const fadeIn = (f: number, start: number, d = 15) => interpolate(f, [start, start + d], [0, 1], clamp);
```
Scene boundaries: an array of seconds (from where each beat's first word starts) mapped to
frames, each scene in `<Sequence from={S[i]} durationInFrames={S[i+1]-S[i]+12}>` so scenes
overlap ~0.4 s for cross-fades.

## Captions
```tsx
const phrases: W[][] = []; let cur: W[] = [];
words.forEach((w, i) => {
  cur.push(w); const nx = words[i + 1];
  if (/[.?!]$/.test(w.t) || cur.length >= 7 || (/,$/.test(w.t) && cur.length >= 4) || (nx && nx.s - w.e > 0.5)) { phrases.push(cur); cur = []; }
});
if (cur.length) phrases.push(cur);
// render the phrase whose [first.s, last.e + 0.3] contains t = frame / FPS;
// highlight the word whose [s, e] contains t (colour/weight change, not size, to avoid reflow)
```
Place captions in the lower third on a translucent dark pill; keep 44–56 px; never cover key visuals.

## Audio
```tsx
import { Audio } from "@remotion/media";
<Audio src={staticFile("vo.mp3")} />
<Audio src={staticFile("bed.wav")} volume={(f) => interpolate(f, [0, 30], [0, 0.25], clamp)} />
<Sequence from={at("launch") - 6}><Audio src={staticFile("sfx-whoosh.wav")} volume={0.5} /></Sequence>
```

## Visual vocabulary (pick per topic, don't reuse wholesale)
- SVG diagrams built from primitives (circles, paths, gradients) animated with `interpolate`/`spring`.
- Counters: `Math.round(interpolate(f, [a, b], [0, value], clamp)).toLocaleString()`.
- Bar/line charts with `strokeDasharray`/`strokeDashoffset` draw-on.
- Particle fields with `random("seed"+i)` for determinism.
- Kinetic typography for key numbers (scale-in with `spring`, then hold).
- Google fonts via `@remotion/google-fonts/<Family>` `loadFont()`.

## Sources card
Last ~5 s: heading "Sources", numbered list of `publisher — title` (short), staggered fade-in,
plus a small "Narration: AI voice (ElevenLabs) · Music/SFX: synthesized" credit line.

## Gotchas
- Never use `Math.random()`, `Date.now()`, or CSS animations; renders are frame-parallel.
- Fit text: set `maxWidth` and test the longest string at a still frame.
- Long renders: `--concurrency` can be tuned; check `npx remotion render --help`.
