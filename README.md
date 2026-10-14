# pi-explainer-vid

A **project-local** [Pi coding agent](https://pi.dev/) extension that turns Pi into an **Explainer Video bot**: give it a topic, get a researched, narrated, captioned 1920×1080 MP4 built in [Remotion](https://www.remotion.dev/), ending with an on-screen sources card.

Pipeline: research (real URLs) → narration script → ElevenLabs TTS + word timings → topic-specific Remotion animation with synced captions → synthesized music bed + SFX → render → ffprobe + frame inspection.

Built from the `pi-explainer-video-bot` skill package, plus a TypeScript extension that wraps the deterministic steps as typed Pi tools with safety gates. Everything lives under `.pi/`, so it only applies when you run Pi in this directory (after trusting the project).

## Contents

```
.pi/
  extensions/explainer-video.ts   # the extension: 5 tools, 2 commands, --explainer-yes flag, API-key print guard
  skills/explainer-video/
    SKILL.md                      # the workflow (Agent Skills format)
    scripts/tts.mjs               # ElevenLabs /with-timestamps -> vo.mp3 + words.json (no deps)
    scripts/synth-audio.mjs       # code-synthesized music bed + 4 SFX as WAV (no deps)
    scripts/verify.sh             # ffprobe checks + sampled frames + contact sheet
    references/remotion-patterns.md
    references/timings.md         # ElevenLabs vs local faster-whisper timings
  prompts/explainer.md            # /explainer <topic> prompt template
AGENTS.md                         # project persona/rules for Pi in this directory
package.json                      # pi manifest (only needed to install this elsewhere as a package)
videos/                           # created per video by explainer_scaffold: videos/<topic-slug>/
```

## What the extension adds

| Kind | Name | Purpose |
|---|---|---|
| Tool | `explainer_preflight` | Check node, npx, ffmpeg, ffprobe, `ELEVENLABS_API_KEY` presence (value never shown), skill scripts |
| Tool | `explainer_scaffold` | Create `videos/<slug>/` skeleton (research/script/public/out) with templates + word budget; never overwrites |
| Tool | `explainer_tts` | ElevenLabs voiceover + `words.json`; `dryRun` support; asks you to confirm before spending credits |
| Tool | `explainer_synth_audio` | Synthesized `bed.wav` + `sfx-whoosh/pop/impact/tick.wav` (no licensed audio) |
| Tool | `explainer_verify` | 1080p/audio/duration checks + sampled frames & contact sheet for visual inspection |
| Command | `/explainer-preflight` | Same checks as the tool, for you (no LLM turn) |
| Command | `/explainer-status` | Production stage of each folder under `videos/` |
| Flag | `--explainer-yes` | Skip the TTS spend-confirmation prompt |
| Guard | `tool_call` hook | Blocks bash commands that would echo/print `ELEVENLABS_*` values |

`/explainer` itself stays a prompt template on purpose: extension commands are checked before templates, so an extension command with that name would shadow it.

## Prerequisites

- Node.js 18+ and npm (Remotion recommends a current LTS)
- ffmpeg + ffprobe on PATH
- `ELEVENLABS_API_KEY` exported in your shell (get one at elevenlabs.io). Optional: `ELEVENLABS_VOICE_ID`.
- Pi installed with a model provider configured (see https://pi.dev/docs/latest)
- Pi needs web access for research (e.g. a web-search skill/extension such as one from https://github.com/badlogic/pi-skills, or curl).
- Optional: Python + `faster-whisper` for local word timings.

## Usage

```bash
export ELEVENLABS_API_KEY=...   # in your shell profile; never commit it
cd /home/justin/code/pi-explainer-vid
pi                              # trust the project when prompted (or: pi --approve)
```

Then in Pi:

```
/explainer how lithium-ion batteries degrade, ~90 seconds
/explainer-preflight
/explainer-status
/skill:explainer-video why the sky is blue
make me an explainer video about the James Webb telescope's mirror
```

One-off run without an interactive session:

```bash
pi --approve -p "/explainer why the sky is blue, ~60 seconds"
```

Note: in print mode there is no confirmation dialog, so a real `explainer_tts` run proceeds once the agent makes it — the skill/prompt still ask the agent to show the script first, but for unattended runs you own that decision. Use `--explainer-yes` interactively only when you genuinely want to skip the prompt every time.

Helper scripts directly (what the tools run under the hood):

```bash
S=.pi/skills/explainer-video/scripts
node $S/tts.mjs --help
node $S/tts.mjs --script videos/<slug>/script/narration.txt --out videos/<slug>/public --dry-run
node $S/synth-audio.mjs --out videos/<slug>/public --duration 95 --mood bright
bash $S/verify.sh videos/<slug>/out/video.mp4 --expect-duration 95
```

Reload after editing the extension/skill/prompts in a running session: `/reload`.

## Using this from another project (optional)

This directory doubles as a Pi package (`pi` manifest in `package.json` points at `./.pi/...`). To use it elsewhere:

```bash
pi install /home/justin/code/pi-explainer-vid        # global
pi install -l /home/justin/code/pi-explainer-vid     # into another project's .pi/settings.json
pi -e /home/justin/code/pi-explainer-vid/.pi/extensions/explainer-video.ts   # try the extension only
```

Don't run `pi install -l .` *inside* this repo — its resources already load project-locally, and installing it into itself would double-load them.

## Notes

- ElevenLabs usage costs credits; the prompt template asks Pi to show the script before TTS, and `explainer_tts` confirms before spending.
- Music/SFX are generated from math (no licensing issues). If you use web SFX, use only CC0/royalty-free and record the license in `research/sources.md`.
- Remotion has its own license terms (free for individuals and small companies; larger companies need a company license): https://www.remotion.dev/license
- Remotion's official agent skills (MIT) are referenced, not bundled: https://www.remotion.dev/docs/ai/skills
- Docs used: https://pi.dev/docs/latest (extensions, skills, prompt templates, packages, configuration).
