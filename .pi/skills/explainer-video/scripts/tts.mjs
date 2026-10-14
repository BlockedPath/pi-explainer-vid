#!/usr/bin/env node
// ElevenLabs TTS with word timings. Zero dependencies (Node >= 18).
// Reads the API key from ELEVENLABS_API_KEY only. Never pass keys as args.
import fs from "node:fs";
import path from "node:path";

const HELP = `Usage: tts.mjs --script <narration.txt> --out <dir> [options]

Calls ElevenLabs POST /v1/text-to-speech/{voice}/with-timestamps and writes:
  <out>/vo.mp3       narration audio
  <out>/words.json   [{ "t": word, "s": startSec, "e": endSec }, ...]

Options:
  --voice <id>       ElevenLabs voice id (default: $ELEVENLABS_VOICE_ID or JBFqnCBsd6RMkjVDRZzb)
  --model <id>       model id (default: eleven_multilingual_v2)
  --stability <0-1>  default 0.45     --similarity <0-1> default 0.75
  --speed <0.7-1.2>  default 1.0
  --dry-run          validate inputs, print the request (no network, no key needed)
  --help             show this help

Env: ELEVENLABS_API_KEY (required unless --dry-run)`;

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
if (args.includes("--help") || args.includes("-h")) { console.log(HELP); process.exit(0); }
const scriptPath = opt("--script"), outDir = opt("--out");
if (!scriptPath || !outDir) { console.error(HELP); process.exit(2); }
const text = fs.readFileSync(scriptPath, "utf8").trim();
if (!text) { console.error("Narration script is empty"); process.exit(2); }
const voice = opt("--voice", process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb");
const body = {
  text, model_id: opt("--model", "eleven_multilingual_v2"),
  voice_settings: { stability: +opt("--stability", 0.45), similarity_boost: +opt("--similarity", 0.75), speed: +opt("--speed", 1.0) },
};
const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/with-timestamps?output_format=mp3_44100_128`;
const words = text.split(/\s+/).length;
console.error(`[tts] ${words} words, ~${(words / 2.6).toFixed(0)}s at ~155 wpm, voice=${voice}, model=${body.model_id}`);

if (args.includes("--dry-run")) {
  console.log(JSON.stringify({ url, body: { ...body, text: text.slice(0, 80) + (text.length > 80 ? "…" : "") } }, null, 2));
  process.exit(0);
}
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error("ELEVENLABS_API_KEY is not set"); process.exit(3); }

const res = await fetch(url, { method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
if (!res.ok) { console.error(`[tts] HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`); process.exit(1); }
const j = await res.json();
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "vo.mp3"), Buffer.from(j.audio_base64, "base64"));

// characters -> words
const a = j.alignment || j.normalized_alignment;
const out = []; let cur = null;
a.characters.forEach((ch, i) => {
  if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = null; } return; }
  if (!cur) cur = { t: "", s: a.character_start_times_seconds[i], e: 0 };
  cur.t += ch; cur.e = a.character_end_times_seconds[i];
});
if (cur) out.push(cur);
const r = (x) => Math.round(x * 1000) / 1000;
fs.writeFileSync(path.join(outDir, "words.json"), JSON.stringify(out.map((w) => ({ t: w.t, s: r(w.s), e: r(w.e) }))));
console.error(`[tts] wrote vo.mp3 and words.json (${out.length} words, ends at ${out.at(-1)?.e.toFixed(2)}s)`);
