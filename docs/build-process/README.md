# build-process

How this project gets built **by a swarm of AI agents** — the meta-process, not the
sim itself. (For the sim's design, see `ARCHITECTURE.md` at the repo root; that's the
*thing being built*. These docs are *how to orchestrate building it*.)

The infrastructure described here is spec-agnostic — point it at any architecture
spec. This project's WebGPU cellular-automaton ant colony is just the running example.

## Files

1. **`building-a-game-with-an-agent-swarm.md`** — the playbook. Six parts, read in order:
   the engine-architecture map → a build guide → the WorkGraph delegation pattern →
   the dispatch layer (Ollama / GPU backends, kanban as state) → grounding in
   Hermes Agent (with `kimi-k2.5:cloud`) → the bootstrapping loop. Start here.

2. **`bootstrap-subgame-curriculum.yaml`** — the backlog. An ordered, dependency-linked ladder
   of ~two dozen throwaway mini-games and capability spikes (ASCII console maze up to
   a small GPU colony) that hardens the coordination substrate and de-risks each
   subsystem before the real target is attempted. It operationalizes Part VI of the
   playbook. **This one is also operational** — the orchestrator reads it as a starting
   task backlog, so if/when a `workgraph/` directory is stood up (see Part V), this is
   the seed those task graphs are generated from.

## For an agent acting on this

Read `building-a-game-with-an-agent-swarm.md` end to end, then treat `bootstrap-subgame-curriculum.yaml` as a **seed to
refine, not a fixed plan** — validate, reorder, split, or extend the rungs, then emit
each as a kanban WorkGraph (or a triage card for auto-decompose). Bias toward more,
smaller rungs: the whole thesis is that small things one-shot and large things don't.

## Reading order

`building-a-game-with-an-agent-swarm.md` (Parts I→VI) → `bootstrap-subgame-curriculum.yaml`.

> Note: the two files reference each other by filename. If you rename either,
> update the references in both.
