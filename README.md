# Antillean (PixelAntColony)

*A living world ant colony simulation.*

Successor to the 2014 [PixelAntColony](https://github.com/ultimape/PixelAntColony) experiment — a cellular-automaton ant colony sim that reached toward something the platform of its day couldn't quite hold. This is the reboot.

---

## What it is

Antillean is a multi-scale ant colony simulation. The player begins as a newly mated queen and progresses through individual ant control, squad tactics, hive building, RTS-scale foraging, and eventually SimCity-scale supercolony management.

The core design principle: **every scale is the same simulation viewed from a different zoom level**. There is no faking or abstraction at higher levels. The world runs at full fidelity continuously.

The deeper design principle: **model the chemistry, not the behavior**. Pheromones are simulated as real fluids obeying real diffusion equations. Ants follow local chemical gradients with simple steering rules. Complex colony behavior — trail formation, alarm cascades, territorial marking, foraging optimization — emerges from the physics rather than from scripted logic.

## Why now

The original 2014 implementation was designed around constraints that no longer exist:

- No WebGPU — fluid sim ran on CPU
- No SharedArrayBuffer — workers couldn't share memory
- Broken JS module ecosystem — required a Scala.js detour
- Adaptive distributed compute had to be built from scratch

The platform has caught up. WebGPU compute shaders, stable SharedArrayBuffer, native ES modules, mature TypeScript tooling, and a decade of clarified thinking about the architecture all make the original vision achievable now.

## Design document

The full architecture is in [ARCHITECTURE.md](./ARCHITECTURE.md) — covering the world representation, pheromone fluid simulation, agent model, behavioral layers (IAUS + FSM hybrid), collaborative-diffusion pathfinding, multi-scale rendering, adaptive performance system, sharded MMO architecture, data-driven design, biological accuracy notes, and a comprehensive speculative-ideas section drawn from over a decade of research notes.

Roughly 1900 lines. Read it as reference material, not as a linear spec.

## Status

Pre-implementation. The architecture is defined, the technology stack is chosen, the milestone path is laid out. Code has not been written yet.

## Heritage

- **2010** — Initial Antillean design notes (gameplay vision, multi-scale gameplay loop, scent/feelings/communication systems)
- **2012** — Cow behavior system, entity action modeling
- **2013** — Collaborative diffusion research
- **2014** — PixelAntColony implementation in Scala.js, the auto-profiling/adaptive-dispatch infrastructure, the first emergent pheromone trails
- **2015-2025** — Continued research, three Are.na channels of accumulated reference material, the recognition that pheromone stigmergy is computation
- **2026** — This document. The reboot starts now.

## License

TBD — leaning toward MIT or Apache 2.0 to honor the original "free/open source" intent from the 2014 design notes.

---

*Long projects are allowed to take a long time.*
