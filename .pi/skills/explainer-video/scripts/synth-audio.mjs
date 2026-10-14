#!/usr/bin/env node
// Code-synthesized background music bed + SFX (WAV, 44.1kHz stereo). Zero deps.
// Everything here is generated from math, so there are no licensing questions.
import fs from "node:fs";
import path from "node:path";

const HELP = `Usage: synth-audio.mjs --out <dir> --duration <sec> [options]

Writes:
  <out>/bed.wav           ambient pad + soft pulse, fades in/out
  <out>/sfx-whoosh.wav    filtered-noise sweep (scene transitions)
  <out>/sfx-pop.wav       short sine blip (items appearing)
  <out>/sfx-impact.wav    low thump (big reveals / numbers)
  <out>/sfx-tick.wav      tiny click (counters, typing)

Options:
  --key <A|C|D|E|F|G>   root note (default D)
  --mood <calm|tense|bright>  chord colour (default calm)
  --bpm <n>             pulse tempo (default 84; 0 disables pulse)
  --seed <n>            noise seed (default 1)
  --dry-run             print what would be generated
  --help`;
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
if (args.includes("--help") || args.includes("-h")) { console.log(HELP); process.exit(0); }
const outDir = opt("--out"), dur = +opt("--duration", NaN);
if (!outDir || !(dur > 0)) { console.error(HELP); process.exit(2); }
const SR = 44100;
const roots = { C: 130.81, D: 146.83, E: 164.81, F: 174.61, G: 196.0, A: 110.0 };
const root = roots[opt("--key", "D")] ?? roots.D;
const moods = { calm: [0, 7, 12, 16, 19], tense: [0, 3, 7, 10, 13], bright: [0, 4, 7, 11, 14] };
const iv = moods[opt("--mood", "calm")] ?? moods.calm;
const bpm = +opt("--bpm", 84);
let seed = +opt("--seed", 1);
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

if (args.includes("--dry-run")) { console.log(JSON.stringify({ outDir, dur, root, intervals: iv, bpm })); process.exit(0); }
fs.mkdirSync(outDir, { recursive: true });

function writeWav(file, L, R = L) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  let peak = 1e-9; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = 0.89 / peak;
  for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.round(L[i] * g * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * g * 32767), 46 + i * 4); }
  fs.writeFileSync(path.join(outDir, file), buf);
}

// --- bed: detuned pad chords cycling every 8s + optional soft pulse
{
  const n = Math.ceil(dur * SR), L = new Float32Array(n), R = new Float32Array(n);
  const prog = [0, -5, -3, -7]; // chord roots in semitones (I, V-ish, vi-ish, IV-ish)
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, bar = Math.floor(t / 8), ph = (t % 8) / 8;
    const cr = prog[bar % prog.length];
    let s = 0;
    for (const k of iv) { const f = root * 2 ** ((cr + k) / 12); s += Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 1.003 * t + 1); }
    s *= 0.08 * (0.6 + 0.4 * Math.sin(Math.PI * ph));
    if (bpm > 0) { const bt = (t * bpm / 60) % 1; s += 0.12 * Math.exp(-bt * 9) * Math.sin(2 * Math.PI * root / 2 * 2 ** (cr / 12) * t); }
    lp += 0.02 * (rnd() * 0.02 - lp); s += lp;
    const fade = Math.min(1, t / 2.5, (dur - t) / 3);
    L[i] = s * fade * (1 + 0.15 * Math.sin(t * 0.3)); R[i] = s * fade * (1 + 0.15 * Math.cos(t * 0.3));
  }
  writeWav("bed.wav", L, R);
}
// --- sfx
const make = (sec, fn) => { const n = Math.ceil(sec * SR), a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = fn(i / SR, sec); return a; };
{ let y = 0; writeWav("sfx-whoosh.wav", make(0.9, (t, d) => { const c = 0.02 + 0.25 * Math.sin(Math.PI * t / d); y += c * (rnd() - y); return y * Math.sin(Math.PI * t / d) ** 2; })); }
writeWav("sfx-pop.wav", make(0.18, (t) => Math.sin(2 * Math.PI * (900 - 2500 * t) * t) * Math.exp(-t * 28)));
writeWav("sfx-impact.wav", make(1.2, (t) => (Math.sin(2 * Math.PI * (55 + 60 * Math.exp(-t * 12)) * t) + 0.3 * rnd() * Math.exp(-t * 30)) * Math.exp(-t * 3.5)));
writeWav("sfx-tick.wav", make(0.05, (t) => rnd() * Math.exp(-t * 180)));
console.error(`[synth] wrote bed.wav (${dur}s) + 4 sfx to ${outDir}`);
