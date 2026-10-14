/**
 * Explainer Video extension (project-local).
 *
 * Wraps the bundled `explainer-video` skill's helper scripts
 * (.pi/skills/explainer-video/scripts/) as typed, LLM-callable tools, and adds
 * user commands for the deterministic parts of the pipeline:
 *
 *   Tools:    explainer_preflight, explainer_scaffold, explainer_tts,
 *             explainer_synth_audio, explainer_verify
 *   Commands: /explainer-preflight, /explainer-status
 *   Flag:     --explainer-yes   (skip the ElevenLabs spend confirmation)
 *
 * The creative steps (research, script, Remotion animation, render) stay with
 * the agent + skill — see .pi/skills/explainer-video/SKILL.md. Start a video
 * with the /explainer prompt template (.pi/prompts/explainer.md); this
 * extension deliberately does NOT register an /explainer command, because
 * extension commands are checked before prompt templates and would shadow it.
 *
 * Safety rules enforced here:
 * - ELEVENLABS_API_KEY is only ever checked for presence, never printed.
 * - explainer_tts asks for confirmation before spending ElevenLabs credits
 *   (interactive mode), unless started with --explainer-yes.
 * - Helper scripts are run via pi.exec with argument arrays (no shell strings).
 * - Bash commands that would echo/print ELEVENLABS_* values are blocked.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { StringEnum } from "@earendil-works/pi-ai";
import {
	isToolCallEventType,
	withFileMutationQueue,
	type ExtensionAPI,
	type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const EXT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_REL = join("skills", "explainer-video", "scripts");

/** Locate a bundled skill script, whether loaded from .pi/extensions or -e. */
function findScript(cwd: string, name: string): string | undefined {
	const candidates = [
		join(EXT_DIR, "..", SKILL_REL, name), // .pi/extensions -> .pi/skills/...
		join(EXT_DIR, "..", "..", SKILL_REL, name), // extensions/ in a package root
		join(cwd, ".pi", SKILL_REL, name),
		join(cwd, SKILL_REL, name),
	];
	return candidates.find((p) => existsSync(p));
}

/** Resolve an LLM-supplied path against cwd (and strip a leading "@"). */
function resolvePath(ctx: ExtensionContext, p: string): string {
	const clean = p.startsWith("@") ? p.slice(1) : p;
	return resolve(ctx.cwd, clean);
}

function tail(text: string, max = 6000): string {
	const t = text.trim();
	return t.length > max ? `…(truncated)\n${t.slice(-max)}` : t;
}

function slugify(topic: string): string {
	const slug = topic
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60)
		.replace(/-+$/g, "");
	return slug || "explainer";
}

type Check = { name: string; ok: boolean; detail: string; required: boolean };

async function runPreflight(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	signal?: AbortSignal,
): Promise<{ ok: boolean; checks: Check[]; scripts: Record<string, string | null> }> {
	const checks: Check[] = [];
	const probe = async (name: string, cmd: string, args: string[]) => {
		try {
			const r = await pi.exec(cmd, args, { signal, timeout: 10_000 });
			const first = (r.stdout || r.stderr).trim().split("\n")[0] ?? "";
			checks.push({ name, ok: r.code === 0, detail: first || `exit ${r.code}`, required: true });
		} catch (err) {
			checks.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err), required: true });
		}
	};

	await probe("node", "node", ["--version"]);
	await probe("npx", "npx", ["--version"]);
	await probe("ffmpeg", "ffmpeg", ["-version"]);
	await probe("ffprobe", "ffprobe", ["-version"]);

	const keySet = Boolean(process.env.ELEVENLABS_API_KEY);
	checks.push({
		name: "ELEVENLABS_API_KEY",
		ok: keySet,
		detail: keySet ? "set (value hidden)" : "MISSING — export it in your shell, do not paste it in chat",
		required: true,
	});
	checks.push({
		name: "ELEVENLABS_VOICE_ID",
		ok: true,
		detail: process.env.ELEVENLABS_VOICE_ID ? "set" : "unset (tts.mjs default voice will be used)",
		required: false,
	});

	const scripts: Record<string, string | null> = {};
	for (const name of ["tts.mjs", "synth-audio.mjs", "verify.sh"]) {
		scripts[name] = findScript(ctx.cwd, name) ?? null;
	}
	const scriptsOk = Object.values(scripts).every(Boolean);
	checks.push({
		name: "skill scripts",
		ok: scriptsOk,
		detail: scriptsOk
			? dirname(scripts["tts.mjs"] as string)
			: `missing: ${Object.entries(scripts)
					.filter(([, v]) => !v)
					.map(([k]) => k)
					.join(", ")}`,
		required: true,
	});

	return { ok: checks.filter((c) => c.required).every((c) => c.ok), checks, scripts };
}

function formatChecks(checks: Check[]): string {
	return checks.map((c) => `${c.ok ? "PASS" : "FAIL"} ${c.name}: ${c.detail}`).join("\n");
}

/** Write a file only if it does not exist. Returns true when created. */
async function writeNewFile(path: string, content: string): Promise<boolean> {
	return withFileMutationQueue(path, async () => {
		await mkdir(dirname(path), { recursive: true });
		try {
			await writeFile(path, content, { encoding: "utf8", flag: "wx" });
			return true;
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "EEXIST") return false;
			throw err;
		}
	});
}

export default function explainerVideo(pi: ExtensionAPI) {
	pi.registerFlag("explainer-yes", {
		description: "Skip the confirmation prompt before explainer_tts spends ElevenLabs credits",
		type: "boolean",
		default: false,
	});

	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode === "tui") {
			const key = process.env.ELEVENLABS_API_KEY ? "" : " · no ElevenLabs key";
			ctx.ui.setStatus("explainer-video", `🎬 explainer-video${key}`);
		}
	});

	// Never let the agent print API-key values into the transcript or logs.
	pi.on("tool_call", async (event, _ctx) => {
		if (!isToolCallEventType("bash", event)) return;
		const cmd = event.input.command ?? "";
		const printsKey =
			/\bprintenv\b[^\n]*ELEVENLABS_/.test(cmd) ||
			/(?:^|[;&|]\s*)(?:echo|printf)\b[^\n]*\$\{?ELEVENLABS_/.test(cmd);
		if (printsKey) {
			return {
				block: true,
				reason:
					"Blocked by explainer-video extension: never print ELEVENLABS_* values. Use explainer_preflight to check that the key is set.",
			};
		}
	});

	// ------------------------------------------------------------------ tools

	pi.registerTool({
		name: "explainer_preflight",
		label: "Explainer Preflight",
		description:
			"Check everything the explainer-video pipeline needs: node, npx, ffmpeg, ffprobe, ELEVENLABS_API_KEY presence (value never shown), and the bundled skill scripts. Run this before starting a video.",
		promptSnippet: "Check explainer-video prerequisites (node, ffmpeg, ElevenLabs key, scripts)",
		promptGuidelines: [
			"Use explainer_preflight at the start of any explainer-video task instead of probing the environment with bash.",
		],
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, signal, _onUpdate, ctx) {
			const { ok, checks, scripts } = await runPreflight(pi, ctx, signal);
			const text = `${formatChecks(checks)}\n\n${ok ? "Ready to make an explainer video." : "Not ready — fix the FAIL items above first. If the ElevenLabs key is missing, ask the user to export ELEVENLABS_API_KEY in their shell (never ask them to paste it)."}`;
			if (!ok) throw new Error(text);
			return { content: [{ type: "text", text }], details: { ok, checks, scripts } };
		},
	});

	pi.registerTool({
		name: "explainer_scaffold",
		label: "Explainer Scaffold",
		description:
			"Create the folder skeleton for a new explainer video: research/ (notes + sources templates), script/ (empty narration.txt + beats.md with a word budget), public/ and out/. Never overwrites existing files.",
		promptSnippet: "Scaffold a new explainer-video project folder for a topic",
		promptGuidelines: [
			"Use explainer_scaffold to start a new explainer video instead of creating the folder layout by hand.",
		],
		parameters: Type.Object({
			topic: Type.String({ description: "Video topic, e.g. \"how lithium-ion batteries degrade\"" }),
			dir: Type.Optional(
				Type.String({ description: "Project directory, relative to cwd (default: videos/<topic-slug>)" }),
			),
			targetSeconds: Type.Optional(
				Type.Number({ description: "Target video length in seconds (default 90)", minimum: 20, maximum: 900 }),
			),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const seconds = params.targetSeconds ?? 90;
			const wordBudget = Math.round((seconds * 155) / 60);
			const root = params.dir ? resolvePath(ctx, params.dir) : join(ctx.cwd, "videos", slugify(params.topic));
			const today = new Date().toISOString().slice(0, 10);

			const files: Array<[string, string]> = [
				[
					join(root, "research", "sources.md"),
					`# Sources — ${params.topic}\n\nAccessed: ${today}\n\n1. [Publisher — Title](https://example.com) — what it supports\n\n## Claim → source\n\n- (claim in narration) → [1]\n`,
				],
				[
					join(root, "research", "notes.md"),
					`# Research notes — ${params.topic}\n\n## Angle (the one question this video answers)\n\n-\n\n## Facts (each with a [n] ref into sources.md)\n\n- [1]\n`,
				],
				[
					join(root, "script", "beats.md"),
					`# Beats — ${params.topic}\n\nTarget: ~${seconds}s ≈ ${wordBudget} spoken words (~155 wpm). Narration lives in narration.txt (plain spoken text only).\nStyle: palette _, fonts _, visual metaphors per beat below. End with a sources card (≥4s).\n\n## Beat 1 — hook\n- Narration:\n- Visual:\n- Sources: [1]\n`,
				],
				[join(root, "script", "narration.txt"), ""],
			];

			const created: string[] = [];
			const skipped: string[] = [];
			for (const dir of ["public", "out"]) await mkdir(join(root, dir), { recursive: true });
			for (const [path, content] of files) {
				(await writeNewFile(path, content) ? created : skipped).push(path);
			}

			const rel = (p: string) => (p.startsWith(ctx.cwd) ? p.slice(ctx.cwd.length + 1) : p);
			const text = [
				`Explainer project: ${root}`,
				`Target ~${seconds}s ≈ ${wordBudget} words of narration.`,
				created.length ? `Created:\n${created.map((p) => `  ${rel(p)}`).join("\n")}` : "Created: (nothing)",
				skipped.length ? `Already existed (left untouched):\n${skipped.map((p) => `  ${rel(p)}`).join("\n")}` : "",
				"Next: research into research/notes.md + sources.md, then write script/narration.txt and script/beats.md. Show the script to the user before calling explainer_tts for real.",
			]
				.filter(Boolean)
				.join("\n");
			return {
				content: [{ type: "text", text }],
				details: { dir: root, created, skipped, targetSeconds: seconds, wordBudget },
			};
		},
	});

	pi.registerTool({
		name: "explainer_tts",
		label: "Explainer TTS",
		description:
			"Generate an ElevenLabs voiceover with word timings from a narration script. Writes vo.mp3 and words.json ([{t,s,e}] seconds) to outDir. Costs ElevenLabs credits on a real run — always dryRun first; in interactive mode the user is asked to confirm before spending.",
		promptSnippet: "ElevenLabs voiceover + word timings from a narration script (confirm-gated)",
		promptGuidelines: [
			"Use explainer_tts with dryRun: true first, show the user the narration script, and only call explainer_tts for real (dryRun: false) after they approve it.",
			"Use explainer_tts instead of running tts.mjs via bash, so the spend confirmation and key handling apply.",
		],
		parameters: Type.Object({
			script: Type.String({ description: "Path to narration.txt (plain spoken text), relative to cwd" }),
			outDir: Type.String({ description: "Output dir for vo.mp3 + words.json (usually <project>/public)" }),
			dryRun: Type.Optional(
				Type.Boolean({ description: "Validate and print the request without calling ElevenLabs (default false)" }),
			),
			voice: Type.Optional(Type.String({ description: "ElevenLabs voice id (default: env ELEVENLABS_VOICE_ID)" })),
			model: Type.Optional(Type.String({ description: "ElevenLabs model id (default: eleven_multilingual_v2)" })),
			stability: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
			similarity: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
			speed: Type.Optional(Type.Number({ minimum: 0.7, maximum: 1.2 })),
		}),
		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const tts = findScript(ctx.cwd, "tts.mjs");
			if (!tts) throw new Error("tts.mjs not found — is the explainer-video skill installed under .pi/skills/?");
			const scriptAbs = resolvePath(ctx, params.script);
			const outAbs = resolvePath(ctx, params.outDir);
			const dryRun = params.dryRun ?? false;

			let wordCount = 0;
			try {
				const text = (await readFile(scriptAbs, "utf8")).trim();
				if (!text) throw new Error(`Narration script is empty: ${scriptAbs}`);
				wordCount = text.split(/\s+/).length;
			} catch (err) {
				if ((err as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`Narration script not found: ${scriptAbs}`);
				throw err;
			}
			const estSec = Math.round(wordCount / 2.6);

			if (!dryRun) {
				if (!process.env.ELEVENLABS_API_KEY) {
					throw new Error("ELEVENLABS_API_KEY is not set. Ask the user to export it in their shell — never ask them to paste it in chat.");
				}
				if (ctx.hasUI && !pi.getFlag("explainer-yes")) {
					const ok = await ctx.ui.confirm(
						"Generate voiceover with ElevenLabs?",
						`~${wordCount} words (~${estSec}s of speech). This spends ElevenLabs credits.\nScript: ${scriptAbs}\nOutput: ${outAbs}`,
					);
					if (!ok) {
						return {
							content: [{ type: "text", text: "Voiceover cancelled by the user. Do not retry explainer_tts until they approve the script." }],
							details: { cancelled: true, wordCount, estSec },
						};
					}
				}
			}

			const args = [tts, "--script", scriptAbs, "--out", outAbs];
			if (params.voice) args.push("--voice", params.voice);
			if (params.model) args.push("--model", params.model);
			if (params.stability !== undefined) args.push("--stability", String(params.stability));
			if (params.similarity !== undefined) args.push("--similarity", String(params.similarity));
			if (params.speed !== undefined) args.push("--speed", String(params.speed));
			if (dryRun) args.push("--dry-run");

			onUpdate?.({ content: [{ type: "text", text: dryRun ? "Validating TTS request…" : `Generating voiceover (~${wordCount} words)…` }] });
			const r = await pi.exec("node", args, { signal, timeout: 180_000 });
			const output = tail([r.stderr, r.stdout].filter(Boolean).join("\n"));
			if (r.code !== 0) throw new Error(`tts.mjs failed (exit ${r.code}):\n${output}`);

			if (dryRun) {
				return {
					content: [{ type: "text", text: `Dry run OK — no credits spent. ~${wordCount} words (~${estSec}s).\n${output}` }],
					details: { dryRun: true, wordCount, estSec, script: scriptAbs, outDir: outAbs },
				};
			}

			let durationSec: number | undefined;
			let timedWords: number | undefined;
			try {
				const words = JSON.parse(readFileSync(join(outAbs, "words.json"), "utf8")) as Array<{ e: number }>;
				timedWords = words.length;
				durationSec = words.at(-1)?.e;
			} catch {
				// words.json details are best-effort; vo.mp3 existence is checked by the script's exit code.
			}
			return {
				content: [
					{
						type: "text",
						text: `Voiceover done: ${join(outAbs, "vo.mp3")} + words.json (${timedWords ?? "?"} timed words${durationSec ? `, ends at ${durationSec.toFixed(2)}s` : ""}).\n${output}`,
					},
				],
				details: { dryRun: false, vo: join(outAbs, "vo.mp3"), words: join(outAbs, "words.json"), wordCount, timedWords, durationSec },
			};
		},
	});

	pi.registerTool({
		name: "explainer_synth_audio",
		label: "Explainer Synth Audio",
		description:
			"Generate a code-synthesized music bed + 4 SFX (whoosh/pop/impact/tick) as WAV files — no licensing questions. Writes bed.wav and sfx-*.wav to outDir.",
		promptSnippet: "Synthesize a music bed + SFX for an explainer video (no licensed audio)",
		promptGuidelines: [
			"Use explainer_synth_audio for the music bed and SFX instead of downloading audio, unless a verifiably CC0 source is recorded in research/sources.md.",
		],
		parameters: Type.Object({
			outDir: Type.String({ description: "Output dir (usually <project>/public)" }),
			durationSeconds: Type.Number({ description: "Bed length in seconds (total video duration)", minimum: 1, maximum: 1800 }),
			key: Type.Optional(StringEnum(["A", "C", "D", "E", "F", "G"] as const)),
			mood: Type.Optional(StringEnum(["calm", "tense", "bright"] as const)),
			bpm: Type.Optional(Type.Number({ description: "Pulse tempo; 0 disables the pulse", minimum: 0, maximum: 240 })),
			seed: Type.Optional(Type.Number()),
			dryRun: Type.Optional(Type.Boolean()),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const synth = findScript(ctx.cwd, "synth-audio.mjs");
			if (!synth) throw new Error("synth-audio.mjs not found — is the explainer-video skill installed under .pi/skills/?");
			const outAbs = resolvePath(ctx, params.outDir);
			const args = [synth, "--out", outAbs, "--duration", String(params.durationSeconds)];
			if (params.key) args.push("--key", params.key);
			if (params.mood) args.push("--mood", params.mood);
			if (params.bpm !== undefined) args.push("--bpm", String(params.bpm));
			if (params.seed !== undefined) args.push("--seed", String(params.seed));
			if (params.dryRun) args.push("--dry-run");

			const r = await pi.exec("node", args, { signal, timeout: 180_000 });
			const output = tail([r.stderr, r.stdout].filter(Boolean).join("\n"));
			if (r.code !== 0) throw new Error(`synth-audio.mjs failed (exit ${r.code}):\n${output}`);
			const files = ["bed.wav", "sfx-whoosh.wav", "sfx-pop.wav", "sfx-impact.wav", "sfx-tick.wav"].map((f) => join(outAbs, f));
			return {
				content: [{ type: "text", text: `${params.dryRun ? "Dry run OK." : `Wrote music bed + SFX to ${outAbs}`}\n${output}` }],
				details: { outDir: outAbs, durationSeconds: params.durationSeconds, dryRun: params.dryRun ?? false, files: params.dryRun ? [] : files },
			};
		},
	});

	pi.registerTool({
		name: "explainer_verify",
		label: "Explainer Verify",
		description:
			"Verify a rendered explainer MP4: 1920x1080, audio stream present and non-silent, duration; extracts sampled frames + a contact sheet for visual inspection. Fails (throws) if any check fails.",
		promptSnippet: "Verify a rendered explainer MP4 (ffprobe checks + sampled frames)",
		promptGuidelines: [
			"Use explainer_verify on every render, then inspect the extracted frames with the read tool (text overflow, caption sync, sources card) before reporting the video as done.",
		],
		parameters: Type.Object({
			video: Type.String({ description: "Path to the rendered MP4, relative to cwd" }),
			expectDuration: Type.Optional(Type.Number({ description: "Expected duration in seconds (±1.5s)", minimum: 1 })),
			frames: Type.Optional(Type.Number({ description: "Number of frames to sample (default 8)", minimum: 1, maximum: 24 })),
			outDir: Type.Optional(Type.String({ description: "Frames output dir (default: <video>_frames next to the MP4)" })),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const verify = findScript(ctx.cwd, "verify.sh");
			if (!verify) throw new Error("verify.sh not found — is the explainer-video skill installed under .pi/skills/?");
			const videoAbs = resolvePath(ctx, params.video);
			if (!existsSync(videoAbs)) throw new Error(`Video not found: ${videoAbs}`);
			const framesDir = params.outDir ? resolvePath(ctx, params.outDir) : `${videoAbs.replace(/\.[^.]+$/, "")}_frames`;

			const args = [verify, videoAbs, "--frames", String(Math.round(params.frames ?? 8)), "--out", framesDir];
			if (params.expectDuration !== undefined) args.push("--expect-duration", String(params.expectDuration));

			const r = await pi.exec("bash", args, { signal, timeout: 180_000 });
			const output = tail([r.stdout, r.stderr].filter(Boolean).join("\n"));
			const inspect = `Frames: ${framesDir} — inspect contact_sheet.jpg and frame_*.jpg with the read tool (frame_last.jpg should show the sources card).`;
			if (r.code !== 0) throw new Error(`Verification FAILED for ${videoAbs}:\n${output}\n${inspect}`);
			return {
				content: [{ type: "text", text: `Verification passed for ${videoAbs}:\n${output}\n${inspect}` }],
				details: { video: videoAbs, framesDir, passed: true },
			};
		},
	});

	// --------------------------------------------------------------- commands

	pi.registerCommand("explainer-preflight", {
		description: "Check explainer-video prerequisites (node, ffmpeg, ElevenLabs key, scripts)",
		handler: async (_args, ctx) => {
			const { ok, checks } = await runPreflight(pi, ctx);
			ctx.ui.notify(`Explainer preflight\n${formatChecks(checks)}`, ok ? "info" : "warning");
		},
	});

	pi.registerCommand("explainer-status", {
		description: "Show the production stage of each video under videos/",
		handler: async (_args, ctx) => {
			const videosDir = join(ctx.cwd, "videos");
			const has = (p: string) => {
				try {
					return statSync(p).size > 0;
				} catch {
					return false;
				}
			};
			const stageOf = (dir: string): string => {
				const outDir = join(dir, "out");
				let rendered = false;
				try {
					rendered = readdirSync(outDir).some((f) => f.endsWith(".mp4"));
				} catch {
					// no out/ yet
				}
				if (rendered) return "rendered (verify + inspect frames, then deliver)";
				if (has(join(dir, "public", "vo.mp3"))) return "voiced (build/render the Remotion project)";
				if (has(join(dir, "script", "narration.txt"))) return "scripted (show script, then explainer_tts)";
				return "scaffolded (research + script)";
			};

			let dirs: string[] = [];
			try {
				dirs = readdirSync(videosDir, { withFileTypes: true })
					.filter((d) => d.isDirectory())
					.map((d) => join(videosDir, d.name))
					.sort();
			} catch {
				// no videos/ yet
			}
			if (dirs.length === 0) {
				ctx.ui.notify("No videos yet. Start one with /explainer <topic>.", "info");
				return;
			}
			const lines = dirs.map((d) => `• ${d.slice(ctx.cwd.length + 1)} — ${stageOf(d)}`);
			ctx.ui.notify(`Explainer videos\n${lines.join("\n")}`, "info");
		},
	});
}
