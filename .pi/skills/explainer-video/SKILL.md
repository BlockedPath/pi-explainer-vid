---
name: explainer-video
description: Turns any topic into a researched, narrated 1920x1080 explainer video. Researches real sources (with URLs), writes a narration script, generates an ElevenLabs voiceover with word timings, builds a topic-specific Remotion (React) animation with synced captions, music and SFX, renders MP4, and verifies it with ffprobe and sampled frames. Use when the user asks for an explainer, narrated video, animated video about a topic, or "make a video about X".
license: MIT
compatibility: Requires Node 18+, npm, ffmpeg/ffprobe, network access, and ELEVENLABS_API_KEY in the environment. Optional Python faster-whisper for local timings.
metadata:
  version: "0.1.0"
---

# Explainer Video

You turn a topic into a researched, narrated explainer video. This file is a **reference, not a rigid recipe**: every video gets its own structure, palette, typography and visual metaphors chosen for the topic. Do not reuse a previous video's layout.

Helper scripts live next to this file in `scripts/` (paths below are relative to this skill directory; resolve them to absolute paths before running).

## Pi extension tools (preferred when available)

If the `explainer-video` extension is loaded (`.pi/extensions/explainer-video.ts` in this project), use its tools for the deterministic steps instead of running the scripts through bash — they resolve paths, gate ElevenLabs spend behind a user confirmation, and return structured results:

- `explainer_preflight` → step 0 checks (node, ffmpeg, key presence, scripts).
- `explainer_scaffold` → creates `videos/<topic-slug>/` with research/script/public/out skeleton and a word budget.
- `explainer_tts` → step 3 (always `dryRun: true` first; real runs confirm with the user unless `--explainer-yes`).
- `explainer_synth_audio` → step 5 music bed + SFX.
- `explainer_verify` → step 7 ffprobe checks + sampled frames (then still inspect the frames yourself).

The bash commands below remain the fallback when the extension is not loaded, and are what the tools run under the hood.

## Hard rules

- **Never invent facts.** Every number, date, name and claim in the narration must come from a source you actually fetched. Keep `research/sources.md` with claim → URL. If you cannot verify something, cut it or soften it ("estimates suggest…") and cite the estimate.
- **Never hardcode or print API keys.** Read `ELEVENLABS_API_KEY` from the env only. Don't write it into files, commands lines, logs or the repo.
- Only use music/SFX that are code-synthesized (`scripts/synth-audio.mjs`) or verifiably CC0 / royalty-free with the license recorded in `research/sources.md`.
- End with an on-screen **sources card** listing the main sources (domain + short title; full URLs in the description/README).
- Output 1920x1080, 30 fps, H.264 MP4 with AAC audio.

## Workflow

### 0. Preflight
```bash
node -v && ffmpeg -version | head -1 && test -n "$ELEVENLABS_API_KEY" && echo key-ok
```
If the key is missing, stop and ask the user to export it (do not ask them to paste it in chat).

### 1. Research (`research/`)
- Search and fetch 4–10 real, preferably primary sources (official sites, papers, agencies, reputable press). Note the date of each.
- Write `research/notes.md` (facts with inline `[n]` refs) and `research/sources.md` (numbered list: title — URL — accessed date).
- Pick ONE angle/question the video answers. Aim for 60–150 s unless asked otherwise (~150–160 spoken words per minute).

### 2. Script (`script/narration.txt`)
- Hook in the first sentence, 4–8 beats, one idea per beat, concrete numbers, a clear takeaway.
- Plain spoken text only: no markdown, no stage directions. Spell out awkward symbols ("percent", "kilometers") if the voice may stumble; keep digits for numbers you want shown as on-screen captions.
- Also write `script/beats.md`: for each beat, the narration lines + the visual idea + the source refs. Show the user the script before spending TTS credits if they're in the loop.

### 3. Voiceover + word timings
```bash
node scripts/tts.mjs --script script/narration.txt --out <project>/public --dry-run   # check
node scripts/tts.mjs --script script/narration.txt --out <project>/public              # real call
```
Produces `public/vo.mp3` and `public/words.json` (`[{t,s,e}]`, seconds) from ElevenLabs' `/with-timestamps` endpoint. Options: `--voice <id>` (or `ELEVENLABS_VOICE_ID`), `--model`, `--speed`, `--stability`. Copy `words.json` into `src/` if you import it.

Alternative timings (e.g. audio from elsewhere): local faster-whisper with `word_timestamps=True`, mapped to the same `{t,s,e}` shape. See [references/timings.md](references/timings.md).

Measure the real duration: `ffprobe -v error -show_entries format=duration -of csv=p=0 public/vo.mp3`.

### 4. Remotion project
```bash
npx create-video@latest --yes --blank --no-tailwind <project>   # or follow current Remotion docs
cd <project> && npm i @remotion/media @remotion/google-fonts
```
Design first (write it in `script/beats.md`): palette, 1–2 fonts, a visual metaphor per beat (diagrams, maps, charts, counters, timelines, SVG illustrations, kinetic type). Then build. Patterns that work: see [references/remotion-patterns.md](references/remotion-patterns.md).

Key points:
- Composition: `width={1920} height={1080} fps={30}`, `durationInFrames = ceil((voDuration + ~1.5s tail + sources card) * 30)`.
- Drive scene boundaries and reveals from `words.json` (e.g. a helper `at("satellites")` → frame of that word) so visuals land on the spoken word.
- Captions: group words into short phrases (break at sentence end, comma after ≥4 words, pause >0.5 s, or 7 words), highlight the active word.
- Everything animates from `useCurrentFrame()` (`interpolate`, `spring`). No CSS transitions or `Math.random()` (use `random(seed)`).
- Audio: `<Audio src={staticFile("vo.mp3")} />`, music bed at ~0.15–0.3 volume (duck under voice), SFX in `<Sequence from={frame}>` on transitions/reveals.
- Final scene: sources card (title "Sources", 3–8 entries, readable ≥28 px, held ≥4 s).

If the Remotion agent skills are installed (e.g. `remotion-best-practices`, `remotion-captions`, `remotion-multimedia`), load them for API details. Public docs: https://www.remotion.dev/docs/ and https://www.remotion.dev/docs/ai/skills

### 5. Music & SFX
```bash
node scripts/synth-audio.mjs --out <project>/public --duration <totalSec> --key D --mood calm --bpm 84
```
Writes `bed.wav` and `sfx-whoosh.wav`, `sfx-pop.wav`, `sfx-impact.wav`, `sfx-tick.wav`. Pick mood/key to fit the topic, or write your own synth for something more bespoke. For web SFX, only CC0 (e.g. explicitly CC0-tagged on freesound.org) and record the license + URL.

### 6. Render
```bash
npx tsc --noEmit && npx remotion render <CompositionId> out/video.mp4 --codec=h264
```
Check a few stills first if unsure: `npx remotion still <CompositionId> out/f.png --frame=<n>`.

### 7. Verify (mandatory)
```bash
bash scripts/verify.sh out/video.mp4 --expect-duration <sec> --frames 8
```
Checks 1920x1080, audio stream present, duration, non-silent audio, and extracts frames + `contact_sheet.jpg`. **Open the frames with the read tool and look at them**: text overflow, overlapping elements, empty scenes, unreadable captions, captions in sync, sources card at the end. Fix and re-render until clean.

### 8. Deliver
Report: video path, duration, the script, sources list (URLs), and any caveats (estimates, dated figures).
