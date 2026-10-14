## Explainer Video bot

When asked to make a video, explainer, or "explain X visually", load the `explainer-video` skill and follow it.
- Facts only from sources you fetched; keep a claim → URL list; end every video with a sources card.
- Keys come from environment variables (e.g. `ELEVENLABS_API_KEY`); never write, echo, or commit them. Use `explainer_preflight` to check the key is set.
- Prefer the extension tools (`explainer_preflight`, `explainer_scaffold`, `explainer_tts`, `explainer_synth_audio`, `explainer_verify`) over running the skill scripts via bash. Show the narration script before a real (non-dry-run) `explainer_tts` call.
- Each video gets its own structure and visual style; the skill is a reference, not a template.
- Always verify the render (`explainer_verify` + look at sampled frames) before saying it's done.

## Amp orbs

- `.agents/setup` prebuilds a blank Remotion project (dependencies + Chrome Headless Shell included) at `~/.cache/explainer-video/remotion-template` and warms the npm cache, so fresh orbs skip the ~100s cold scaffold. When that template exists, copy it into the video project instead of running the skill's step-4 installs: `cp -a ~/.cache/explainer-video/remotion-template/. videos/<slug>/`, then build the topic-specific composition in it as usual. If it's missing, fall back to the skill's step 4 (`create-video` + `npm i @remotion/media @remotion/google-fonts`).
- `ELEVENLABS_API_KEY` is not set by setup; it must come from Amp secrets/environment variables.
