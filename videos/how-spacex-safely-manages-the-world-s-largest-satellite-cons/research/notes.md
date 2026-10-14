# Research notes — How SpaceX safely manages the world's largest satellite constellation and shares its space-safety data for free

Accessed: 2026-10-14

## Angle (the one question this video answers)

How does SpaceX keep the largest satellite fleet ever flown from colliding with things — and why does it give its space-safety data to rival operators for free?
Answer in three layers: dodge (automated, conservative maneuvers), disappear (low orbits + demisable design + proactive deorbit, incl. the 2026 move to 480 km), and share (free ephemeris screening platform + Stargaze).

## Facts (each with a [n] ref into sources.md)

- As of 2026-08-27 there were 11,102 Starlink satellites in orbit, 11,087 working, per astronomer Jonathan McDowell's tracking, reported by Space.com. Starlink is described there as a "megaconstellation". [1]
- SpaceX (Feb 2025 demisability update): "Starlink operates the world's largest satellite constellation… operates with the most conservative maneuver thresholds in the industry, publicly shares its high-precision ephemerides, and has introduced a space safety service." (Self-reported claim — attribute to SpaceX in narration.) At that time >6,750 in orbit. [2]
- Starlink satellites performed 144,404 collision-avoidance maneuvers in the six months ending 2025-05-30 (Gen1: 59,414; rest Gen2), per SpaceX's FCC semi-annual report as covered by Space Intel Report (2025-07-28). Note: SpaceX had also lowered its maneuver threshold, so the rise is not purely a crowding signal. [3]
- Starlink operates below 600 km; at those altitudes atmospheric drag deorbits a failed satellite naturally in 5 years or less. SpaceX proactively deorbits satellites at elevated risk of becoming non-maneuverable. Satellites are "fully demisable by design" (burn up on reentry). [4]
- SpaceX shares high-fidelity future position + uncertainty predictions "multiple times a day" with other operators/launch providers, and encourages all operators to publish ephemerides. [4]
- Jan 2026: SpaceX lowering ~4,400 Starlinks from ~550 km to 480 km over the course of 2026 (Reuters, 2026-01-01; SpaceNews). Reasons given by Michael Nicolls, VP Starlink engineering: below 500 km there are significantly fewer debris objects and planned constellations, reducing aggregate collision likelihood; and ballistic decay time at solar minimum drops >80% — from 4+ years to a few months. Moves coordinated with US Space Command, regulators, other operators. [5][6]
- Space Safety platform docs (space-safety.starlink.com/docs): Starlink publishes its ephemeris to its public website and multiple screening platforms. The platform "is always free of charge to participating spacecraft operators," gives low-latency conjunction screening vs user-submitted data and Stargaze observations, screening results "typically available less than a minute from trajectory submission," and Starlink GNSS states update hourly. API limited to satellite operators. [7]
- Stargaze (SpaceX announcement, 2026-01-29): space situational awareness system using data from nearly 30,000 star trackers, ~30 million transits detected daily across the fleet; autonomously generates near-real-time orbit estimates and Conjunction Data Messages (CDMs); screening results within minutes vs industry standard of several hours. Conjunction data to be made available to all operators free of charge via the space-traffic management platform; closed beta had >12 operators; starting spring 2026 operators submitting ephemeris also receive CDMs vs Stargaze data plus other participants' ephemeris. [8]
- SpaceX's stated motive, quoted in trade press: "By providing this ephemeris sharing and conjunction screening service free of charge, we hope to motivate operators to take similar steps towards ephemeris sharing and safe flight." [9][10]
- Caveats (important for honesty): experts told Breaking Defense Stargaze is only relevant to "low LEO" — "their star trackers aren't telescopes" — and that a neutral civil system (TraCSS) is still needed. The platform terms state screening is only against Starlink ephemerides, other participants' ephemerides, and a limited set of Stargaze-tracked objects — not non-participating operators or debris. [10][11]
- Later update (Starlink updates index, 2026-05-21): Stargaze leverages >30,000 optical sensors to track 50% of objects below 600 km perigee and has begun releasing CDMs. (Not used in narration to keep length; supporting detail.) [12]

## Numbers used on screen (must match narration)

- 11,102 in orbit / 11,087 working (2026-08-27, McDowell via Space.com) [1]
- 144,404 avoidance maneuvers, Dec 2024–May 2025 [3]
- below 600 km operating altitude; ≤5 years natural decay [4]
- ~4,400 satellites moving 550 km → 480 km during 2026; decay time 4+ years → a few months (>80 percent cut) [5][6]
- screening results <1 minute; Starlink GNSS updates hourly [7]
- nearly 30,000 star trackers; ~30 million transits/day; screening within minutes vs several hours [8]
- price: free of charge [7][8]
