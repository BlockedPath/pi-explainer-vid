# Beats — How SpaceX safely manages the world's largest satellite constellation and shares its space-safety data for free

Target: ~120s ≈ 310 spoken words (~155 wpm). Narration lives in narration.txt (plain spoken text only).

## Visual identity (unique to this video)

**"Orbital traffic control" mission HUD.** Deep-space navy (#030712) with a thin cyan grid; a glowing Earth arc along the bottom edge with concentric orbital rings above it that persist across scenes and evolve (rings at 480 / 550 / 600 km get labelled as the story needs them). Satellites = small cyan diamonds moving along rings (deterministic `random()` seeds). Warning states in amber (#fbbf24), "safe/shared" states in green (#34d399), data in cyan (#22d3ee), text near-white (#f8fafc).
Typography: **Space Grotesk** for display/numbers, **IBM Plex Mono** for HUD labels, readouts and captions. Big counting numbers on the left, orbital diagram on the right; lower-third caption pill (word-highlighted, mono). SFX: whoosh on layer changes, tick on counters, pop on FREE reveal, impact on conjunction alert.

## Beat 1 — Hook / scale ("SpaceX flies the largest…")
- Narration: constellation size; 11,102 in orbit / 11,087 working (McDowell, late Aug 2026); safety must be automated and shared.
- Visual: Earth arc rises, rings populate with hundreds of satellite diamonds; counter rolls 0 → 11,102 ("IN ORBIT") then 11,087 ("WORKING"); HUD title "ORBITAL TRAFFIC CONTROL".
- Sources: 1, 2

## Beat 2 — Layer 1: dodging ("Layer one is dodging.")
- Narration: 144,404 maneuvers Dec 2024–May 2025; most conservative thresholds (SpaceX says); count partly reflects lowered threshold.
- Visual: zoom to one ring; amber debris object on a crossing path; conjunction ellipse + "CDM" tag; satellite nudges to a parallel dashed path, ellipse clears to green. Maneuver counter ticks up to 144,404; threshold bar shown sliding "more conservative"; footnote chip: "count rose partly because the threshold dropped".
- Sources: 3, 2

## Beat 3 — Layer 2: disappearing ("Layer two is disappearing on purpose.")
- Narration: below 600 km; drag deorbits failures within 5 years; burn up completely; proactive deorbits; 2026 lowering of ~4,400 satellites 550 → 480 km; decay months not years.
- Visual: altitude ruler on the rings (600 cap line); a failed grey satellite spirals down and burns up as a streak over the ocean; then a whole 550 ring of diamonds descends to the 480 ring with arrows; decay comparison bars: "550 km: 4+ YEARS" vs "480 km: A FEW MONTHS (–80 percent)".
- Sources: 4, 5, 6

## Beat 4 — Layer 3: sharing the map ("Layer three is sharing the map, for free.")
- Narration: ephemeris published on public website + platforms; space-safety platform always free for participating operators; results < 1 minute; navigation data hourly.
- Visual: one satellite beams dashed "EPHEMERIS" packets down to a platform node; packets fan out to other operator glyphs (different hull shapes/colours) who beam theirs back; stopwatch readout "< 60 S"; price tag flips "$" → "FREE" (pop SFX); ticker "GNSS STATES: UPDATED HOURLY".
- Sources: 7, 4

## Beat 5 — Stargaze ("Then SpaceX turned the fleet itself into a sensor.")
- Narration: unveiled Jan 2026; nearly 30,000 star trackers; ~30 million transits/day; near real-time estimates + warnings within minutes vs hours; free conjunction data for operators that share their own trajectories.
- Visual: satellites grow translucent sensor cones that sweep neighbouring objects; transit ticks flash and aggregate into a big counter "30,000,000 / DAY"; orbit estimate lines snap from fuzzy (wide bands) to precise; split clock: "INDUSTRY: HOURS" vs "STARGAZE: MINUTES"; CDMs flow out to operator glyphs.
- Sources: 8, 9

## Beat 6 — Caveat + takeaway ("It is not a complete answer.")
- Narration: star trackers aren't telescopes; mainly low Earth orbit; screening covers participants + tracked objects only; takeaway — shared traffic map, not a product.
- Visual: sensor cones dim beyond the low orbit band (grey zone above labelled "NOT COVERED"); three caveat chips appear; then pull back to full constellation, all rings green, closing line as kinetic type: "A SHARED TRAFFIC MAP. NOT A PRODUCT."
- Sources: 10, 11

## Final — Sources card (held ≥ 4 s, silent tail over bed)
- Visual: "Sources" card, staggered fade-in, ≥28 px: Space.com (McDowell constellation count) · Space Intel Report (FCC maneuver report) · Starlink — Commitment to Space Sustainability · Reuters + SpaceNews (2026 orbit lowering) · Starlink — Space Safety platform docs · Starlink — Stargaze announcement · Via Satellite / Breaking Defense (independent coverage + caveats). Credit line: "Narration: AI voice (ElevenLabs) · Music/SFX: synthesized · Full URLs in research/sources.md".
