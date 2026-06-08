# Building a Game with an Agent Swarm — From Engine Map to Self-Researching Orchestrator

*A single worked thread that starts with the canonical AAA game-engine architecture, turns it into a practical build guide, then into a pattern for delegating that build to parallel AI agents, then into a dispatch layer that farms those agents across Ollama and GPU backends — and ends by instructing the orchestrator to research and stress-test its own premises. Grounded throughout in PixelAntColony / Antillean, but the patterns are general to any game.*

---

## How this document fits together

Four movements, each consuming the one before it:

1. **The Map** — Jason Gregory's runtime engine architecture (Figure 1.16) transcribed as machine-readable YAML. The vocabulary everything else is built on: what an engine actually contains, as a layered dependency graph.
2. **The Build Guide** — that map fused with a 2007 game-production feasibility report. Turns the layer diagram into a *human* process: the three pillars, the design document, the build-vs-adopt decision, a phased roadmap.
3. **The WorkGraph Pattern** — the build guide turned into *data*: a dependency-graph task spec that multiple AI agents execute independently, in parallel, and in builder↔QA loops. The orchestrator never changes; only the graph does.
4. **The Dispatch Layer** — the WorkGraph wired to real infrastructure: Hermes' kanban as state, and an adaptive router that farms tasks to Ollama (cloud/local) or Docker-on-GPU backends. Ends with an explicit directive for the orchestrator to deep-analyze this very document and delegate research reports on its own load-bearing claims.
5. **Grounding in Hermes Agent** — a concrete porting layer: which parts of the pattern are already native to Hermes (Nous Research's framework) and need no building, which need translating to Hermes' real primitives, and which (the adaptive dispatcher) are *your* tool rather than Hermes'. Assumes `kimi-k2.5:cloud` as the main model.
6. **Bootstrapping the coordination game** — the caveat that ties the rest together: none of this one-shots. An orchestrator prompting other AIs is a distributed system written in English, so the real work is iteratively hardening the coordination substrate (prompts, agent-instruction files, acceptance criteria, skills) through small throwaway experiments — and that honing loop is itself the core gameplay loop.

The spine connecting all six: **describe work as a layered dependency graph, decide what you build versus adopt, parallelize across everything that doesn't conflict, close every unit of work with an uncorrelated check — and accept that the coordination substrate itself is built iteratively, not in one shot.** It's the same idea whether the "workers" are a 2007 indie team, AAA engine layers, or a swarm of model-backed agents.

**Companion file.** A separate spec, `bootstrap-subgame-curriculum.yaml`, ships with this document: an ordered, dependency-linked ladder of throwaway mini-games and capability spikes (ASCII console up to a small GPU colony) that operationalizes Part VI. If you're an agent about to *act* on this document, that file is your starting backlog — read it after Part VI.

---

## Table of contents

- **Part I — The Map: Runtime Engine Architecture (YAML)**
- **Part II — The Build Guide: From Engine Map to Shippable Game**
- **Part III — The WorkGraph Pattern: Delegating the Build to Parallel Agents**
- **Part IV — The Dispatch Layer: Farming Tasks to Ollama & GPU Backends**
  - …ending in the Directive to Hermes (deep analysis + research delegation)
- **Part V — Grounding the Pattern in Hermes Agent** (what's native, what to translate, what's yours to build)
- **Part VI — Bootstrapping: The Coordination Game** (why it never one-shots; the meta-loop that hardens the substrate)

---

# Part I — The Map: Runtime Engine Architecture

*This is the foundation: Figure 1.16 from Jason Gregory's* Game Engine Architecture*, transcribed faithfully as machine-readable YAML. Higher layers depend on lower ones. Everything in Parts II–IV uses this layer vocabulary — and the single most useful thing you can do with it is mark each layer **build / adopt / configure**, which is the entire difference between "a few months with a small team" and "a decade."*

```yaml

# Runtime Game Engine Architecture
# Source: Figure 1.16, "Game Engine Architecture" by Jason Gregory
# Structure: top-to-bottom layers. Higher layers depend on lower layers.
# Some blocks span multiple groups in the original diagram; these are noted
# with an "overlaps" field.

title: Runtime game engine architecture
figure: "1.16"

layers:

  - name: Game-Specific Subsystems
    note: Top layer; the actual game built on top of the engine.
    standalone_modules:
      - Weapons
      - Power-Ups
      - Vehicles
      - Puzzles
      - etc.
    groups:
      - name: Game-Specific Rendering
        components:
          - etc.
          - Terrain Rendering
          - Water Simulation & Rendering
      - name: Player Mechanics
        components:
          - State Machine & Animation
          - Camera-Relative Controls (HID)
          - Collision Manifold
          - Movement
      - name: Game Cameras
        components:
          - Fixed Cameras
          - Scripted/Animated Cameras
          - Player-Follow Camera
          - Debug Fly-Through Cam
      - name: AI
        components:
          - Goals & Decision-Making
          - Actions (Engine Interface)
          - Sight Traces & Perception
          - Path Finding (A*)

  - name: Mid-Level Engine Systems
    note: >
      Parallel band of systems in the original diagram. They sit at roughly
      the same level and are grouped here for machine-readability.
    groups:
      - name: Front End
        components:
          - Heads-Up Display (HUD)
          - Full-Motion Video (FMV)
          - In-Game Cinematics (IGC)
          - In-Game GUI
          - In-Game Menus
          - Wrappers / Attract Mode

      - name: Gameplay Foundations
        components:
          - High-Level Game Flow System/FSM
          - Scripting System
          - Static World Elements
          - Dynamic Game Object Model
          - Real-Time Agent-Based Simulation
          - Event/Messaging System
          - World Loading / Streaming
          - name: Hierarchical Object Attachment
            overlaps: [Gameplay Foundations, Skeletal Animation]

      - name: Visual Effects
        components:
          - Light Mapping & Dynamic Shadows
          - HDR Lighting
          - PRT Lighting, Subsurf. Scatter
          - Particle & Decal Systems
          - Post Effects
          - Environment Mapping

      - name: Skeletal Animation
        components:
          - Animation State Tree & Layers
          - Inverse Kinematics (IK)
          - Game-Specific Post-Processing
          - LERP and Additive Blending
          - Animation Playback
          - Sub-skeletal Animation
          - Animation Decompression
          - name: Skeletal Mesh Rendering
            overlaps: [Skeletal Animation, Low-Level Renderer]
          - name: Ragdoll Physics
            overlaps: [Skeletal Animation, Collision & Physics]

      - name: Online Multiplayer
        components:
          - Match-Making & Game Mgmt.
          - Object Authority Policy
          - Game State Replication

      - name: Audio
        components:
          - DSP/Effects
          - 3D Audio Model
          - Audio Playback / Management

      - name: Scene Graph / Culling Optimizations
        components:
          - Spatial Hash (BSP Tree, kd-Tree, ...)
          - Occlusion & PVS
          - LOD System

      - name: Low-Level Renderer
        components:
          - Materials & Shaders
          - Static & Dynamic Lighting
          - Cameras
          - Text & Fonts
          - Primitive Submission
          - Viewports & Virtual Screens
          - Texture and Surface Mgmt.
          - Debug Drawing (Lines etc.)
          - Graphics Device Interface

      - name: Profiling & Debugging
        components:
          - Recording & Playback
          - Memory & Performance Stats
          - In-Game Menus or Console

      - name: Collision & Physics
        components:
          - Forces & Constraints
          - Ray/Shape Casting (Queries)
          - Rigid Bodies
          - Phantoms
          - Shapes/Collidables
          - Physics/Collision World

      - name: Human Interface Devices (HID)
        components:
          - Game-Specific Interface
          - Physical Device I/O

  - name: Resources (Game Assets)
    components:
      - 3D Model Resource
      - Texture Resource
      - Material Resource
      - Font Resource
      - Skeleton Resource
      - Collision Resource
      - Physics Parameters
      - Game World/Map
      - etc.
    manager: Resource Manager

  - name: Core Systems
    components:
      - Module Start-Up and Shut-Down
      - Assertions
      - Unit Testing
      - Memory Allocation
      - Math Library
      - Strings and Hashed String Ids
      - Debug Printing and Logging
      - Localization Services
      - Movie Player
      - Parsers (CSV, JSON, etc.)
      - Profiling / Stats Gathering
      - Engine Config
      - Random Number Generator
      - Curves & Surfaces Library
      - RTTI / Reflection & Serialization
      - Object Handles / Unique Ids
      - Asynchronous File I/O
      - Memory Card I/O (Older Consoles)

  - name: Platform Independence Layer
    components:
      - Platform Detection
      - Primitive Data Types
      - Collections and Iterators
      - File System
      - Networking
      - Hi-Res Timer
      - Threading Library
      - Graphics Wrappers
      - Physics/Coll. Wrapper

  - name: 3rd Party SDKs
    components:
      - DirectX, OpenGL, Vulkan, etc.
      - Havok, PhysX, ODE etc.
      - Boost
      - Folly
      - Kynapse
      - Granny, Havok Animation, etc.
      - Euphoria
      - etc.

  - name: OS
    components: []

  - name: Drivers
    components: []

  - name: Hardware
    note: "PC, Xbox One, PS4, mobile device, etc."
    components: []
```

---

# Part II — The Build Guide: From Engine Map to Shippable Game


*The production logic — how to organize people, scope, and process — fused with the engine map above. (Synthesized from a 2007 feasibility report by Nicholas T. Perry and Gregory's Figure 1.16.)*


*Synthesized from two sources: a 2007 feasibility report by Nicholas T. Perry ("Making a Marketable Real Time Strategy Game") and the runtime engine architecture from Jason Gregory's* Game Engine Architecture *(Figure 1.16). The report supplies the production logic — how to organize people, scope, and process. The diagram supplies the technical map — what a game engine actually contains. This guide welds them together.*

---

### The through-line

The original report's central claim is still the most important thing to internalize, and it's the answer to the "you're telling me you can vibe code this?" joke:

> You do **not** build a game by grinding out 100,000 man-hours of original work. You build it by (a) splitting the work into parallel streams and (b) **adopting** the vast majority of the engine instead of writing it.

The 2007 version of that insight was "five people in tandem beat one person for a year, and indie resources fill the gaps." The 2026 version is sharper: most of the giant architecture diagram below is *already written* — by Unity, Unreal, Godot, Bevy, and the third-party SDKs at the bottom of the stack. Knowing the diagram matters not because you'll type all of it, but because it tells you **what to build vs. what to adopt**, and **in what order things depend on each other**.

---

### Part 1 — The Three Pillars (from the report)

Every game decomposes into three interdependent areas. Get the balance wrong and one pillar starves the others.

1. **Structure** — the underlying framework, documentation, and management. This is the design document, the schedule, the dependency graph, the "system that minimizes how long any one section waits on another." Cheap to produce, disproportionately determines whether the project survives.
2. **Programming** — "the guts and glory." The implementation of the design. Everything else is tailored around what the programmers can actually ship. This is where the engine architecture in Part 4 lives.
3. **Assets** — art, audio, levels, models, textures, UI. For most shipped games, the bulk of the raw data on disk is *assets*, not code. Assets are what give programmers something to work with.

The job of production is balancing the **interdependencies** between these three so nobody is blocked. That balancing act is the real skill — not any single discipline.

---

### Part 2 — Pre-Production: The Design Document

Before any code, write the design document. The report frames it well, quoting Huntsman: it is essentially a **script** that gives "every other professional involved with the product a more than firm idea of what they need to know to implement their portion."

A good design document:

- States the **purpose behind each feature** as it relates to the player — not just "we have HDR lighting" but *why* the player benefits.
- Houses everything from art style/theme (for artists) to implementation specifics (for programmers).
- Is written **hierarchically**, mirroring the engine architecture (Part 4), so each discipline can jump straight to its own section.
- Is treated as **living** — goals get rethought as difficulties surface. A frozen design doc is a dead one.

The payoff: less downtime, fewer "wait, what are we building?" stalls, and a team that can move in parallel because everyone shares the same target.

---

### Part 3 — Validate the Concept (the marketing gate)

The report's two sets of questions are still a solid greenlight checklist. Run a concept through both before committing engineering time.

**Is it worth building? (trend/fit)**
- What are the current trends?
- What are players looking for?
- What tools do we have access to?
- What's been done, and how was it done?

**Will it sell? (distinctiveness + reach)**
- Is the game distinctive — does it stand out *viscerally* and in *gameplay*? Does it involve players socially in a unique way?
- Can it reach a large market — is the idea easy to communicate? Is it built on something the market already knows and loves? Is the target market large?

The report's own answer was an RTS that emphasizes **battle formations over micromanagement** and adds **depth** (RPG progression, mini-games) to fight boredom — picking a genre with a built-in audience to de-risk reach. Whether or not RTS is your genre, the *method* holds: pick a lane where the audience already exists, then differentiate on one or two sharp ideas.

---

### Part 4 — The Engine: a Map of What You're Actually Building

Here's where the architecture diagram earns its place. This is the **full** runtime engine — what a AAA studio maintains. The single most useful thing you can do with it is mark each layer **build / adopt / configure**, because that decision is the entire difference between "a few months with a small team" and "a decade."

The complete layer map (machine-readable), carried over from the earlier transcription:

```yaml
# Runtime Game Engine Architecture
# Source: Figure 1.16, "Game Engine Architecture" by Jason Gregory
# Structure: top-to-bottom layers. Higher layers depend on lower layers.

title: Runtime game engine architecture
figure: "1.16"

layers:

  - name: Game-Specific Subsystems
    note: Top layer; the actual game built on top of the engine.
    standalone_modules: [Weapons, Power-Ups, Vehicles, Puzzles, etc.]
    groups:
      - name: Game-Specific Rendering
        components: [etc., Terrain Rendering, Water Simulation & Rendering]
      - name: Player Mechanics
        components: [State Machine & Animation, Camera-Relative Controls (HID), Collision Manifold, Movement]
      - name: Game Cameras
        components: [Fixed Cameras, Scripted/Animated Cameras, Player-Follow Camera, Debug Fly-Through Cam]
      - name: AI
        components: [Goals & Decision-Making, Actions (Engine Interface), Sight Traces & Perception, Path Finding (A*)]

  - name: Mid-Level Engine Systems
    note: Parallel band of co-equal systems in the original diagram.
    groups:
      - name: Front End
        components: [Heads-Up Display (HUD), Full-Motion Video (FMV), In-Game Cinematics (IGC), In-Game GUI, In-Game Menus, Wrappers / Attract Mode]
      - name: Gameplay Foundations
        components: [High-Level Game Flow System/FSM, Scripting System, Static World Elements, Dynamic Game Object Model, Real-Time Agent-Based Simulation, Event/Messaging System, World Loading / Streaming, Hierarchical Object Attachment]
      - name: Visual Effects
        components: [Light Mapping & Dynamic Shadows, HDR Lighting, "PRT Lighting, Subsurf. Scatter", Particle & Decal Systems, Post Effects, Environment Mapping]
      - name: Skeletal Animation
        components: [Animation State Tree & Layers, Inverse Kinematics (IK), Game-Specific Post-Processing, LERP and Additive Blending, Animation Playback, Sub-skeletal Animation, Animation Decompression, Skeletal Mesh Rendering, Ragdoll Physics]
      - name: Online Multiplayer
        components: [Match-Making & Game Mgmt., Object Authority Policy, Game State Replication]
      - name: Audio
        components: [DSP/Effects, 3D Audio Model, Audio Playback / Management]
      - name: Scene Graph / Culling Optimizations
        components: ["Spatial Hash (BSP Tree, kd-Tree, ...)", Occlusion & PVS, LOD System]
      - name: Low-Level Renderer
        components: [Materials & Shaders, Static & Dynamic Lighting, Cameras, Text & Fonts, Primitive Submission, Viewports & Virtual Screens, Texture and Surface Mgmt., Debug Drawing (Lines etc.), Graphics Device Interface]
      - name: Profiling & Debugging
        components: [Recording & Playback, Memory & Performance Stats, In-Game Menus or Console]
      - name: Collision & Physics
        components: [Forces & Constraints, Ray/Shape Casting (Queries), Rigid Bodies, Phantoms, Shapes/Collidables, Physics/Collision World]
      - name: Human Interface Devices (HID)
        components: [Game-Specific Interface, Physical Device I/O]

  - name: Resources (Game Assets)
    components: [3D Model Resource, Texture Resource, Material Resource, Font Resource, Skeleton Resource, Collision Resource, Physics Parameters, Game World/Map, etc.]
    manager: Resource Manager

  - name: Core Systems
    components: [Module Start-Up and Shut-Down, Assertions, Unit Testing, Memory Allocation, Math Library, Strings and Hashed String Ids, Debug Printing and Logging, Localization Services, Movie Player, "Parsers (CSV, JSON, etc.)", Profiling / Stats Gathering, Engine Config, Random Number Generator, Curves & Surfaces Library, RTTI / Reflection & Serialization, Object Handles / Unique Ids, Asynchronous File I/O, Memory Card I/O (Older Consoles)]

  - name: Platform Independence Layer
    components: [Platform Detection, Primitive Data Types, Collections and Iterators, File System, Networking, Hi-Res Timer, Threading Library, Graphics Wrappers, Physics/Coll. Wrapper]

  - name: 3rd Party SDKs
    components: ["DirectX, OpenGL, Vulkan, etc.", Havok PhysX ODE etc., Boost, Folly, Kynapse, Granny Havok Animation etc., Euphoria, etc.]

  - name: OS
  - name: Drivers
  - name: Hardware
    note: "PC, Xbox One, PS4, mobile device, etc."
```

#### Build / Adopt / Configure — the decision that defines your scope

| Layer | Small indie team should… | Why |
|---|---|---|
| Hardware / Drivers / OS | **Adopt** | Never your problem. |
| 3rd Party SDKs | **Adopt** | This is literally where the diagram tells you to lean on Havok/PhysX, graphics APIs, etc. |
| Platform Independence Layer | **Adopt** (via engine) | An engine already abstracts file system, threading, timers, networking. |
| Core Systems | **Adopt + thin glue** | Memory, math, RNG, serialization, logging — solved problems. Write only the glue. |
| Resources / Resource Manager | **Configure** | Engines give you an asset pipeline; you define formats and import settings. |
| Low-Level Renderer, Scene Graph, Collision & Physics, Audio, HID | **Configure** | These are the engine's headline features. You tune, you don't author. |
| Visual Effects, Skeletal Animation, Multiplayer, Front End | **Configure → light build** | Mostly engine features; some custom shaders/UI/netcode glue. |
| **Gameplay Foundations** | **Build (some)** | Your object model, event system, and scripting integration carry *your* game's identity. |
| **Game-Specific Subsystems** (top layer) | **Build (this is the game)** | Weapons, player mechanics, your AI, your cameras. This is the ~10–20% that's actually yours. |

The lesson the diagram drives home: roughly **everything below the top two layers is something you adopt or configure.** The report's optimism about a small team shipping in months only holds *because* this is true. Choosing an engine (Godot, Unity, Unreal, or a framework like Bevy/MonoGame) is the single biggest scope decision you'll make — it determines how much of the diagram disappears from your to-do list.

---

### Part 5 — Team & Parallelization (from the report)

The report's strongest production insight: most of the work parallelizes. An artist sketches mockups while the UI is built while sounds are recorded while basic frameworks let level designers start planning. The arithmetic it gives still lands — splitting ~10,000 hours across five people working in tandem turns "one person, over a year" into "a small team, a few months."

A workable minimal indie team, mapped to the pillars:

- **Programmer(s)** → Gameplay Foundations + Game-Specific Subsystems (the build-it layers)
- **Level/encounter designer** → builds on the framework once the object model exists ("levels can make or break a game")
- **AI/systems programmer** → AI subsystem ("simple rules → emergent behavior you never expected")
- **3D artist / modeler** → Resources layer (the report's CAD-major insight: machine-part modeling transfers to 3DsMAX/Maya/Blender)
- **Texture/UI artist** → Front End + materials
- **Playtesters** → continuous, cheap, invaluable

The deeper point: parallelization only works if Part 2's design document exists, because that's what lets people work without constantly blocking on each other.

---

### Part 6 — The Build Order

Combine two principles: the architecture is a **bottom-up dependency graph** (higher layers need lower ones), and the production wisdom says **parallelize wherever you can**. That yields a phased roadmap.

**Phase 0 — Decide & document.** Pick genre and engine (collapses most of the diagram). Write the design document. Run the Part 3 marketing gate. *Nothing technical yet — this is pure Structure.*

**Phase 1 — Foundations up.** Stand up the engine; confirm Core Systems + Platform layer work for your targets. Get a window rendering, input registering, one asset loading through the Resource Manager. This is "engine boots and shows a triangle."

**Phase 2 — Gameplay skeleton.** Build the parts that are genuinely *yours*: the Dynamic Game Object Model, event/messaging system, and scripting hook in Gameplay Foundations. Everything above depends on this existing.

**Phase 3 — Core loop, parallelized.** Now the streams fan out — player mechanics + cameras + a placeholder AI + first real assets all proceed at once. Target a single playable, ugly, fun loop. Placeholder art is fine; *fun* is not optional.

**Phase 4 — Content & polish.** Levels, real assets, VFX/animation tuning, front-end/HUD, audio passes. This is where Assets dominate the workload. Add multiplayer here only if it's core to the pitch — it touches everything and is the most expensive thing on the diagram.

**Phase 5 — Test, profile, ship.** Profiling & Debugging tools earn their keep; playtest relentlessly. The report's two goals for the player still govern the bar: **avoid frustration and boredom** while staying distinctive.

---

### Part 7 — Reality check, 2026 edition

A few places where the 2007 report's technical assumptions have aged, worth flagging since the production logic above outlived them:

- **"Dedicate a core to the simulation" was the cutting edge then.** Now multi-core is baseline and the frontier is the GPU, data-oriented design (ECS), and increasingly ML-driven content and behavior. The *idea* — that new hardware opens interaction styles incumbents haven't exploited — is still exactly how you find a niche.
- **Building your own engine was the implicit default in 2007.** Today it almost never is. Mature free engines mean the "build vs. adopt" table above tilts hard toward *adopt*, which is precisely what makes the small-team timeline realistic.
- **Indie resources have only multiplied.** The report's GameDev.net / Gamasutra / IGDA list is now asset stores, open-source engines, package registries, and a deep tutorial ecosystem.

And the joke that started this: *"you're telling me you can vibe code this?"* The honest answer is no — and the diagram is the proof. But you don't have to. The skill isn't typing all ten layers; it's knowing which two are yours, adopting the other eight, and running the parallel production the 2007 report already had right.

---

*Sources fused here: N. Perry, "Feasibility Analysis: Making a Marketable Real Time Strategy Game" (2007); J. Gregory, Game Engine Architecture, Fig. 1.16.*

---

# Bridge — From People to Agents

Part II organizes the build around a small human team working in parallel. Part III makes one substitution: the workers become AI agents. Everything else — the dependency graph, the build-vs-adopt decision, the parallelization, the insistence on an uncorrelated check on every piece of work — carries over unchanged. The arithmetic the 2007 report made about five people beating one person for a year is the same arithmetic that justifies a swarm of agents fanning out across a task graph.

---

# Part III — The WorkGraph Pattern: Delegating the Build to Parallel Agents


*Turns the build guide into a **data-driven task graph** that multiple agents execute independently, in parallel, and in builder↔QA loops. General to any game; worked here against PixelAntColony / Antillean's M1–M7 milestones.*


*A build-orchestration pattern for Hermes. Turns the engine map (Part I) and build guide (Part II) into a **data-driven task graph** that multiple agents can execute independently, in parallel, and in builder↔QA loops. General to any game; worked here against PixelAntColony / Antillean's M1–M7 milestones.*

---

### The core idea

A data-driven simulation separates a fixed engine from the data it runs: the engine never changes, only the parameter tables do, and complex global behavior emerges from simple local rules (a cellular-automaton ant colony is the running example below — agents climb local pheromone gradients, nothing is scripted top-down). The orchestrator that *builds* such a system can be designed the same way.

So: **don't script the agents.** Define a task graph as data, propagate a "ready" signal through it like a diffusing field, and let agents climb the gradient of available work. The orchestrator code never changes; only the WorkGraph data changes — the same fixed-engine / changing-data split, applied to construction instead of simulation.

The mapping to a CA simulation is almost literal:

| CA-simulation concept | WorkGraph equivalent |
|---|---|
| Grid cell with state | Task node with status |
| Pheromone gradient | "Ready" signal diffusing along dependency edges |
| Ant climbing gradient | Agent picking up a ready task |
| Collaborative diffusion (O(1) per ant) | Orchestrator marks readiness once; any free agent grabs it |
| Dibs / temporal tile reservation | `exclusive_resource` locks preventing two agents writing the same file |
| Feelings diffusion (contact) | QA feedback propagating builder↔reviewer |
| Parameter table = behavior | WorkGraph YAML = the entire build plan |

These are the same primitives a CA simulation already uses — here they drive construction instead of the grid.

---

### Three things the pattern has to deliver

You asked for: **delegation**, **parallelism**, and **loops (e.g. Q/A)**. Each maps to one mechanism.

1. **Delegation** → every task is *self-contained*: it carries its own context references, inputs, acceptance criteria, and owning role. An agent can pick it up cold, with no conversation history, and know exactly what "done" means.
2. **Parallelism** → the dependency DAG makes it *mechanical*. Any two tasks whose dependencies are satisfied and that don't share an `exclusive_resource` can run at the same time on different agents. No human decides what parallelizes — the graph does.
3. **Loops** → a task can carry a `qa_loop`: a builder agent produces, a reviewer agent judges against the criteria, and on failure the structured feedback is fed back to the builder. Bounded iterations, then escalate. This is the unit that gives you self-correcting work without a human in the inner loop.

---

### Roles (the agent pool)

Keep the role set small and stable; specialization lives in the task, not the agent.

- **Orchestrator** — owns the WorkGraph. Propagates readiness, dispatches tasks, enforces locks, runs QA loops, escalates. The only stateful actor.
- **Architect** — decomposes a milestone/feature into a sub-WorkGraph; sets acceptance criteria; resolves design ambiguity. Runs *before* builders, and on escalation.
- **Builder** — implements a single task to its acceptance criteria. Stateless between tasks.
- **Reviewer / QA** — the other half of every loop. Judges an artifact against criteria, emits `pass | fail + feedback`. Never edits — only judges, so the judgment stays uncorrelated with the work. (This separation matters; see "QA loops" below.)
- **Tester** — writes and runs executable checks (unit tests, smoke tests, numerical-stability probes). Distinct from Reviewer: Tester produces *evidence*, Reviewer renders a *verdict*.
- **Integrator** — owns merge/integration tasks. These are deliberately serial (`parallel_safe: false`) and hold the exclusive lock on shared surfaces.
- **Researcher (spike)** — for your "Speculative / Unresolved Ideas" pile. Produces a decision doc or prototype, not production code. Output feeds the Architect.

Roles are a routing key, not a personality. The Orchestrator dispatches a task to *any* idle agent of the matching role.

---

### The task schema

This is the whole format. A WorkGraph is a list of these. It's data — Hermes reads it, the orchestrator loop interprets it.

```yaml
# WorkGraph node schema
- id: m1.wgsl-advection            # stable unique id
  title: "Navier-Stokes advection pass in WGSL"
  milestone: M1                    # vertical slice this belongs to
  layer: Collision & Physics       # engine-architecture layer (Part I)
  decision: build                  # build | adopt | configure
  role: builder                    # which agent role owns it

  depends_on: [m1.scent-texture, m1.compute-pipeline]   # DAG edges
  consumes: [artifact:scent_texture, artifact:pipeline]  # inputs from deps
  produces: [artifact:advection_shader]                  # outputs to the blackboard

  context:                         # everything the agent needs to work cold
    - "architecture-spec: pheromone fluid simulation"
    - "GPU Gems Ch.38 (Harris 2004); Stam 1999 stable fluids"
    - "WGSL @workgroup_size(16,16); r32float scent, rg32float velocity"

  acceptance:                      # definition of done — machine-checkable first
    - check: "bilinear backward-advection implemented per Stam method"
    - check: "no NaN/Inf after 1000 ticks on test field (stability)"
    - check: "mass roughly conserved (drift < tolerance) absent sources/decay"
    - check: "passes tester probe m1.advect-stability"

  qa_loop:                         # the builder↔reviewer loop
    reviewer: reviewer
    tester: tester
    max_iterations: 3
    pass_when: "all acceptance checks satisfied AND reviewer verdict == pass"
    on_exhaust: escalate-to-architect

  parallel_safe: true              # can run alongside non-conflicting siblings
  exclusive_resource: ["src/sim/shaders/advect.wgsl"]   # write-lock target
  priority: 2
  status: pending                  # pending | ready | in_progress | review | done | blocked
```

Two fields carry most of the weight: `depends_on` (drives parallelism) and `acceptance` + `qa_loop` (drive correctness). `exclusive_resource` is your "dibs" system — it's what stops two parallel builders from clobbering the same file.

---

### The orchestration loop

The Orchestrator runs one loop. It's short, and it's the only place behavior lives.

```
# 1. Readiness diffusion (one scheduler tick)
for task in graph where task.status == pending:
    if all(dep.status == done for dep in task.depends_on):
        task.status = ready

# 2. Dispatch — climb the work gradient, respect dibs
ready = [t for t in graph if t.status == ready], sorted by priority
for t in ready:
    if agent_pool.has_idle(t.role) and not locked(t.exclusive_resource):
        lock(t.exclusive_resource)
        assign(t, agent_pool.take(t.role))
        t.status = in_progress      # parallel: loop keeps going, fills other agents

# 3. Build↔QA loop (per in_progress task, runs on its agent)
run_task(t):
    for i in 1..t.qa_loop.max_iterations:
        artifact = builder.produce(t.context, t.consumes, t.acceptance)
        evidence = tester.run(t.acceptance.checks_with_probes)
        verdict  = reviewer.judge(artifact, evidence, t.acceptance)
        if verdict.pass:
            blackboard.put(t.produces, artifact)
            t.status = done; unlock(t.exclusive_resource); return
        t.context += verdict.feedback          # feed failure back to builder
    t.status = blocked; unlock(...); escalate(t.qa_loop.on_exhaust)

# 4. Repeat from 1 until all done or all remaining blocked
```

Properties worth noting:

- **Parallelism is free.** Step 2 fills every idle agent each tick. Five builders on five non-conflicting ready tasks is the default, not a special case — the same arithmetic your 2007 report made about five people beating one for a year.
- **No global lock-step.** A slow task doesn't stall the graph; unrelated branches keep flowing. (Compare to your CA: a slow cell doesn't freeze the grid.)
- **Deadlock = a real signal.** If everything is `blocked` and nothing is `ready`, the dependency graph has a cycle or a missing producer. The Architect gets called. This is a *useful* failure, surfaced mechanically.

---

### The blackboard (shared state)

Agents don't talk to each other; they read and write a shared store keyed by artifact id — your SharedArrayBuffer pattern, lifted to the build layer. A task `consumes` its dependencies' `produces` straight off the blackboard. This is what makes delegation work: a Builder needs no memory of who produced `artifact:scent_texture`, only that it's on the board.

Entries are content-addressed where possible (a file path + hash), so a re-run with the same inputs is detectable and skippable — cheap idempotency.

---

### QA loops (the part you called out)

The loop is two *different* agents on purpose. The Builder is optimizing to satisfy the criteria; the Reviewer is optimizing to find where it doesn't. If the same agent does both, the judgment is correlated with the work and the loop closes on self-approval — it'll declare victory on its own blind spots. Breaking a self-approval loop requires an *uncorrelated* input; the Reviewer is that external input for the build.

Make the loop robust:

- **Criteria must be checkable, ranked machine-first.** "No NaN after 1000 ticks" beats "looks stable." A Tester probe that returns a number beats a Reviewer opinion. Reserve the Reviewer's judgment for things probes can't capture (does the shader match the *method*, is the code maintainable).
- **Feedback is structured, not prose.** `{failed_check: id, observed: …, expected: …, hint: …}`. The Builder consumes it as new context, so it shouldn't have to parse vibes.
- **Bound it.** `max_iterations` then escalate. An unbounded builder↔reviewer loop is a money fire and usually means the criteria are wrong, not the code — which is itself the signal to escalate to the Architect.
- **Tester evidence is uncorrelated by construction** — it's just running code. Lean on it. The Reviewer should mostly be *confirming the evidence covers the criteria*, not re-deriving correctness by eye.

A variant worth having: a **standing QA loop** that isn't tied to one task — a Reviewer/Tester pair that periodically re-runs the full smoke suite against `master` and files new tasks when something regresses. That's how you get continuous Q/A across the dozens of parallel sessions you already run.

---

### Worked example A — generic (engine layers as a graph)

Lift the build/adopt/configure table from Part II directly into graph shape. **Adopt** tasks are near-trivial (a Builder wires a dependency, QA confirms it loads). **Configure** tasks are medium. **Build** tasks carry the real QA loops. The decision field tells the Orchestrator how much loop budget a task deserves.

```yaml
- id: gen.platform-layer
  decision: adopt        # engine/runtime gives you this
  depends_on: []
  qa_loop: {max_iterations: 1}    # "does it boot?" — minimal loop
- id: gen.object-model
  decision: build        # this is YOURS — real work
  depends_on: [gen.platform-layer, gen.core-systems]
  qa_loop: {max_iterations: 3}
- id: gen.player-mechanics
  decision: build
  depends_on: [gen.object-model]
  parallel_safe: true    # runs alongside gen.cameras, gen.ai
- id: gen.cameras
  decision: build
  depends_on: [gen.object-model]
  parallel_safe: true
- id: gen.ai
  decision: build
  depends_on: [gen.object-model]
  parallel_safe: true
```

Once `gen.object-model` is `done`, three Builders fan out on mechanics + cameras + AI simultaneously. That fan-out point is the same one from the build-order roadmap — the gameplay skeleton has to exist before the streams diverge.

---

### Worked example B — Antillean Milestone 1, decomposed

Milestone 1 ("Proof of Concept — Fluid Pheromone") from the example sim's architecture spec, turned into a parallelizable graph with QA loops. The checkbox list becomes a DAG.

```yaml
workgraph: antillean.M1
nodes:
  - id: m1.device-setup
    title: "WebGPU device + adapter init"
    decision: configure          # WebGPU is adopted; this is wiring
    role: builder
    depends_on: []
    produces: [artifact:gpu_device]
    qa_loop: {reviewer: reviewer, max_iterations: 2}
    parallel_safe: true
    exclusive_resource: ["src/gpu/device.ts"]

  - id: m1.compute-pipeline
    title: "Basic compute pipeline + bind groups"
    decision: build
    depends_on: [m1.device-setup]
    consumes: [artifact:gpu_device]
    produces: [artifact:pipeline]
    qa_loop: {reviewer: reviewer, tester: tester, max_iterations: 3}
    exclusive_resource: ["src/gpu/pipeline.ts"]

  - id: m1.scent-texture
    title: "Single food-trail scent as r32float texture"
    decision: build
    depends_on: [m1.device-setup]
    consumes: [artifact:gpu_device]
    produces: [artifact:scent_texture]
    parallel_safe: true          # runs alongside m1.compute-pipeline
    exclusive_resource: ["src/sim/scent.ts"]

  - id: m1.wgsl-advection
    title: "Navier-Stokes advection pass (WGSL)"
    decision: build
    depends_on: [m1.compute-pipeline, m1.scent-texture]
    produces: [artifact:advection_shader]
    context: ["architecture-spec: pheromone fluid sim", "GPU Gems Ch.38", "Stam 1999"]
    acceptance:
      - check: "backward bilinear advection per Stam"
      - check: "no NaN/Inf over 1000 ticks (tester: m1.advect-stability)"
    qa_loop: {reviewer: reviewer, tester: tester, max_iterations: 3, on_exhaust: escalate-to-architect}
    exclusive_resource: ["src/sim/shaders/advect.wgsl"]

  - id: m1.wgsl-diffusion
    title: "Diffusion pass (Jacobi iteration, WGSL)"
    decision: build
    depends_on: [m1.compute-pipeline, m1.scent-texture]
    produces: [artifact:diffusion_shader]
    parallel_safe: true          # parallel with m1.wgsl-advection
    qa_loop: {reviewer: reviewer, tester: tester, max_iterations: 3}
    exclusive_resource: ["src/sim/shaders/diffuse.wgsl"]

  - id: m1.decay
    title: "Per-tick decay (pungency parameter)"
    decision: build
    depends_on: [m1.scent-texture]
    parallel_safe: true
    qa_loop: {reviewer: reviewer, max_iterations: 2}
    exclusive_resource: ["src/sim/shaders/decay.wgsl"]

  - id: m1.render
    title: "Render scent layer to canvas"
    decision: build
    depends_on: [m1.scent-texture]
    parallel_safe: true          # rendering develops alongside the physics
    qa_loop: {reviewer: reviewer, max_iterations: 2}
    exclusive_resource: ["src/render/scent-view.ts"]

  - id: m1.source-injection
    title: "Click-to-spray source injection"
    decision: build
    depends_on: [m1.scent-texture, m1.render]
    parallel_safe: true
    qa_loop: {reviewer: reviewer, max_iterations: 2}
    exclusive_resource: ["src/input/spray.ts"]

  - id: m1.integration
    title: "Wire full tick: advect → diffuse → decay → sources → render"
    decision: build
    role: integrator
    depends_on: [m1.wgsl-advection, m1.wgsl-diffusion, m1.decay, m1.render, m1.source-injection]
    acceptance:
      - check: "click-spray produces a visibly diffusing, decaying, advecting blob"
      - check: "matches first-screenshot trail aesthetic (reviewer judgment)"
      - check: "full M1 smoke suite green (tester)"
    qa_loop: {reviewer: reviewer, tester: tester, max_iterations: 3, on_exhaust: escalate-to-architect}
    parallel_safe: false         # serial integration gate; holds the lock
```

How this runs: `m1.device-setup` goes first (root). The moment it's `done`, `m1.compute-pipeline` and `m1.scent-texture` go in parallel. Once `scent-texture` lands, **four branches fan out at once** — diffusion, decay, render, source-injection — each on its own agent, each in its own QA loop, none touching the same file. `m1.wgsl-advection` joins as soon as the pipeline is ready. Everything converges on `m1.integration`, which is serial and owns the assembly. One root, a wide parallel middle, one integration gate — and the Orchestrator derived that schedule purely from `depends_on` and `exclusive_resource`. You wrote no schedule.

---

### Wiring it to Hermes

Concrete shape, framework-agnostic but Hermes-friendly:

- **WorkGraph lives as YAML in the repo** (e.g. `workgraph/M1.yaml`). It's reviewable, diffable, version-controlled — and since it's data, the Architect agent can *generate* it from a milestone and a human can edit it. Treat it exactly like your caste/scent parameter tables.
- **One Hermes agent = Orchestrator**, holding the loop and the blackboard. It spawns/dispatches to worker agents by role. Given your sleep-wake schedule, an Orchestrator that runs the graph forward whenever agents are free means progress accrues across sessions without you babysitting the inner loop.
- **Workers are stateless Hermes agents** keyed by role, handed one task spec + the blackboard slice they `consume`. No shared chat history — the task *is* the brief. (This is why the schema front-loads `context`.)
- **The blackboard** can be the repo itself plus a small status store (`workgraph/state.json`): artifacts are files + hashes, statuses are the node states. Git is your audit log; the WorkGraph state is the live grid.
- **Escalation surfaces to you**, not into an infinite loop. A `blocked` node with exhausted iterations is a notification with the full feedback trail attached — the one place a human (you, or the Architect on your behalf) is actually needed.

---

### What stays true for any game

Strip Antillean out and the pattern is unchanged: a milestone (vertical slice) decomposes into tasks; each task declares `depends_on` (→ parallelism), `decision` (→ how much loop budget), `acceptance` + `qa_loop` (→ correctness), and `exclusive_resource` (→ no clobbering). The engine-architecture layers give you the *vocabulary* for decomposition; the build/adopt/configure call tells you which tasks even exist; the Orchestrator loop is the same handful of lines. Point it at any repo with a WorkGraph and it runs.

The whole thing is one sentence: **describe the work as a diffusing dependency field, let agents climb it, and close every node with an uncorrelated reviewer.** It's the same shape a CA simulation already runs on — pointed at construction instead of the grid.

---

---

# Bridge — From Pattern to Infrastructure

Part III defines *what* the agents do and *how* the work flows. Part IV answers *where each task actually runs* — because the agents are real subagents launched via Ollama (cloud or local) or Docker containers on a remote GPU host, coordinated through Hermes' existing kanban. The punchline of Part IV is that the dispatcher needs almost no novel machinery: it's three well-known techniques — utility-based scoring, collaborative-diffusion scheduling, and adaptive dispatch — repointed from a simulation's compute loop to the build.

---

# Part IV — The Dispatch Layer: Farming Tasks to Ollama & GPU Backends


*Extends the WorkGraph pattern with the dispatch layer for real infrastructure: Hermes' kanban as the state store, and an adaptive router that launches subagents across heterogeneous backends — built from two known techniques, utility-based scoring (IAUS) and adaptive dispatch with rolling stats.*


*Extends the WorkGraph pattern (Part III) with the dispatch layer for real infrastructure: Hermes' kanban as the state store, and a router that launches subagents via Ollama (cloud or local) or Docker containers on a remote GPU host. The key claim: almost none of this is novel — it's an adaptive dispatcher (rolling stats + hysteresis) over a utility scorer (IAUS), repointed from a simulation's compute loop to build work.*

---

### The dispatcher is three known techniques, not a new system

Four orchestration questions, four off-the-shelf answers:

| Orchestration question | Technique |
|---|---|
| Where does a task flow *next*? | Readiness diffusion over the dependency DAG (≈ collaborative-diffusion scheduling) |
| *Which backend* should run it? | Utility scoring (IAUS) — hard constraints as veto axes |
| Which backend is best *right now*? | Adaptive dispatch — rolling stats + hysteresis |
| Where does state *live*? | The kanban — it doubles as the blackboard |

Nothing below is a new system: three known techniques plus a registry of backends. (IAUS is Dave Mark's Infinite Axis Utility System; collaborative diffusion is a standard gradient-following scheduler/pathfinder; adaptive dispatch is the usual rolling-stat router. All public.)

---

### The kanban IS the state layer

A separate `state.json` blackboard would be redundant — Hermes' kanban already is it. Map WorkGraph statuses straight onto lanes:

| WorkGraph status | Kanban lane | Card carries |
|---|---|---|
| `pending` | Backlog | `depends_on`, `requires` |
| `ready` | Ready | (deps satisfied; waiting for a backend) |
| `in_progress` | Doing | **assigned backend + model + agent id**, attempt counter |
| *(review)* | — | **not a lane in Hermes — review is a dependent task; see Part V** |
| `done` | Done | produced artifact refs + completion metadata |
| `blocked` | Blocked | circuit-breaker / exhausted-loop reason |

The Orchestrator is simply *the thing that moves cards across lanes*. Hermes already does the moving; the dispatcher adds one decision at the ready→running transition: **which backend (= which profile, in Hermes — see Part V).** Everything else — the audit trail, parallelism visibility, where work is stuck — you get for free because it's already a board you can look at. (The abstract statuses here map onto Hermes' real lanes `triage | todo | ready | running | blocked | done | archived`; Part V gives the exact correspondence.)

---

### Backend registry

Each backend declares what it *provides*. This is the counterpart to a task's `requires` (next section).

```yaml
backends:
  - id: ollama-cloud
    kind: ollama                 # the kimi-k2.5:cloud path, etc.
    models: [large, strong, reasoning]   # tiers it can serve
    max_concurrency: 8           # really a rate limit, treat as soft-high
    cost: per-token
    health: assume-up            # probe lightly anyway
    warm_models: []              # cloud (re)loads transparently

  - id: ollama-local
    kind: ollama
    endpoint: http://localhost:11434
    models: [small, fast]
    max_concurrency: 2
    cost: free
    health: probe                # tied to that box being awake
    warm_models: [small]

  - id: docker-gpu-remote
    kind: docker                 # a terminal/execution backend (GPU code-exec), see Part V
    access: ssh + ollama-over-ssh
    models: [large, strong]      # bounded by VRAM
    max_concurrency: 3           # bounded by VRAM, not cores
    cost: electricity
    health: probe                # may be asleep — this matters, see fallback
    warm_models: []              # tracked live: which model is resident in VRAM
```

The fields that drive routing are `models` (capability), `cost`, `max_concurrency` (bounds your fan-out), and `health` + `warm_models` (the live, changing state).

---

### What a task `requires`

Add a `requires` block to each WorkGraph node. It's the demand side that the registry's `provides` is matched against.

```yaml
- id: m1.wgsl-advection
  role: builder
  requires:
    model_tier: strong       # WGSL + numerical method = needs a capable model
    min_context: 32k
    tools: [code-exec]
    gpu: false               # the *agent* doesn't need a GPU to WRITE a shader…

- id: m1.advect-stability
  role: tester
  requires:
    model_tier: small        # just drives the probe; cheap model is fine
    tools: [code-exec]
    gpu: true                # …but RUNNING the probe needs the GPU — see Part V
```

The split above is the one that matters: a card that *writes* GPU code needs only a capable model (cloud is fine), while a card that *runs/verifies* GPU code needs a GPU-backed execution environment. Part V shows why these are two different backend axes in Hermes (model backend vs terminal backend), and why conflating them is the main thing to fix when porting this section.

---

### Backend selection = your IAUS scorer, new axes

This is a standard IAUS `scoreAction` with backends as the "actions." Hard constraints are veto axes (return 0); everything else is a soft axis folded into the geometric mean. Argmax over healthy, satisfying, capacity-having backends.

```typescript
function scoreBackend(task: WorkTask, backend: Backend, stats: RollingStats): number {
  // --- Hard veto axes (precondition; zero kills the candidate) ---
  if (task.requires.gpu && !backend.providesGpu)         return 0; // GPU-exec veto (see Part V)
  if (!backend.models.includes(task.requires.model_tier)) return 0; // capability veto
  if (!backend.healthy)                                   return 0; // can't reach it
  if (backend.freeCapacity <= 0)                          return 0; // "dibs" — full

  // --- Soft axes (normalized [0,1], through response curves) ---
  const latency = curve.exp(1 - norm(stats.p50(backend, task.class), 0, MAX_MS)); // faster better
  const cost    = curve.lin(1 - norm(backend.costPerTask(task), 0, MAX_COST));    // cheaper better
  const warm    = backend.warm_models.includes(task.requires.model_tier) ? 1 : 0.6; // avoid reload

  const axes = [latency, cost, warm];
  let product = 1.0;
  for (const a of axes) { if (a <= 0) return 0; product *= a; }
  return Math.pow(product, 1 / axes.length); // geometric mean — your exact pattern
}
```

The vetoes are now purely about *can this backend do the job* — GPU present (for run-code cards), model tier available, reachable, has capacity; the soft axes rank the survivors on speed, cost, and model warmth. Routing is a capability-and-cost decision, nothing more.

---

### Adaptive + anti-thrash (your AdaptiveDispatcher, verbatim logic)

Wrap the scorer in the usual rolling-stats machinery so the dispatcher *learns* which backend is actually fast/cheap for each task class, and doesn't flap:

```typescript
class AgentDispatcher extends AdaptiveDispatcher {
  selectBackend(task: WorkTask): Backend {
    const candidates = this.registry.healthy()
      .map(b => ({ b, s: scoreBackend(task, b, this.scores.get(b)) }))
      .filter(x => x.s > 0);                       // survivors of the vetoes
    if (candidates.length === 0) return null;      // -> task stays in Ready, not failed

    const best = argmax(candidates, x => x.s);
    // hysteresis: only switch off the last-good backend if best beats it by margin
    if (this.lastGood(task.class) && best.b !== this.lastGood(task.class)
        && best.s < this.scoreOf(this.lastGood(task.class)) * SWITCH_MARGIN) {
      return this.lastGood(task.class);
    }
    return best.b;
  }
  // sampleRate(), randomized testing, variance-driven exploration: inherited unchanged
}
```

Same thrashing prevention you already specified: randomized (not periodic) test intervals + a switch margin. The one addition worth making is the `warm` axis above — switching backends often means reloading a model into VRAM, so the cost of switching is real; the warm bias plus hysteresis keeps a hot model hot.

---

### Capacity-aware fan-out

The orchestration loop's dispatch gate (Part III) checked "is a role-agent free." Add one condition: **is there a satisfying backend with free capacity.** That single change makes parallelism honest.

```
ready = tasks in Ready, sorted by priority
for t in ready:
    b = dispatcher.selectBackend(t)          # vetoes + IAUS + hysteresis
    if b == null: continue                   # leave in Ready; try next tick
    claim(b.capacity)                        # capacity is the reservation (see note)
    assignCard(t, profileFor(b))             # in Hermes: route to the profile = backend (Part V)
    runReview(t, b)                          # on done: release capacity
```

Your real ceiling on concurrency is `Σ backend.max_concurrency` across reachable backends — roughly *cloud (rate-limited) + GPU box (≈3, VRAM-bound) + local box (≈2)*. Backend capacity is the "dibs" — a temporal-reservation idea (the same one CA agents use to claim a tile before moving into it), applied to GPUs instead of grid cells. **Caveat (Part V):** Hermes' own concurrency cap (`kanban.max_in_progress`) is *global per board*, not per-backend, so these per-backend ceilings are your dispatcher's responsibility, not something Hermes enforces. Write-conflict isolation between parallel builders is handled by per-task git-worktree workspaces, not by a lock.

---

### Health & the workstation that sleeps

A remote GPU host often won't be awake or SSH-reachable — it may be a workstation that sleeps, and the orchestrator will frequently be running while it's down. Design for that as the normal case, not the exception:

- **Probe before scoring.** An unreachable backend fails the health veto and scores 0, so it's simply absent from candidates — no errors, no retries-into-the-void.
- **Degrade by capability, not by failing.** A GPU-required card with no awake GPU backend stays in **Ready** until one comes up — not blocked, just waiting for capacity. A card that only needs a model falls through to whatever capable backend is reachable (e.g. cloud). Failure mode is "wait," not "error."
- **Hysteresis covers flaky SSH.** A host that's intermittently reachable over SSH would otherwise cause flapping; the switch margin damps it.

---

### The uncorrelated reviewer — now at the weights level

The builder↔reviewer separation from the QA loop gets *stronger* with multiple backends, and nearly free. Route Builder and Reviewer to **different model families** by default:

```yaml
qa_loop:
  builder_backend:  docker-gpu-remote   # big local model writes the code
  reviewer_backend: ollama-cloud        # different family judges it
  tester: tester                        # just runs code — most uncorrelated of all
```

The self-approval risk isn't only "same agent" — it's "same weights." A model tends to rate output in its own style as good. A *different* model reviewing is a genuinely uncorrelated signal, which is the whole point of the loop: a self-approval loop only breaks on input uncorrelated with the work. And the Tester — literally executing the shader for 1000 ticks and checking for NaNs — is the most uncorrelated judge available, so prefer machine-checkable acceptance criteria and let the model reviewer mostly confirm the probes cover the intent.

---

### What you actually have to build

Not much, which is the point:

1. A **backend registry** with health probes (the YAML above + a `probe()` per kind).
2. `scoreBackend` — a copy of your IAUS `scoreAction` with the four axes shown.
3. `AgentDispatcher extends AdaptiveDispatcher` — you already wrote the parent.
4. The **Ready→Doing** hook that calls `selectBackend`, claims capacity, tags the card, and launches the subagent (Ollama HTTP call, or `docker run` over SSH).
5. `requires` blocks on your WorkGraph nodes (data, not code) — chiefly `model_tier` and the `gpu` flag that splits write-code cards from run-code cards.

The orchestration loop, the readiness diffusion, the QA loop, the kanban moves — all already exist in Hermes. You're connecting a small adaptive dispatcher to a board the framework already runs.

---

---

### Directive to Hermes — Deep Analysis & Research Delegation

**Hermes: on ingesting this document, do not merely file it.** Run the analysis-and-research WorkGraph below. It is itself an instance of the pattern this document describes — an Architect decomposition that fans out into parallel Researcher (spike) tasks through the research delegation system, each closed by an uncorrelated Reviewer. Execute it the same way you would any other WorkGraph.

**Scope of analysis:** this entire document — Parts I through V — as one corpus. Treat the connections *between* the parts as first-class material, since the load-bearing claims here are analogies (IAUS→dispatch, collaborative-diffusion→readiness, adaptive-dispatch→model routing) whose validity is exactly what's worth researching.

```yaml
workgraph: orchestration.research-pass
nodes:
  - id: rp.analyze
    title: "Deep-read the corpus; extract ranked research seeds"
    role: architect
    depends_on: []
    requires: { model_tier: reasoning, min_context: 128k }
    produces: [artifact:research_seeds]
    instructions: |
      Read the full corpus. Emit a ranked list of RESEARCH SEEDS — ideas, claims,
      design choices, borrowed analogies, or unresolved tensions that would benefit
      from a dedicated report. A seed qualifies if at least one is true:
        (a) it asserts an analogy or reuse that has real prior art to validate or refute
            ("IAUS is a good scheduler", "kanban as blackboard", "readiness as diffusion");
        (b) it makes a performance/cost/correctness claim that is checkable against literature
            or a quick benchmark;
        (c) it is an explicit unknown (a parking-lot / speculative idea, an `on_exhaust` escalation,
            a "needs a human decision" flag);
        (d) it names a technique/tool whose state-of-the-art has likely moved (model routing,
            LLM-as-judge bias, VRAM-aware serving).
      BIAS TOWARD DISCONFIRMATION. This corpus is four layers of mutually reinforcing
      analogies (IAUS→dispatch, collaborative-diffusion→readiness, AdaptiveDispatcher→model
      routing, kanban→blackboard). They are elegant, which is exactly why they are dangerous —
      elegance papers over disanalogy. Two systems can share a form and diverge entirely in
      their failure modes (a suboptimal ant wastes a tick; a starved task under load is a bug).
      Your job is to find where each analogy BREAKS, not to confirm it holds. Prioritize seeds
      that, if the report comes back 'refuted', would force a real change to the schema, scorer,
      or loop. A seed that can only ever return 'validated' is low priority.
      For each seed record: { id, claim, why_it_matters, break_condition, open_questions[],
                              candidate_sources[], priority: 1-3 }.
    acceptance:
      - check: "≥8 seeds, deduplicated, each with ≥2 open questions"
      - check: "each seed tagged priority"
    qa_loop: { reviewer: reviewer, max_iterations: 2, on_exhaust: surface-to-human }

  - id: rp.research.{seed}      # fan-out: ONE task per seed from rp.analyze
    title: "Research report: {seed.claim}"
    role: researcher
    depends_on: [rp.analyze]
    consumes: [artifact:research_seeds]
    via: research-delegation-system        # use the existing report pipeline
    requires:
      model_tier: strong
      tools: [web, code-exec]
    produces: [artifact:report_{seed.id}]
    report_spec: |
      1. Question — restate the seed's open questions and its break_condition.
      2. Findings — what the literature / prior art / a quick probe actually says. Cite.
         Actively seek the disconfirming case; report it even if the analogy mostly holds.
      3. Verdict on the claim — validated | qualified | refuted, with the conditions.
      4. Implications for the orchestrator — concrete changes to schema, scorer, or loop.
      5. Recommendation — promote to a real build WorkGraph task, or keep speculative.
    qa_loop:
      reviewer: reviewer
      reviewer_backend: "<different model family than the researcher>"  # uncorrelated judge
      max_iterations: 3
      pass_when: "every open_question addressed AND claims cited AND a clear verdict given"
      on_exhaust: surface-to-human

  - id: rp.synthesize
    title: "Roll reports into a findings brief; route outcomes"
    role: architect
    depends_on: [rp.research.*]              # all report tasks done
    produces: [artifact:research_brief]
    instructions: |
      Synthesize the reports into one brief. Group by verdict. For every 'promote'
      recommendation, draft the corresponding build WorkGraph node (id, depends_on,
      acceptance, requires) so it can be dropped straight onto the kanban Backlog.
      For 'keep speculative', file it in the parking-lot / speculative-ideas backlog.
    acceptance:
      - check: "every report represented; promote-items emitted as ready-to-file WorkGraph nodes"
    qa_loop: { reviewer: reviewer, max_iterations: 2, on_exhaust: surface-to-human }
```

**Seed starters** — extracted now so the analysis pass refines rather than originates. Validate, extend, or cut:

```yaml
seed_starters:
  - id: s.iaus-scheduler
    claim: "Geometric-mean utility scoring (IAUS) is a sound basis for model/backend dispatch."
    open_questions: ["How does it compare to contextual-bandit routers (e.g. learned LLM routers)?",
                     "Does the geometric mean's veto behavior cause starvation under load?"]
  - id: s.judge-bias
    claim: "A different-model-family reviewer is a meaningfully uncorrelated judge."
    open_questions: ["What is the measured self-preference bias in LLM-as-judge setups?",
                     "Does cross-family review actually reduce it, and by how much?"]
  - id: s.warm-model-sched
    claim: "VRAM-residency (warm-model) bias materially improves throughput on a GPU host."
    open_questions: ["What's current best practice for model-swap-aware LLM serving/scheduling?",
                     "Where's the break-even between switching for a better model vs staying warm?"]
  - id: s.kanban-blackboard
    claim: "A kanban board is an adequate blackboard for multi-agent orchestration state."
    open_questions: ["What do classic blackboard architectures require that a kanban lacks?",
                     "Where does this break at scale / under concurrent writers?"]
  - id: s.diffusion-scheduling
    claim: "Readiness-as-diffusion over a DAG is equivalent to standard dataflow scheduling."
    open_questions: ["What does it add or lose vs. Temporal/Dagster/Airflow-style engines?"]
  - id: s.hermes-native
    claim: "The WorkGraph adds value over what Hermes Agent already ships natively."
    open_questions: ["Which parts of this pattern are redundant with hermes kanban swarm / the decomposer?",
                     "Is a custom adaptive dispatcher worth it vs. backend-as-profile routing?"]
```

**Dispatch note for this run:** research tasks are web- and tool-enabled. In Hermes terms this whole pass is a `hermes kanban swarm` — parallel researchers → a verifier → a synthesizer — or a triage card left to auto-decompose; see Part V for the exact wiring.

---

---

# Part V — Grounding the Pattern in Hermes Agent

*Parts I–IV are framework-agnostic. This part ports them onto [Hermes Agent](https://hermes-agent.nousresearch.com) (Nous Research, MIT) as actually shipped — the v0.12 "Tenacity" kanban, the built-in decomposer, and the `hermes kanban swarm` topology helper — with `kimi-k2.5:cloud` as the main model. This is researched against Hermes' kanban reference, not assumed. The headline: **most of the pattern is already native; one part of it (the adaptive dispatch in Part IV) is not Hermes at all — it's the orchestration tool you're building — and this part draws that boundary.***

## V.1 — Most of the WorkGraph is already a Hermes primitive

Before building anything, map the abstract pattern onto what Hermes ships. The overlap is large.

| Pattern concept (Parts III–IV) | Hermes primitive | Note |
|---|---|---|
| Readiness diffusion along the DAG | `task_links` (parent → child) + the dispatcher promoting `todo → ready` when **all parents are `done`** | Your core scheduling mechanic *is* the Hermes dispatcher. Don't build it. |
| WorkGraph node | Kanban **task** (title, body, assignee, status, links) | A row in `~/.hermes/kanban.db`. |
| Role | Named **profile** (own memory, skills, model) | `researcher`, `writer`, `reviewer`, `ops`, … |
| Orchestrator (never does the work) | A profile loaded with the **`kanban-orchestrator` skill**, toolsets restricted to `kanban`/`gateway`/`memory` | "A well-behaved orchestrator does not do the work itself" is verbatim Hermes doctrine. |
| Architect decomposition | The built-in **decomposer** (`auxiliary.kanban_decomposer`, `auto_decompose: true`) | Reads your profile roster + descriptions, fans a triage card into a routed task graph. |
| Blackboard / shared state | Structured **JSON comments on a root "blackboard" card** | Not a separate store; `kanban swarm` sets this up automatically. |
| `produces` / `consumes` (artifact handoff) | `kanban_complete(summary, metadata)`; children read the latest completed run's `metadata` | The `metadata` dict is your typed handoff. |
| `exclusive_resource` lock | Per-task **git-worktree workspace** (`.worktrees/<id>/`) | Isolation by directory, not by lock — cleaner, and native. |
| `on_exhaust: escalate` | **Circuit breaker** (`failure_limit` / per-task `max_retries`) → auto-`block` + gateway notification | Plus a `respawn_guard` that already backs off on 429/auth errors. |
| The whole fan-out → review → synthesis shape | **`hermes kanban swarm`** — one command | See V.3. |

The practical consequence: the readiness diffusion, the kanban itself, the retries, the workspaces, and the swarm topology are all things you *configure*, not *write*.

## V.2 — Schema corrections (abstract → Hermes)

The Part III/IV status vocabulary is close but not exact. The real lanes are `triage | todo | ready | running | blocked | done | archived`.

| Part III status | Hermes lane | Note |
|---|---|---|
| `pending` | `todo` | plus `triage` for a rough/undecomposed idea |
| `ready` | `ready` | identical meaning |
| `in_progress` | `running` | rename only |
| `review` | **— (no such lane)** | **review is a *task*, not a status** — see below |
| `done` | `done` | — |
| `blocked` | `blocked` | reached via circuit breaker or `kanban_block` |
| — | `archived`, `triage` | extra lanes you inherit |

**The one that matters: `review` is not a status in Hermes; it's a task.** A reviewer is a separate card gated on the work card (a parent→child link), or the goal-mode judge. Model review as a dependent task, not a lane. This is a genuine improvement to the abstract pattern — it makes the reviewer a first-class, retryable, audited unit with its own run history, instead of a column things sit in.

**The `qa_loop` field → two real Hermes mechanisms, chosen per card:**

- **Intra-task goal loop** (`--goal` / `goal_mode=True`): one worker keeps going *in the same session*; an auxiliary judge checks its output against the card **body (= acceptance criteria)** each turn until the judge agrees or `--goal-max-turns` runs out (then the card **blocks** for human review). Use for "keep going until X is true" single-worker cards. The judge runs on an `auxiliary` model path → **set that model to a different one than the worker** and you get the uncorrelated-judge property from Part IV, at the weights level, for free.
- **Inter-task review** (a separate reviewer card gated on the work; or the `kanban swarm` verifier): the durable, cross-agent form. Use when review must survive restarts, involve a human, or run on a different profile/model.

Your builder↔reviewer loop is the *inter-task* form. "Max iterations then escalate" splits into two counters that are **not** interchangeable: `--goal-max-turns` bounds the intra-task judge loop; `--max-retries` / `failure_limit` bounds spawn retries on the inter-task form. Don't conflate them.

## V.3 — `hermes kanban swarm` is your WorkGraph + QA, in one command

The Kanban Swarm topology — a root/blackboard card, N parallel workers, a **verifier gated on all workers**, and a **synthesizer gated on the verifier**, with shared context as JSON comments on the root — is structurally the WorkGraph fan-out + uncorrelated review + synthesis you specified in Part III. For Antillean M1:

```bash
hermes kanban swarm "Antillean M1: fluid pheromone PoC" \
  --workers builder-gpu,builder-cloud \
  --verifier reviewer-alt \
  --synthesizer integrator
```

That single command builds the graph; the dispatcher then runs the workers in parallel, wakes the verifier once they all finish, and wakes the synthesizer once the verifier marks the work clean. For finer control than the one-shot helper gives you — per-task dependencies, pinned skills, a worktree workspace, goal-mode on the integration card — author the cards explicitly with `kanban_create` + `kanban_link`, or just drop a one-liner into the `triage` column and let `auto_decompose` fan it out against your profile roster.

## V.4 — The dispatch layer (Part IV) is YOUR tool, not Hermes

This is the load-bearing correction. **Hermes does not adaptively route a task to the cheapest/fastest backend.** It spawns the task's assigned **profile** with **that profile's statically-configured model**. There is no IAUS scorer, no rolling-stats router, no hysteresis inside Hermes. Part IV describes the orchestration layer **you are building**, sitting beside Hermes. Two ways to wire it:

**(a) Backend = profile.** Define one profile per (model, terminal) combination — `builder-cloud` (`kimi-k2.5:cloud`, local terminal), `tester-gpu` (small model, remote-Docker-GPU terminal), `reviewer-alt` (a *different* model) — and "route to backend X" becomes "assign the card to profile X." Your adaptive `scoreBackend` chooses the assignee; Hermes executes it. The rolling-stats / IAUS logic is entirely your code; Hermes is the executor. This is the low-friction path: it needs no Hermes internals, just profiles plus an orchestrator (or a thin pre-assignment shim) that picks the assignee.

**(b) Custom dispatcher.** Replace or wrap the gateway-embedded dispatcher with one that scores before spawning. More work; only worth it if profile-routing can't express what you need.

Either way: **the readiness diffusion, kanban, retries, workspaces, and swarm are Hermes; the adaptive routing is you.** Part IV's `scoreBackend` / `AgentDispatcher` is the contract for your layer — just don't expect Hermes to provide it.

One hard limit to design around: **Hermes' only concurrency cap is `kanban.max_in_progress`, and it is *global per board*, not per-backend.** You cannot natively say "≤3 on the GPU, ≤8 on cloud." Per-backend ceilings are your dispatcher's job (option b), or you run one board per backend and accept that cross-board task links aren't allowed. For a slow or VRAM-limited GPU, set `max_in_progress` low so the dispatcher doesn't spawn faster than the box can drain — it is genuinely possible to saturate your own LLM endpoint this way.

## V.5 — The remote GPU host is a *terminal backend*, not a worker host

The other correction Part IV needs. **Kanban is single-host by design:** the dispatcher spawns workers as local OS processes, and crash detection assumes host-local PIDs. Running one shared board across two machines is explicitly unsupported. So you **cannot** run a Hermes worker *process* on the remote GPU box against your main board.

But Hermes cleanly separates two things Part IV merged into one "backend":

- **Model backend** — *which LLM* the agent uses. Set per-profile, or via `auxiliary.*`. (`kimi-k2.5:cloud`, or a local Ollama model.)
- **Terminal / execution backend** — *where the agent's tools run*. Local by default, or **remote Docker / Modal / Singularity / SSH**.

Your "Docker container on the remote GPU host" is a **terminal backend**. The worker's model process runs locally (talking to Ollama cloud or a local Ollama), while its *code execution* targets the remote GPU container. This is exactly right for Antillean: the model **writing** a WGSL shader can be cloud, but the Tester card that **runs** the Navier-Stokes stability probe needs the GPU — so that card's profile points its terminal at the remote Docker-GPU backend (and you mount the board's `attachments/` dir into the sandbox so the absolute paths in the worker context resolve). The GPU is for *executing and verifying* the sim, not for inference. That is precisely the `m1.wgsl-advection` (writes, `gpu: false`) vs `m1.advect-stability` (runs, `gpu: true`) split introduced back in Part IV.

If you genuinely want worker *processes* on the remote host rather than remote terminals, the supported shape is a separate board per host bridged with `delegate_task` or a message queue — heavier, and unnecessary for the GPU-testing case.

## V.6 — `kimi-k2.5:cloud` as the main agent

The choice fits the job. Kimi K2.5 is a 256K-context, natively multimodal MoE model (1T params / 32B active) explicitly built for **agent-swarm orchestration** — Moonshot's "Agent Swarm" runs up to ~100 sub-agents in parallel with large per-job tool-call budgets, which is exactly what an orchestrator drives. It's served through **Ollama's cloud** (the `:cloud` tag — Ollama hosts the compute, not Moonshot directly), and Hermes wires it in with `ollama launch hermes --model kimi-k2.5:cloud`.

Two practical notes:

- **It's multimodal**, so you can attach the actual Figure 1.16 image to a card and the model reads the *diagram*, not just the YAML transcription from Part I. Useful for the decompose step and for any UI/visual card.
- **`auxiliary.kanban_decomposer` is a separate model slot.** The decomposer and the goal-mode judge don't have to run on `kimi-k2.5:cloud` — point them at a cheaper/faster model to cut the cost of decomposition and per-turn judging, which run often. (And if you ever want to revisit the main model, K2.6 is newer and leans even harder into long-horizon background orchestration; K2.5 is a perfectly good choice today.)

## V.7 — A concrete Hermes topology for Antillean M1

Putting it together — profiles, board config, and the invocation:

```yaml
# profiles (each = a "backend" in Part IV's sense)
profiles:
  orchestrator:   { skills: [kanban-orchestrator], toolsets: [kanban, gateway, memory], model: kimi-k2.5:cloud }
  builder-cloud:  { skills: [kanban-worker, frontend-design], model: kimi-k2.5:cloud, terminal: local }
  builder-gpu:    { skills: [kanban-worker], model: kimi-k2.5:cloud, terminal: docker-gpu-remote }
  tester-gpu:     { skills: [kanban-worker], model: <small-fast>,    terminal: docker-gpu-remote }  # runs the WGSL probes
  reviewer-alt:   { skills: [kanban-worker], model: <different-family> }                              # uncorrelated judge
  integrator:     { skills: [kanban-worker], model: kimi-k2.5:cloud }

# ~/.hermes/config.yaml
kanban:
  dispatch_in_gateway: true
  max_in_progress: 3            # bound to the GPU box's drain rate (V.4)
  auto_decompose: true
auxiliary:
  kanban_decomposer: { model: <small-fast> }   # decompose cheaply, not on the 1T model
```

Then either let the decomposer fan out a one-liner:

```bash
hermes kanban create "Antillean M1: fluid pheromone PoC — WebGPU device, \
  scent texture, advection+diffusion WGSL, decay, render, click-spray, integrate" \
  --triage --assignee orchestrator
```

…or build the swarm explicitly and put the integration card in a goal loop so its auxiliary judge holds it open until the M1 smoke suite is green:

```bash
hermes kanban swarm "Antillean M1: fluid pheromone PoC" \
  --workers builder-gpu,builder-cloud,tester-gpu \
  --verifier reviewer-alt --synthesizer integrator

hermes kanban create "M1 integration: wire advect→diffuse→decay→sources→render" \
  --assignee integrator --goal --goal-max-turns 15 \
  --body "Acceptance: click-spray yields a diffusing/decaying/advecting blob; M1 smoke suite green; no NaN over 1000 ticks."
```

The build cards (`builder-*`) write code on a capable model; the `tester-gpu` card runs the stability probe on the GPU terminal; `reviewer-alt` is the uncorrelated check; `integrator` synthesizes. The dispatcher schedules all of it off the dependency links you (or the decomposer) created — which is the WorkGraph from Part III, running on primitives Hermes already ships.

---

# Part VI — Bootstrapping: The Coordination Game

*Parts I–V describe the machine as if it works. It won't, at first. An orchestrator that builds software by prompting other AIs is a distributed system whose source code is natural language, and you do not one-shot those. The real work — and the thing this part argues should be treated as the actual **core gameplay loop** — is iteratively hardening the coordination substrate through small throwaway experiments. The games are the levels; the workflow artifacts are your build.*

## VI.1 — What you're actually debugging

It is tempting to read Parts III–V and expect to point the swarm at the full milestone set and get a game out. That is the one-shot fantasy, and it fails for a specific reason: **the orchestrator's "instructions" to its workers are prompts, and prompt errors compound along the chain.** An ambiguous goal at the top becomes a mis-scoped decomposition, becomes a task built to the wrong spec, becomes a reviewer that passes it because *its* acceptance criteria were ambiguous in the same way. Errors don't merely occur — they correlate and propagate, because every link is interpreting fuzzy language rather than executing exact code.

So separate two failure classes from day one:

- **Domain bugs** — the WGSL advection is numerically unstable; the pathfinding is wrong. Expected, local, fixable, and *not* what threatens the system.
- **Coordination bugs** — the decomposer produced a graph with a missing dependency; a worker exited without calling `kanban_complete` (protocol violation); the QA loop thrashed three iterations and blocked; a handoff dropped the context the next agent needed; a shader task got routed to the writer profile. These make the *system* untrustworthy, and they're invisible until you run it.

You cannot unit-test a prompt the way you unit-test a function. You observe behavior across runs and refine. That observe-and-refine cycle is the work — not a preliminary to it.

## VI.2 — The real source code is the workflow artifacts

The dispatcher code (Part IV) is small and, once written, mostly static. The thing you actually iterate on — the real "source" of the coordination system — is a pile of **natural-language and config artifacts**:

- **Agent-instruction files** — what each role is told it is and does (AGENTS.md and the like; in Hermes, **profile descriptions + skills**). The decomposer routes tasks *by profile description*, so a vague description is a routing bug waiting to fire.
- **Acceptance-criteria text** — the goal-mode card body. Hermes is explicit that *the judge is only as good as your goal text*: "make it work" yields a judge that either rubber-stamps or loops forever, while "every page translated, no English left, links intact" gives it something concrete to check.
- **Decomposition prompts** — how a milestone becomes a task graph. This sets granularity, dependency edges, and routing; it's the highest-leverage artifact because every downstream task inherits its mistakes.
- **Handoff conventions** — what goes in `kanban_complete`'s `metadata` so the next worker receives inputs, not guesses. Under-specified handoff → re-derivation and drift across the chain.
- **Skills** — reusable instruction bundles. The endpoint of honing a prompt is *promoting it into a skill* so every relevant worker inherits the improvement automatically.

The reframe that matters: **the games are throwaway; the honed coordination substrate is the artifact you keep.** You are not accumulating games. You are accumulating a set of prompts, descriptions, criteria, and skills that reliably turn an architecture spec into working software — and that asset transfers to the next project unchanged. The code the agents emit is the *output*; the coordination artifacts are the *product*.

## VI.3 — The core gameplay loop (of the game-making game)

There's a recursion worth making explicit and central: the agents are collectively **playing a game whose objective is to make a game**. Treat the coordination layer that way — as a game you and the agents are learning to play together — and its core loop is not "build the feature." It's this:

1. **Pick a tiny target** — a trivial game or a single subsystem (VI.4).
2. **Run the WorkGraph** on it with the *current* coordination artifacts.
3. **Read the failure surface** — not "did the game work" but *where coordination broke* (VI.5).
4. **Diff the failure to an artifact** — which prompt / criterion / description / skill produced it.
5. **Patch that artifact, not the one-off output.** Fixing the output ships one game; fixing the artifact fixes the *class* for every future run.
6. **Re-run and confirm the failure class is gone** — and keep the tiny target as a regression case.

The "score" you are climbing is **coordination reliability**, and it's measurable: fraction of runs that finish without human intervention, QA iterations to convergence, decomposition routing accuracy, protocol-violation rate. Each tiny game is a level; each artifact is part of your build; each coordination bug is gameplay feedback telling you which part of the build to upgrade. Progress in *this* loop — not feature count — is what eventually makes the real target tractable. Internalizing that the meta-loop is the game (and the games are just its levels) is the single most important mindset shift in the whole document.

## VI.4 — Start absurdly small

The first targets should be so simple they have almost no domain complexity — *precisely* so that **any failure you see is a coordination failure.** A WebGPU "hello triangle," tic-tac-toe, a number-guessing CLI, a static landing page. Nobody cares about the game; you're shaking out the machine: does the decomposer produce a sane graph, do dependencies promote in the right order, does fan-out → verifier → synthesizer run clean, does the goal-judge converge, does a worker actually close its card?

Then climb a ladder that adds coordination *patterns*, not domain difficulty:

- **Mechanics first** — a single fan-out → review → synthesize on a trivial game. Does the swarm topology run end to end at all?
- **Patterns next** — pipelines, voting/quorum review, retry-on-failure, human-in-the-loop block/unblock. Do the harder collaboration shapes hold?
- **Then the real target** — point it at the actual architecture spec (the example sim's M1, etc.) *only once the substrate is trustworthy on the toys.*

**A concrete, ordered instance of this ladder ships alongside this document as `bootstrap-subgame-curriculum.yaml`.** It enumerates ~two dozen rungs — from an ASCII face in a console maze up to a small GPU colony — each tagged by the system it exercises (gameplay / UI / simulation / behavior / capability / performance), each with a machine-checkable `done_when`, and each declaring its `depends_on` so the dispatcher can schedule the climb (it's an acyclic graph, not a strict line). **Read that file before starting a bootstrapping run.** Treat it like any other seed (Part IV): validate, reorder, split, or extend it — it's a worked example to refine, not a fixed plan, and the closing note in it says exactly that. If the file isn't present in your context, regenerate one in its spirit as the *first* research output — producing this decomposition is precisely the job the Part IV directive describes.

This is the same way a single agent gets bootstrapped: build small tools, use them to harden larger workflows (planning stages, file-structuring conventions, the unglamorous details that matter for coordinating bigger processes), and let the tooling mature faster than any one deliverable. The multi-agent version is identical — the small games *are* the "small tools" that harden the coordination workflow. Tool-building bootstraps workflow-building at every scale.

## VI.5 — Telemetry: seeing where coordination broke

You can only run the VI.3 loop if you can *observe* the failure surface, and Hermes' durable kanban is exactly the instrument. The signals to read:

- **`kanban runs <id>`** — per-attempt history. "Reviewer attempt 1 blocked on ambiguity; attempt 2 passed" points straight at the criteria text as the bug.
- **`task_events`** (`hermes kanban watch` / `tail`) — the live transition stream. The telling kinds are the failure ones: `protocol_violation` (worker answered without `kanban_complete` — a worker-instruction bug), `gave_up` (circuit breaker — usually the task spec or criteria), `respawn_guarded` (429/auth or a repeat-storm), `stale` / `timed_out` (missing heartbeats or an under-scoped budget).
- **The comment thread + completion `metadata`** — whether handoffs actually carried what the next agent needed, or whether downstream workers silently re-derived from scratch.

Because the board is durable (state survives restarts), every run is a postmortem you can read after the fact. Mine these for *patterns across runs*, not one-offs: a recurring `protocol_violation` on one profile means that profile's worker instructions are wrong; recurring QA thrash on one task class means that class's acceptance text is too vague; systematic mis-routing means the profile descriptions the decomposer reads are off. Fix the artifact, re-run the regression target, confirm the signal disappears. That is the closest thing there is to unit-testing natural-language coordination — and accumulating those regression targets is how the substrate earns the trust that finally lets you stop running toys and point it at the thing you actually wanted to build.

---

*Colophon. This document threads six movements: Gregory's engine architecture (Fig. 1.16) → a build guide fusing it with a 2007 production feasibility report → the WorkGraph delegation pattern → the dispatch layer and its self-research directive → a grounding of all of it in Hermes Agent with `kimi-k2.5:cloud` → the bootstrapping loop that hardens the coordination substrate through small experiments. The dispatch layer (Parts III–IV) is built from three public techniques — collaborative-diffusion scheduling, utility-based scoring (IAUS), and adaptive dispatch with rolling stats + hysteresis — borrowed from game-AI and applied to construction. Part V is verified against Hermes' published kanban reference: the readiness diffusion, kanban, retries, workspaces, and `kanban swarm` are native; the adaptive dispatcher is the thin layer built on top. Part VI is the load-bearing caveat: none of it one-shots — the real artifact you accumulate is the coordination substrate (prompts, agent-instruction files, acceptance criteria, skills), and honing it through throwaway mini-games is the core loop. That ladder of mini-games is enumerated as a refinable seed in the companion file `bootstrap-subgame-curriculum.yaml`. The example payload throughout is a WebGPU cellular-automaton ant-colony sim, but the infrastructure is agnostic to what architecture spec it's fed.*
