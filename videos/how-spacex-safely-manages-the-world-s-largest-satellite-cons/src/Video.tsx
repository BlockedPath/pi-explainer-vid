import {
  AbsoluteFill,
  Sequence,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio } from "@remotion/media";
import { loadFont as loadDisplayFont } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadMonoFont } from "@remotion/google-fonts/IBMPlexMono";
import wordsRaw from "./words.json";

const DISPLAY = loadDisplayFont().fontFamily;
const MONO = loadMonoFont().fontFamily;

type W = { t: string; s: number; e: number };
const words = wordsRaw as W[];
const FPS = 30;

const C = {
  bg: "#030712",
  panel: "rgba(8, 22, 42, 0.72)",
  ink: "#f8fafc",
  dim: "#94a3b8",
  cyan: "#22d3ee",
  blue: "#38bdf8",
  amber: "#fbbf24",
  green: "#34d399",
  red: "#f87171",
  grey: "#64748b",
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const norm = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();

// Frame of the nth occurrence of a spoken word (throws at bundle time if wrong).
const at = (w: string, n = 0) => {
  const m = words.filter((x) => norm(x.t) === norm(w));
  if (!m.length) throw new Error(`word not in narration: ${w}`);
  return Math.round((m[n] ?? m[0]).s * FPS);
};
const atIdx = (i: number) => Math.round(words[i].s * FPS);
const VO_END = Math.round(words[words.length - 1].e * FPS);
const SOURCES_START = VO_END + 42;

const fadeIn = (f: number, start: number, d = 14) =>
  interpolate(f, [start, start + d], [0, 1], clamp);
const rise = (f: number, start: number, d = 16) =>
  interpolate(f, [start, start + d], [26, 0], clamp);
const pop = (f: number, start: number) =>
  spring({ frame: Math.max(0, f - start), fps: FPS, config: { damping: 13, stiffness: 140 } });

// ---------- shared bits ----------

const Kicker: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color }) => (
  <div
    style={{
      fontFamily: MONO,
      fontSize: 27,
      letterSpacing: 5,
      color: color ?? C.cyan,
      marginBottom: 22,
    }}
  >
    {children}
  </div>
);

const Headline: React.FC<{ children: React.ReactNode; size?: number }> = ({ children, size }) => (
  <div
    style={{
      fontFamily: DISPLAY,
      fontWeight: 700,
      fontSize: size ?? 74,
      lineHeight: 1.04,
      color: C.ink,
    }}
  >
    {children}
  </div>
);

const Chip: React.FC<{
  f: number;
  start: number;
  color?: string;
  children: React.ReactNode;
}> = ({ f, start, color, children }) => (
  <div
    style={{
      opacity: fadeIn(f, start),
      transform: `translateY(${rise(f, start)}px)`,
      display: "flex",
      alignItems: "center",
      gap: 14,
      border: `1px solid ${color ?? C.cyan}55`,
      background: "rgba(8, 22, 42, 0.85)",
      borderRadius: 12,
      padding: "14px 20px",
      fontFamily: MONO,
      fontSize: 27,
      color: C.ink,
      marginTop: 18,
      maxWidth: 800,
    }}
  >
    <span
      style={{
        width: 12,
        height: 12,
        borderRadius: 3,
        background: color ?? C.cyan,
        flexShrink: 0,
        transform: "rotate(45deg)",
      }}
    />
    {children}
  </div>
);

const Counter: React.FC<{
  f: number;
  start: number;
  value: number;
  label: string;
  sub?: string;
  color?: string;
  dur?: number;
  size?: number;
}> = ({ f, start, value, label, sub, color, dur, size }) => {
  const v = Math.round(interpolate(f, [start, start + (dur ?? 42)], [0, value], clamp));
  return (
    <div style={{ opacity: fadeIn(f, start, 8), marginTop: 34 }}>
      <div
        style={{
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: size ?? 116,
          lineHeight: 1,
          color: color ?? C.cyan,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {v.toLocaleString("en-US")}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 27, letterSpacing: 3, color: C.ink, marginTop: 12 }}>
        {label}
      </div>
      {sub ? (
        <div style={{ fontFamily: MONO, fontSize: 23, color: C.dim, marginTop: 6 }}>{sub}</div>
      ) : null}
    </div>
  );
};

const Left: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", left: 92, top: 150, width: 820 }}>{children}</div>
);

const Diagram: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div
    style={{
      position: "absolute",
      left: 982,
      top: 150,
      width: 850,
      height: 760,
      border: "1px solid rgba(34, 211, 238, 0.28)",
      borderRadius: 18,
      background: C.panel,
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        left: 22,
        top: 16,
        fontFamily: MONO,
        fontSize: 21,
        letterSpacing: 3,
        color: C.dim,
        zIndex: 2,
      }}
    >
      {title}
    </div>
    {children}
  </div>
);

const dia = (cx: number, cy: number, r: number) =>
  `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;

// deterministic satellite specs for the orbital diagrams
const SATS = Array.from({ length: 90 }, (_, i) => ({
  lane: i % 5,
  off: random("off" + i) * 880,
  spd: 0.5 + random("spd" + i) * 1.1,
  r: 5 + random("r" + i) * 5,
}));

// ---------- background ----------

const Background: React.FC<{ f: number }> = ({ f }) => {
  const stars = Array.from({ length: 150 }, (_, i) => ({
    x: random("sx" + i) * 1920,
    y: random("sy" + i) * 920,
    r: 1 + random("sr" + i) * 2.2,
    tw: 0.35 + 0.65 * Math.abs(Math.sin(f / 47 + i * 1.7)),
  }));
  const tc =
    `${String(Math.floor(f / 1800)).padStart(2, "0")}:` +
    `${String(Math.floor((f % 1800) / 30)).padStart(2, "0")}:` +
    `${String(f % 30).padStart(2, "0")}`;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.bg} 0%, #050d1f 62%, #07182e 100%)` }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.16,
          backgroundImage:
            "linear-gradient(rgba(56,189,248,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.35) 1px, transparent 1px)",
          backgroundSize: "96px 96px",
        }}
      />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="earth" cx="50%" cy="18%" r="80%">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="55%" stopColor="#0b2a5b" />
            <stop offset="100%" stopColor="#04122b" />
          </radialGradient>
        </defs>
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#e2e8f0" opacity={0.75 * s.tw} />
        ))}
        <ellipse cx={960} cy={1465} rx={1240} ry={430} fill="url(#earth)" />
        <ellipse cx={960} cy={1465} rx={1240} ry={430} fill="none" stroke={C.blue} strokeWidth={3} opacity={0.85} />
        <ellipse cx={960} cy={1465} rx={1310} ry={468} fill="none" stroke={C.cyan} strokeWidth={1.5} opacity={0.35} />
      </svg>
      <div
        style={{
          position: "absolute",
          right: 88,
          top: 58,
          fontFamily: MONO,
          fontSize: 23,
          letterSpacing: 3,
          color: C.dim,
          textAlign: "right",
        }}
      >
        STARLINK // SPACE SAFETY
        <div style={{ color: C.cyan, marginTop: 6 }}>T+{tc}</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 92,
          top: 58,
          fontFamily: MONO,
          fontSize: 23,
          letterSpacing: 3,
          color: C.dim,
        }}
      >
        ORBITAL TRAFFIC CONTROL
      </div>
    </AbsoluteFill>
  );
};

// ---------- captions ----------

const phrases: W[][] = [];
{
  let cur: W[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const nx = words[i + 1];
    if (
      /[.?!]$/.test(w.t) ||
      cur.length >= 7 ||
      (/,$/.test(w.t) && cur.length >= 4) ||
      (nx && nx.s - w.e > 0.5)
    ) {
      phrases.push(cur);
      cur = [];
    }
  });
  if (cur.length) phrases.push(cur);
}

const Captions: React.FC<{ f: number }> = ({ f }) => {
  const t = f / FPS;
  if (f >= SOURCES_START - 6) return null;
  const ph = phrases.find((p) => t >= p[0].s - 0.05 && t <= p[p.length - 1].e + 0.3);
  if (!ph) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 46,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          maxWidth: 1520,
          textAlign: "center",
          background: "rgba(2, 8, 23, 0.82)",
          border: "1px solid rgba(34,211,238,0.25)",
          borderRadius: 999,
          padding: "16px 38px",
          fontFamily: MONO,
          fontSize: 40,
          lineHeight: 1.25,
          color: "#cbd5e1",
        }}
      >
        {ph.map((w, i) => {
          const active = t >= w.s && t <= w.e;
          return (
            <span key={i} style={{ color: active ? C.cyan : "#cbd5e1", fontWeight: active ? 700 : 400 }}>
              {w.t}
              {i < ph.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ---------- scenes ----------

const Scene1: React.FC<{ f: number }> = ({ f }) => {
  const shown = Math.round(interpolate(f, [12, at("11,102") + 55], [0, SATS.length], clamp));
  return (
    <>
      <Left>
        <div style={{ opacity: fadeIn(f, 4), transform: `translateY(${rise(f, 4)}px)` }}>
          <Kicker>SPACEX · STARLINK</Kicker>
          <Headline>
            The largest fleet
            <br />
            ever flown
          </Headline>
        </div>
        <Counter f={f} start={at("11,102")} value={11102} label="SATELLITES IN ORBIT" sub="late Aug 2026 · J. McDowell count via Space.com" />
        <Counter f={f} start={at("11,087")} value={11087} label="OF THEM WORKING" color={C.green} size={84} />
        <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
          <Chip f={f} start={at("automated")}>AUTOMATED</Chip>
          <Chip f={f} start={at("shared", 0)} color={C.green}>SHARED</Chip>
        </div>
      </Left>
      <Diagram title="LOW EARTH ORBIT — LIVE SCHEMATIC">
        <svg width={850} height={760}>
          {[0, 1, 2, 3, 4].map((l) => (
            <line key={l} x1={0} y1={180 + l * 105} x2={850} y2={180 + l * 105} stroke={C.blue} strokeWidth={1.4} opacity={0.45} />
          ))}
          {SATS.slice(0, shown).map((s, i) => {
            const x = ((s.off + f * s.spd) % 880) - 15;
            const y = 180 + s.lane * 105;
            return <polygon key={i} points={dia(x, y, s.r)} fill={C.cyan} opacity={0.92} />;
          })}
          <text x={24} y={712} fill={C.dim} fontFamily={MONO} fontSize={21}>
            each diamond = sampled satellite (schematic, not to scale)
          </text>
        </svg>
      </Diagram>
    </>
  );
};

const Scene2: React.FC<{ f: number }> = ({ f }) => {
  const start = atIdx(48);
  const dodgeAt = at("conservative");
  const shifted =
    interpolate(f, [dodgeAt, dodgeAt + 26], [0, 1], clamp) -
    interpolate(f, [dodgeAt + 200, dodgeAt + 250], [0, 1], clamp);
  const sx = interpolate(f, [start, start + 640], [50, 800], clamp);
  const sy = 410 - shifted * 110;
  const dx = interpolate(f, [start, start + 640], [780, 140], clamp);
  const dy = interpolate(f, [start, start + 640], [170, 590], clamp);
  const cleared = f >= dodgeAt + 20;
  const pulse = 52 + 9 * Math.sin(f / 4);
  const thresh = interpolate(f, [at("conservative"), at("conservative") + 50], [62, 22], clamp);
  return (
    <>
      <Left>
        <div style={{ opacity: fadeIn(f, start), transform: `translateY(${rise(f, start)}px)` }}>
          <Kicker color={C.amber}>LAYER 01 — DODGING</Kicker>
          <Headline size={64}>
            Move early,
            <br />
            not late
          </Headline>
        </div>
        <Counter f={f} start={at("144,404")} value={144404} label="COLLISION-AVOIDANCE MANEUVERS" sub="Dec 2024 – May 2025 · FCC semi-annual report" color={C.amber} />
        <div style={{ opacity: fadeIn(f, at("conservative")), marginTop: 40, maxWidth: 760 }}>
          <div style={{ fontFamily: MONO, fontSize: 23, letterSpacing: 2, color: C.dim }}>
            MANEUVER THRESHOLD (SPACEX: INDUSTRY'S MOST CONSERVATIVE)
          </div>
          <div style={{ height: 20, background: "rgba(148,163,184,0.25)", borderRadius: 999, marginTop: 12, position: "relative" }}>
            <div style={{ position: "absolute", left: `${thresh}%`, top: -7, width: 14, height: 34, borderRadius: 6, background: C.amber }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 21, color: C.dim, marginTop: 8 }}>
            <span>MOVE SOONER</span>
            <span>MOVE LATER</span>
          </div>
        </div>
        <Chip f={f} start={at("lowered")} color={C.blue}>
          Note: the count rose partly because the threshold was lowered
        </Chip>
      </Left>
      <Diagram title="CONJUNCTION — CLOSE APPROACH">
        <svg width={850} height={760}>
          <line x1={0} y1={410} x2={850} y2={410} stroke="#e2e8f0" strokeWidth={2} strokeDasharray="10 12" opacity={0.55} />
          <path d="M 0 410 Q 430 300 850 410" fill="none" stroke={C.green} strokeWidth={2.5} strokeDasharray="12 10" opacity={cleared ? 0.95 : 0.25} />
          <line x1={780} y1={170} x2={140} y2={590} stroke={C.amber} strokeWidth={2} strokeDasharray="8 12" opacity={0.6} />
          <ellipse cx={460} cy={410} rx={pulse * 1.7} ry={pulse} fill="none" stroke={cleared ? C.green : C.amber} strokeWidth={3} />
          <text x={460} y={300} fill={cleared ? C.green : C.amber} fontFamily={MONO} fontSize={25} textAnchor="middle">
            {cleared ? "CONJUNCTION CLEARED" : "CONJUNCTION PREDICTED"}
          </text>
          <circle cx={dx} cy={dy} r={11} fill={C.amber} />
          <text x={dx + 18} y={dy + 6} fill={C.amber} fontFamily={MONO} fontSize={21}>OBJECT</text>
          <polygon points={dia(sx, sy, 15)} fill={C.cyan} />
          <text x={sx} y={sy - 30} fill={C.cyan} fontFamily={MONO} fontSize={21} textAnchor="middle">STARLINK</text>
        </svg>
      </Diagram>
    </>
  );
};

const altY = (alt: number) => 700 - (alt - 420) * 1.9;

const Scene3: React.FC<{ f: number }> = ({ f }) => {
  const lowerStart = at("lowering");
  const lowerEnd = at("months") + 45;
  const fleetY = interpolate(f, [lowerStart, lowerEnd], [altY(550), altY(480)], clamp);
  const deadY = interpolate(f, [at("proactively"), lowerStart - 10], [altY(550), 716], clamp);
  const deadO = 1 - interpolate(f, [lowerStart - 40, lowerStart - 5], [0, 1], clamp);
  const barW = interpolate(f, [at("months"), at("months") + 45], [0, 1], clamp);
  return (
    <>
      <Left>
        <div style={{ opacity: fadeIn(f, atIdx(100)), transform: `translateY(${rise(f, atIdx(100))}px)` }}>
          <Kicker color={C.blue}>LAYER 02 — DISAPPEARING ON PURPOSE</Kicker>
          <Headline size={56}>Built to burn up</Headline>
        </div>
        <div style={{ opacity: fadeIn(f, at("600")), marginTop: 14 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 88, color: C.blue }}>&lt; 600</span>
          <span style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 46, color: C.ink }}> KM</span>
          <div style={{ fontFamily: MONO, fontSize: 25, color: C.dim, marginTop: 6 }}>
            drag deorbits even a failed satellite in 5 YEARS OR LESS
          </div>
        </div>
        <Chip f={f} start={at("burn")} color={C.blue}>Designed to burn up completely on reentry</Chip>
        <Chip f={f} start={at("proactively")} color={C.blue}>At-risk satellites deorbited proactively</Chip>
        <div style={{ opacity: fadeIn(f, at("4,400")), marginTop: 16 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 50, color: C.ink }}>
            4,400 satellites: 550 → 480 KM
          </div>
          <div style={{ fontFamily: MONO, fontSize: 23, color: C.dim }}>lowering during 2026 · scarcer debris below 500 KM</div>
        </div>
        <div style={{ marginTop: 14, maxWidth: 760, opacity: fadeIn(f, at("months")) }}>
          <div style={{ fontFamily: MONO, fontSize: 22, color: C.amber }}>NATURAL DECAY AT 550 KM — 4+ YEARS</div>
          <div style={{ height: 18, width: `${barW * 100}%`, background: C.amber, borderRadius: 999, margin: "8px 0 16px" }} />
          <div style={{ fontFamily: MONO, fontSize: 22, color: C.green }}>AT 480 KM — A FEW MONTHS (80+ PERCENT FASTER)</div>
          <div style={{ height: 18, width: `${barW * 18}%`, background: C.green, borderRadius: 999, marginTop: 8 }} />
        </div>
      </Left>
      <Diagram title="ALTITUDE PROFILE — KM ABOVE EARTH">
        <svg width={850} height={760}>
          {[600, 550, 480].map((alt) => (
            <g key={alt}>
              <line x1={0} y1={altY(alt)} x2={850} y2={altY(alt)} stroke={alt === 600 ? C.red : alt === 480 ? C.green : C.blue} strokeWidth={alt === 600 ? 2.5 : 1.8} strokeDasharray={alt === 600 ? "14 10" : undefined} opacity={0.8} />
              <text x={18} y={altY(alt) - 12} fill={alt === 600 ? C.red : alt === 480 ? C.green : C.blue} fontFamily={MONO} fontSize={23}>
                {alt} KM{alt === 600 ? " — OPERATING CEILING" : ""}
              </text>
            </g>
          ))}
          {Array.from({ length: 14 }, (_, i) => {
            const x = 90 + i * 54;
            return <polygon key={i} points={dia(x, fleetY, 9)} fill={C.cyan} />;
          })}
          <text x={425} y={fleetY - 26} fill={C.cyan} fontFamily={MONO} fontSize={21} textAnchor="middle">4,400 SATELLITES DESCENDING</text>
          <g opacity={deadO}>
            <polygon points={dia(150, deadY, 10)} fill={C.grey} />
            <polygon points={`138,${deadY - 16} 162,${deadY - 16} 150,${deadY - 52}`} fill={C.amber} opacity={deadY > 600 ? 0.95 : 0} />
            <text x={172} y={deadY + 5} fill={C.dim} fontFamily={MONO} fontSize={19}>FAILED UNIT → DRAG</text>
          </g>
          <text x={24} y={742} fill={C.dim} fontFamily={MONO} fontSize={20}>lower orbit = stronger drag = faster natural deorbit</text>
        </svg>
      </Diagram>
    </>
  );
};

const Scene4: React.FC<{ f: number }> = ({ f }) => {
  const freePop = pop(f, at("free", 0));
  const nodes = [
    { x: 425, y: 96, label: "STARLINK FLEET", color: C.cyan },
    { x: 120, y: 612, label: "OPERATOR A", color: "#f472b6" },
    { x: 736, y: 612, label: "OPERATOR B", color: "#a78bfa" },
    { x: 742, y: 150, label: "OPERATOR C", color: "#facc15" },
  ];
  const cx = 425;
  const cy = 392;
  return (
    <>
      <Left>
        <div style={{ opacity: fadeIn(f, atIdx(172)), transform: `translateY(${rise(f, atIdx(172))}px)` }}>
          <Kicker color={C.green}>LAYER 03 — SHARING THE MAP</Kicker>
          <Headline size={64}>
            Everyone sees
            <br />
            the same sky
          </Headline>
        </div>
        <div
          style={{
            marginTop: 36,
            transform: `scale(${0.6 + freePop * 0.4}) rotate(${(1 - freePop) * -8}deg)`,
            opacity: fadeIn(f, at("free", 0), 6),
            display: "inline-block",
            border: `4px solid ${C.green}`,
            color: C.green,
            borderRadius: 16,
            padding: "10px 34px",
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: 92,
            letterSpacing: 4,
          }}
        >
          FREE
        </div>
        <Chip f={f} start={at("ephemeris")} color={C.green}>
          <span>
            <b>Ephemeris</b> = predicted positions, published publicly
          </span>
        </Chip>
        <Chip f={f} start={at("minute")} color={C.green}>Screening results typically in under 1 minute</Chip>
        <Chip f={f} start={at("hourly")} color={C.green}>Starlink navigation data refreshes hourly</Chip>
      </Left>
      <Diagram title="SPACE-SAFETY.STARLINK.COM — EPHEMERIS EXCHANGE">
        <svg width={850} height={760}>
          {nodes.map((n, i) => (
            <line key={i} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke={n.color} strokeWidth={2} strokeDasharray="8 10" opacity={0.65} />
          ))}
          {nodes.map((n, i) => {
            const p = (f / 55 + i * 0.27) % 1;
            const px = n.x + (cx - n.x) * p;
            const py = n.y + (cy - n.y) * p;
            const q = (f / 55 + 0.5 + i * 0.19) % 1;
            const qx = cx + (n.x - cx) * q;
            const qy = cy + (n.y - cy) * q;
            return (
              <g key={"p" + i}>
                <rect x={px - 7} y={py - 7} width={14} height={14} rx={3} fill={n.color} />
                <rect x={qx - 6} y={qy - 6} width={12} height={12} rx={3} fill={C.green} />
              </g>
            );
          })}
          <rect x={cx - 150} y={cy - 56} width={300} height={112} rx={18} fill="#062a1e" stroke={C.green} strokeWidth={3} />
          <text x={cx} y={cy - 12} fill={C.green} fontFamily={MONO} fontSize={23} textAnchor="middle">SPACE-SAFETY</text>
          <text x={cx} y={cy + 22} fill={C.ink} fontFamily={MONO} fontSize={20} textAnchor="middle">PLATFORM</text>
          <text x={cx} y={cy + 50} fill={C.dim} fontFamily={MONO} fontSize={17} textAnchor="middle">free to participants</text>
          {nodes.map((n, i) => (
            <g key={"n" + i}>
              <polygon points={dia(n.x, n.y, 16)} fill={n.color} />
              <text x={n.x} y={n.y + 44} fill={n.color} fontFamily={MONO} fontSize={20} textAnchor="middle">{n.label}</text>
            </g>
          ))}
        </svg>
      </Diagram>
    </>
  );
};

const Scene5: React.FC<{ f: number }> = ({ f }) => {
  const titlePop = pop(f, at("Stargaze", 0));
  const bandH = interpolate(f, [at("warnings"), at("warnings") + 45], [96, 16], clamp);
  const sats = [150, 340, 530, 710];
  return (
    <>
      <Left>
        <div style={{ opacity: fadeIn(f, atIdx(224)), transform: `translateY(${rise(f, atIdx(224))}px)` }}>
          <Kicker>JANUARY 2026 — THE FLEET BECOMES A SENSOR</Kicker>
          <div
            style={{
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: 104,
              color: C.cyan,
              transform: `scale(${0.7 + titlePop * 0.3})`,
              transformOrigin: "left center",
              opacity: fadeIn(f, at("Stargaze", 0), 6),
            }}
          >
            STARGAZE
          </div>
        </div>
        <Counter f={f} start={at("30,000")} value={30000} label="STAR TRACKERS WATCHING" size={88} />
        <Counter f={f} start={at("million")} value={30000000} label="TRANSITS DETECTED PER DAY" dur={55} size={88} />
        <div style={{ display: "flex", gap: 16, marginTop: 28, opacity: fadeIn(f, at("minutes")) }}>
          <div style={{ border: `1px solid ${C.grey}`, borderRadius: 12, padding: "14px 22px", fontFamily: MONO }}>
            <div style={{ fontSize: 21, color: C.dim }}>INDUSTRY STANDARD</div>
            <div style={{ fontSize: 42, color: C.dim, fontWeight: 700 }}>HOURS</div>
          </div>
          <div style={{ border: `1px solid ${C.green}`, borderRadius: 12, padding: "14px 22px", fontFamily: MONO }}>
            <div style={{ fontSize: 21, color: C.green }}>STARGAZE SCREENING</div>
            <div style={{ fontSize: 42, color: C.green, fontWeight: 700 }}>MINUTES</div>
          </div>
        </div>
        <Chip f={f} start={at("charge")} color={C.green}>Conjunction data free to operators who share back</Chip>
      </Left>
      <Diagram title="STAR TRACKERS — CONTINUOUS OBSERVATION">
        <svg width={850} height={760}>
          <rect x={0} y={560 - bandH / 2} width={850} height={bandH} fill={C.amber} opacity={0.16} />
          <line x1={0} y1={560} x2={850} y2={560} stroke={C.amber} strokeWidth={2.5} />
          <text x={24} y={532} fill={C.amber} fontFamily={MONO} fontSize={20}>
            {bandH > 40 ? "OBJECT ORBIT — UNCERTAIN" : "OBJECT ORBIT — PINNED DOWN"}
          </text>
          {sats.map((x, i) => {
            const ang = (Math.PI / 2 + Math.sin(f / 34 + i * 1.3) * 0.42) as number;
            const len = 300;
            const spread = 0.3;
            const x1 = x + Math.cos(ang - spread) * len;
            const y1 = 150 + Math.sin(ang - spread) * len;
            const x2 = x + Math.cos(ang + spread) * len;
            const y2 = 150 + Math.sin(ang + spread) * len;
            return (
              <g key={i}>
                <polygon points={`${x},150 ${x1},${y1} ${x2},${y2}`} fill={C.cyan} opacity={0.14} />
                <polygon points={dia(x, 150, 14)} fill={C.cyan} />
              </g>
            );
          })}
          {Array.from({ length: 9 }, (_, i) => {
            const x = ((random("ob" + i) * 900 + f * (0.8 + (i % 3) * 0.5)) % 900) - 25;
            const y = 330 + (i % 3) * 92;
            const seen = (f + i * 37) % 100 < 34;
            return (
              <g key={"o" + i}>
                <circle cx={x} cy={y} r={8} fill={seen ? "#ffffff" : C.grey} />
                {seen ? <circle cx={x} cy={y} r={17} fill="none" stroke={C.cyan} strokeWidth={2} /> : null}
              </g>
            );
          })}
          <text x={24} y={712} fill={C.dim} fontFamily={MONO} fontSize={20}>millions of sightings → near real-time orbit estimates</text>
        </svg>
      </Diagram>
    </>
  );
};

const Scene6: React.FC<{ f: number }> = ({ f }) => {
  const start = atIdx(296);
  const take = at("Nonetheless");
  const dim = interpolate(f, [take, take + 30], [1, 0.32], clamp);
  const final = at("shared", 1);
  const finalPop = pop(f, final);
  return (
    <>
      <Left>
        <div style={{ opacity: fadeIn(f, start) * 1, transform: `translateY(${rise(f, start)}px)` }}>
          <Kicker color={C.amber}>HONEST LIMITS</Kicker>
          <Headline size={60}>Not the whole answer</Headline>
        </div>
        <div style={{ opacity: dim }}>
          <Chip f={f} start={at("telescopes")} color={C.amber}>Star trackers are not telescopes</Chip>
          <Chip f={f} start={at("Stargaze", 1)} color={C.amber}>Mainly sees low Earth orbit</Chip>
          <Chip f={f} start={at("participating", 1)} color={C.amber}>Screening covers participants + tracked objects</Chip>
        </div>
        <div style={{ opacity: fadeIn(f, take), marginTop: 44 }}>
          <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 54, color: C.ink, lineHeight: 1.12 }}>
            Debris threatens everyone.
            <br />
            The biggest fleet has
            <br />
            the most to lose.
          </div>
        </div>
        <div
          style={{
            opacity: fadeIn(f, final, 8),
            transform: `scale(${0.75 + finalPop * 0.25})`,
            transformOrigin: "left center",
            marginTop: 40,
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: 66,
            lineHeight: 1.08,
            color: C.green,
          }}
        >
          A shared traffic map.
          <br />
          <span style={{ color: C.cyan }}>Not a product.</span>
        </div>
      </Left>
      <Diagram title="COVERAGE — WHERE STARGAZE SEES">
        <svg width={850} height={760}>
          <rect x={0} y={110} width={850} height={300} fill={C.grey} opacity={0.14} />
          <text x={24} y={152} fill={C.dim} fontFamily={MONO} fontSize={22}>HIGHER ORBITS — LIMITED / NO COVERAGE</text>
          <rect x={0} y={410} width={850} height={250} fill={C.green} opacity={0.13} />
          <text x={24} y={452} fill={C.green} fontFamily={MONO} fontSize={22}>LOW EARTH ORBIT — STARGAZE COVERAGE</text>
          {[470, 545, 620].map((y) => (
            <line key={y} x1={0} y1={y} x2={850} y2={y} stroke={C.green} strokeWidth={1.5} opacity={0.6} />
          ))}
          {SATS.slice(0, 36).map((s, i) => {
            const x = ((s.off + f * s.spd) % 880) - 15;
            const y = 470 + (i % 3) * 75;
            return <polygon key={i} points={dia(x, y, s.r)} fill={f >= take ? C.green : C.cyan} opacity={0.9} />;
          })}
          <text x={24} y={722} fill={C.dim} fontFamily={MONO} fontSize={20}>one layer of safety — shared with everyone in it</text>
        </svg>
      </Diagram>
    </>
  );
};

const SOURCES = [
  ["space.com", "Starlink constellation count — J. McDowell's data (11,102 in orbit, Aug 2026)"],
  ["spaceintelreport.com", "144,404 avoidance maneuvers in SpaceX's FCC report, Dec 2024 – May 2025"],
  ["starlink.com (PDF)", "Commitment to Space Sustainability — below 600 km, demisable, proactive deorbits"],
  ["reuters.com · spacenews.com", "About 4,400 Starlinks lowering 550 → 480 km during 2026"],
  ["space-safety.starlink.com", "Space Safety platform docs — always free, results in under a minute"],
  ["starlink.com", "Stargaze announcement, Jan 29 2026 — 30k star trackers, 30M transits/day"],
  ["satellitetoday.com · breakingdefense.com", "Independent coverage of the free offer — and expert caveats"],
];

const SourcesCard: React.FC<{ f: number }> = ({ f }) => {
  const local = f - SOURCES_START;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeIn(local, 0, 18),
      }}
    >
      <div
        style={{
          width: 1460,
          border: "1px solid rgba(34,211,238,0.35)",
          borderRadius: 24,
          background: "rgba(3, 10, 26, 0.94)",
          padding: "54px 64px 44px",
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 26, letterSpacing: 5, color: C.cyan }}>SOURCES</div>
        <div style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 54, color: C.ink, marginTop: 10 }}>
          Every claim in this video, sourced
        </div>
        <div style={{ marginTop: 34 }}>
          {SOURCES.map(([dom, title], i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 26,
                alignItems: "baseline",
                padding: "11px 0",
                borderTop: i ? "1px solid rgba(148,163,184,0.18)" : undefined,
                opacity: fadeIn(local, 14 + i * 13),
                transform: `translateY(${rise(local, 14 + i * 13, 12)}px)`,
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 28, color: C.cyan, width: 520, flexShrink: 0 }}>
                {i + 1}. {dom}
              </div>
              <div style={{ fontFamily: DISPLAY, fontSize: 29, color: "#e2e8f0", lineHeight: 1.3 }}>{title}</div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 22, color: C.dim, marginTop: 32 }}>
          Full URLs + claim-by-claim mapping in research/sources.md · Accessed Oct 14, 2026
          <br />
          Narration: AI voice (ElevenLabs) · Music/SFX: synthesized in code · Diagrams are schematics
        </div>
      </div>
    </div>
  );
};

// ---------- main ----------

const SceneWrap: React.FC<{
  f: number;
  start: number;
  end: number;
  children: React.ReactNode;
}> = ({ f, start, end, children }) => {
  const o =
    fadeIn(f, start, 12) * (1 - interpolate(f, [end - 10, end + 6], [0, 1], clamp));
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

export const StarlinkSafety: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const starts = [0, atIdx(48), atIdx(100), atIdx(172), atIdx(224), atIdx(296)];
  const scenes = [Scene1, Scene2, Scene3, Scene4, Scene5, Scene6];

  return (
    <AbsoluteFill>
      <Background f={frame} />

      <Audio src={staticFile("vo.mp3")} />
      <Audio
        src={staticFile("bed.wav")}
        volume={(fr) =>
          interpolate(
            fr,
            [0, 45, SOURCES_START, SOURCES_START + 30, durationInFrames - 60, durationInFrames],
            [0, 0.2, 0.2, 0.34, 0.34, 0],
            clamp,
          )
        }
      />
      {[starts[1], starts[2], starts[3], starts[4]].map((s) => (
        <Sequence key={s} from={Math.max(0, s - 6)} durationInFrames={50}>
          <Audio src={staticFile("sfx-whoosh.wav")} volume={0.35} />
        </Sequence>
      ))}
      <Sequence from={at("144,404")} durationInFrames={50}>
        <Audio src={staticFile("sfx-impact.wav")} volume={0.45} />
      </Sequence>
      <Sequence from={at("free", 0)} durationInFrames={40}>
        <Audio src={staticFile("sfx-pop.wav")} volume={0.5} />
      </Sequence>
      <Sequence from={at("million")} durationInFrames={40}>
        <Audio src={staticFile("sfx-tick.wav")} volume={0.5} />
      </Sequence>
      <Sequence from={at("charge")} durationInFrames={40}>
        <Audio src={staticFile("sfx-pop.wav")} volume={0.45} />
      </Sequence>

      {scenes.map((Scene, i) => {
        const start = starts[i];
        const end = i < starts.length - 1 ? starts[i + 1] : VO_END + 24;
        return (
          <Sequence key={i} from={start} durationInFrames={end - start + 14}>
            <SceneWrap f={frame} start={start} end={end}>
              <Scene f={frame} />
            </SceneWrap>
          </Sequence>
        );
      })}

      <Sequence from={SOURCES_START} durationInFrames={durationInFrames - SOURCES_START}>
        <SourcesCard f={frame} />
      </Sequence>

      <Captions f={frame} />
    </AbsoluteFill>
  );
};
