# Antillean: Modern Reboot Architecture
*A living world ant colony simulation — technical design document*

---

## 1. Vision

Antillean is a multi-scale ant colony simulation and game. The player begins as a newly mated queen ant and progresses through individual ant control, squad tactics, hive building, RTS foraging, and eventually SimCity-scale supercolony management. The key design principle is that **every scale is the same simulation viewed from a different zoom level** — there is no faking or abstraction at higher levels. The world runs at full fidelity continuously.

Inspirations: SimAnt done right, Spore's scale progression, Dungeon Keeper hive building, Starcraft RTS tactics, Supreme Commander strategic scale, Dwarf Fortress emergent complexity.

---

## 2. Core Architecture Philosophy

### Model the Chemistry, Not the Behavior

Ant behavior is not scripted. Instead, the underlying physics of chemical signaling is simulated and behavior emerges from it. Pheromones are modeled as fluids obeying real diffusion equations. Ants respond to local chemical gradients using simple steering rules. Complex colony behavior — trail formation, alarm cascades, territorial marking, foraging optimization — emerges naturally from the physics.

### Everything is a Grid

The world is a 2D pixel grid. Every cell stores state as packed pixel data in typed arrays (Uint8Array / Float32Array). This gives:
- Zero garbage collection pressure (no per-entity objects)
- Perfect cache locality (neighboring cells are adjacent in memory)
- Rendering is free — simulation state IS the image
- GPU-native format — textures are just typed arrays

### Collaborative Diffusion for Pathfinding

Ants do not run A* pathfinding. Instead, influence/pheromone fields diffuse outward from goals (nest, food, threats). Ants follow local gradients — they climb the steepest nearby slope. This is Collaborative Diffusion (Repenning 2006):
- Pathfinding cost is O(1) per ant regardless of colony size
- 10,000 agents navigate for the cost of one diffusion pass
- Path quality emerges from the physics, not computation

### Fluid Simulation for Pheromones

Pheromone diffusion uses GPU-accelerated Navier-Stokes fluid simulation (Stam stable fluids method, GPU Gems Chapter 38). This gives physically accurate:
- Concentration gradients (Fick's Law)
- Pressure-driven spreading from dense deposits
- Advection — scent carried by air currents through tunnels
- Multiple simultaneous scent layers as passive scalars

### Shardable World

The grid is divided into rectangular regions. Each region can run on a separate Web Worker or remote machine. Border cells are synced between shards each tick. Because state is flat binary pixel data, border sync is just copying a row/column of bytes over a socket — trivially cheap. World size is theoretically unlimited.

---

## 3. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Language | TypeScript | Type safety, native ES modules, sane tooling |
| Build | Vite | Fast, native ESM, minimal config |
| GPU Compute | WebGPU (WGSL shaders) | Fluid sim, CA updates, parallel diffusion |
| Worker Comm | SharedArrayBuffer + Atomics | Zero-copy shared state between workers |
| AOP / Instrumentation | cujojs/meld | Before/after/around advice for profiling shims |
| Reactive Streams | cujojs/most | Event-driven worker messaging |
| Rendering | Canvas 2D / WebGPU | Pixel state IS the render target |

---

## 4. World Representation

### Grid Layers (stored as texture channels)

Each cell in the grid contains multiple packed values across several texture layers:

**Terrain Layer (static)**
- `R`: Cell type — Dirt (0), Empty/Air (1), Water (2)
- `G`: Material — Plant, Pulp, Fungus, Refuse, Dead Ant, Loose Dirt
- `B`: Elevation / tunnel depth
- `A`: Flags (passable, claimable, etc.)

**Creature Layer (dynamic)**
- `R`: Creature type — 0=none, 1=Young Ant, 2=Ant, 3=Old Ant, 4=Queen, 5=Enemy
- `G`: Carrying pixel (what the ant holds — food=green, egg=white, refuse=purple)
- `B`: Direction / heading (0-255 mapped to 0-360°)
- `A`: Age / health packed value

**Scent Layers (fluid sim textures — one per scent type)**

Each scent is a separate Float32 texture advected through the velocity field:

| Scent | Volatility | Pungency | Behavior |
|---|---|---|---|
| Food Trail | Low | High | Long-lasting, low spread — marks established routes |
| Alert | High | Low | Fast spread, fades quickly — long range alarm |
| Search/Panic | Medium | Low | Medium spread — find the threat source |
| Target | Low | Low | Short range — hone in on specific location |
| Rage | Very Low | Very Low | Contact range — triggers biting |
| Disappointment | Medium | Medium | Counteracts exhausted foraging trails (negative) |
| Territory | Very Low | Very High | Long lasting, low level — marks safe/claimed areas |
| Death/Oleic | Low | High | Triggers removal behavior |
| Wander | Low | Low | Background noise — encourages exploration |

**Fluid Velocity Field**
- Shared velocity field (vec2 per cell) that all scent layers advect through
- Tunnel geometry creates natural pressure differentials and airflow
- Ant movement disturbs the velocity field locally

**Colonial Feelings Layer**
- Aggregate agitation level across the colony
- Hunger pressure
- Contact rate (how many ants are touching each other)
- Feeds into individual ant behavioral decisions

---

## 5. Ant Agent Model

### Each Ant is Two Pixels

- **Grey pixel**: The ant itself (cell state encodes type, age, direction, health)
- **Adjacent pixel**: What it is carrying (food=green, egg=white, dirt=light brown, etc.)

### Steering Behavior (Discretized Craig Reynolds)

Ants use continuous steering behaviors mapped onto the grid:

- **Seek**: Follow increasing gradient of target scent
- **Flee**: Follow decreasing gradient of threat scent
- **Wander**: Biased random walk when no strong gradient present
- **Flow Field Following**: The pheromone field IS the flow field — ants surf it
- **Separation**: Don't overlap other ants (local cell exclusion)
- **Wall Following**: Navigate tunnel edges

Movement is 1 cell per tick. Direction is biased by gradient sampling of neighboring cells weighted by scent layer values.

### Feelings System

Each ant has internal state that drives behavior:

- **Personal feelings**: Hunger, thirst, age, sickness, agitation
- **Colonial feelings**: Aggregate of nearby ants' personal states, diffused by contact

Feelings diffuse on contact — an agitated ant touching a calm ant raises its agitation slightly. This creates wave-like alarm propagation identical to real ant alarm chemistry.

**Behavioral decision matrix:**

| Hunger | Agitation | Contact Rate | Behavior |
|---|---|---|---|
| High | Low | High | Forage |
| High | High | High | Hunt/Attack |
| Low | High | High | Defend |
| Low | Low | Low | Wander/Explore |
| Any | Any | Low | Explore (isolation) |

### Response Thresholds

Individual ants have slightly varied thresholds for hunger, agitation, etc. This prevents lockstep behavior and creates natural wave responses. Some ants are naturally more inclined to agitate, others to forage first. This variance is packed into the creature layer's alpha channel.

---

## 6. Pheromone Fluid Simulation

### Implementation: Navier-Stokes Stable Fluids on WebGPU

Based on GPU Gems Chapter 38 (Harris 2004) and Stam 1999 stable fluids method.

Each simulation tick per scent layer:

```
1. Advect(scent, velocity_field)     // carry scent along airflow
2. Diffuse(scent, viscosity)          // spread to neighbors (Jacobi iteration)
3. ApplyDecay(scent, pungency)        // reduce concentration over time
4. ApplySources(scent, ant_positions) // ants spray scent at their location
5. Project(velocity_field)            // enforce incompressibility
```

**WGSL Compute Shader structure:**

```wgsl
// One compute pass per operation per scent layer
// Grid cells = workgroup threads
// Scent layers stored as r32float textures
// Velocity field stored as rg32float texture

@compute @workgroup_size(16, 16)
fn advect(@builtin(global_invocation_id) id: vec3<u32>) {
  let coords = vec2<f32>(id.xy);
  let vel = textureLoad(velocity_field, id.xy, 0).xy;
  let prev_pos = coords - timestep * vel;
  // bilinear sample at previous position
  let advected = sampleBilinear(scent_in, prev_pos);
  textureStore(scent_out, id.xy, vec4<f32>(advected, 0.0, 0.0, 0.0));
}
```

**Scent properties mapped to fluid parameters:**

- `Volatility` → diffusion coefficient (viscosity parameter)
- `Pungency` → decay rate (applied after diffusion)
- `Strength` → source injection amount when ant sprays

### Tunnel Geometry as Boundary Conditions

Dirt cells = solid boundaries in the fluid sim. This gives:
- Tunnels act as waveguides — scent travels further along narrow passages
- Chamber openings create pressure differentials
- Hive architecture organically shapes colony communication
- Ants digging tunnels are literally engineering their own nervous system

---

## 7. Behavioral Layer: Infinite Axis Utility System (IAUS)

Based on Dave Mark's IAUS (used in EverQuest Next / Storybricks).

For entities with more complex behavior (Queen, enemy colony leaders, large fauna):

### Actions

Each entity has a pool of possible actions:
`Idle, Wander, Forage, Hunt, Flee, Breed, Dig, Guard, Migrate, FormCamp, Raid, Eat, Drink`

### Axes / Considerations

Each action is scored by multiple axes. Each axis = one normalized input [0,1] through a response curve.

**Inputs (sampled from world state / influence maps):**
- health, hunger, thirst, age, sickness
- nearestFoodDistance, nearestWaterDistance
- colonyAgitation, colonyHunger
- threatLevel (from threat scent layer)
- territoryQuality (from territory scent layer)
- contactRate (ants nearby)
- queenDistance

**Response curves:**
- Linear: `score = input`
- Exponential: `score = input^k` (urgency ramps slowly then spikes)
- Sigmoid: `score = 1 / (1 + e^(-m*(input-c))) + b` (threshold behavior)
- Gaussian: `score = e^(-(input-c)^2 / (2m^2)) * k + b` (optimal range)

### Scoring

```typescript
function scoreAction(agent: Agent, action: Action): number {
  let product = 1.0;
  for (const axis of action.axes) {
    const raw = agent.getInput(axis.inputName);
    const normalized = normalize(raw, axis.min, axis.max);
    const score = computeCurve(normalized, axis.curve);
    if (score <= 0) return 0; // zero rule veto = hard precondition
    product *= score;
  }
  const gm = Math.pow(product, 1 / action.axes.length); // geometric mean
  return gm * action.weight;
}
```

### Connection to CA

For simple ants, IAUS is implicit — the pheromone gradients ARE the influence maps, gradient climbing IS the utility scoring. IAUS is made explicit only for complex entities that need authored behavioral tuning.

---

## 8. Pathfinding: Collaborative Diffusion + Temporal Reservation

### Primary: Collaborative Diffusion

Antiobjects (grid cells) carry the pathfinding computation. Goals (nest, food) emit influence that diffuses outward each tick. Ants climb the gradient — no per-ant search required.

**Key property**: Path calculation time is constant regardless of number of agents.

Multiple diffusion layers run simultaneously:
- Nest-home scent (guides ants back)
- Food source scent (guides foragers out)
- Threat avoidance field (guides away from danger)

Ants weight these layers according to their current behavioral state.

### Secondary: Temporal Tile Reservation ("Dibs" System)

For congestion management in narrow tunnels:

Each tile has a move-time reservation array. When an ant claims a tile for time T, other ants treat it as impassable at T. This enables:

**Blockage resolution priority:**
1. **Go around** — calculate alternate route, get time estimate
2. **Wait** — if waiting is faster overall (compare route time vs wait time)
3. **Ask blocker to move** — higher priority ant can displace lower priority
4. **Give up** — worst case, abandon task

Higher priority ants (carrying food, emergency response) get faster routes. Lower priority ants yield or queue. This prevents gridlock in tunnel bottlenecks naturally.

---

## 9. Scent Vision Modes (Player UI)

The player can toggle visualization layers — think Metroid Prime scan visor or AvP predator vision:

| Mode | What's Shown | Color |
|---|---|---|
| Normal | Terrain, ants, materials | Natural colors |
| Pheromone | All scent layer intensities | White gradient (as built) |
| Food Trail | Food scent only | Green |
| Threat | Alert + target scents | Red |
| Territory | Territory markers | Blue |
| Colonial Feel | Agitation heatmap | Orange |
| Velocity | Air current flow field | Arrows / streamlines |

**Kiss mechanic**: Player touches an ant to get a compressed readout of its current state and role:
- Kiss a forager → sense direction and distance to nearest food
- Kiss a tunneler → sense hive expansion priority
- Kiss a warrior → sense threat direction and intensity
- Kiss queen → get colony health overview

Information spreads through the colony via contact, mirroring real trophallaxis.

**Shimmy alerts**: Agitated ants visually shimmy (blue) or flash pheromone release (red). The wave direction indicates threat origin. Infectious between nearby ants — player can read colony alarm state from visual propagation pattern.

---

## 10. World Scale Progression

Based on Katamari Damacy scale mechanic — zoom level correlates to available tools:

| Scale | Control Mode | Ant Count | World Size |
|---|---|---|---|
| Individual | FPS ant control | 1 | Tunnel system |
| Squad | 3rd person / point-click | ~10 | Chamber + nearby tunnels |
| Platoon | Squad tactics (Company of Heroes) | ~100 | Local hive area |
| Colony | Dungeon Keeper hive building | ~1000 | Full hive + surface |
| Regional | Starcraft RTS | ~10,000 | Suburb scale |
| Supercolony | Supreme Commander | ~100,000+ | Full region |

Scale transitions are smooth zoom — no loading screens. The same CA is always running.

---

## 11. Adaptive Performance System

Revival of the original 2014 auto-profiling architecture, rebuilt for modern primitives.

### Self-Instrumenting AOP Profiling

Using `cujojs/meld` for JavaScript AOP:

```typescript
import meld from 'meld';

function instrumentFunction(target: object, method: string, tracker: PerformanceTracker) {
  const advice = meld.around(target, method, function(joinpoint) {
    const start = performance.now();
    const result = joinpoint.proceed();
    const elapsed = performance.now() - start;
    tracker.record(method, elapsed);
    
    // Unwrap after enough samples
    if (tracker.sampleCount(method) > tracker.threshold) {
      advice.remove();
    }
    return result;
  });
}
```

**Trigger**: Framerate drops below threshold → begin profiling hot paths
**Unwrap**: After N samples (N determined by variance — more samples when volatile)
**Zero overhead in steady state** — shims remove themselves

### Adaptive Dispatch

Route compute tasks to optimal backend:

```typescript
type Backend = 'local-cpu' | 'local-gpu' | 'remote-worker';

class AdaptiveDispatcher {
  private scores: Map<Backend, RollingStats> = new Map();
  
  async dispatch(task: ComputeTask): Promise<Result> {
    const backend = this.selectBackend(task);
    const start = performance.now();
    const result = await backend.execute(task);
    const elapsed = performance.now() - start;
    
    // Randomized testing to avoid thrashing
    if (Math.random() < this.sampleRate(backend)) {
      this.scores.get(backend).record(elapsed);
      this.maybeSwitch();
    }
    return result;
  }
  
  private sampleRate(backend: Backend): number {
    // Higher variance → sample more aggressively
    const variance = this.scores.get(backend)?.variance ?? 1;
    return Math.min(0.1 + variance * 0.5, 1.0);
  }
}
```

**Thrashing prevention**: Randomized test intervals (not periodic) + hysteresis (must beat current by meaningful margin to switch).

### Backends Available

| Backend | Best For | Latency |
|---|---|---|
| WebGPU compute | Fluid sim, CA update, diffusion | ~1ms |
| Web Worker (local) | CA logic, pathfinding | ~5ms |
| Remote Worker (WebSocket) | Heavy compute offload | ~20ms+ |

### Framerate-Triggered Profiling

```typescript
class FramerateMonitor {
  private frameHistory: number[] = [];
  
  onFrame(timestamp: number) {
    this.frameHistory.push(timestamp);
    if (this.frameHistory.length > 60) this.frameHistory.shift();
    
    const fps = this.calculateFPS();
    const variance = this.calculateVariance();
    
    // Only profile when we have headroom
    if (fps > TARGET_FPS * 0.9) {
      profiler.setSampleBudget(variance > HIGH_VARIANCE ? 'aggressive' : 'minimal');
    } else {
      profiler.setSampleBudget('none'); // don't make it worse
    }
  }
}
```

---

## 12. Implementation Milestones

Following the original 2014 "get something working, then move on" philosophy:

### Milestone 1: Proof of Concept — Fluid Pheromone
- [ ] WebGPU device setup and basic compute pipeline
- [ ] Single scent layer (food trail) as Float32 texture
- [ ] Navier-Stokes advection + diffusion pass in WGSL
- [ ] Decay applied per tick
- [ ] Render scent layer to canvas
- [ ] Basic source injection (click to spray)

### Milestone 2: Ants Exist
- [ ] Creature layer in grid
- [ ] Single ant pixel with direction state
- [ ] Gradient climbing — ant follows scent uphill
- [ ] Wander behavior when no gradient
- [ ] Ant sprays food scent when carrying food
- [ ] Ant sprays home scent when returning

### Milestone 3: Colony Emerges
- [ ] Multiple ants
- [ ] Nest as scent source (home gradient)
- [ ] Food sources as scent sources (food gradient)
- [ ] Trail formation emerges from gradient climbing
- [ ] Visible pheromone trails matching first screenshot

### Milestone 4: The Hive
- [ ] Dirt/tunnel terrain
- [ ] Digging behavior — ant converts dirt to air
- [ ] Tunnel geometry as fluid sim boundaries
- [ ] Scent propagates differently through tunnels vs open air
- [ ] Queen cell — immobile, produces ants

### Milestone 5: Feelings
- [ ] Personal feelings state per ant (hunger, agitation)
- [ ] Contact diffusion — feelings spread between adjacent ants
- [ ] Colonial agitation layer
- [ ] Behavioral decision matrix implemented
- [ ] Alarm cascade visible as agitation wave

### Milestone 6: Worker Sharding
- [ ] Grid partitioned into regions
- [ ] Each region runs in separate Web Worker
- [ ] Border cell sync between workers each tick
- [ ] SharedArrayBuffer for zero-copy state sharing

### Milestone 7: Scale and Player
- [ ] Camera zoom levels
- [ ] FPS ant control at close zoom
- [ ] RTS-style influence at far zoom
- [ ] Pheromone vision mode toggle
- [ ] Kiss mechanic for ant state readout

---

## 13. Potential Upgrade Path: WASM Core

*Inspired by Danielle Fong's "compiled physics under a diagram" pattern (May 2026) — a real-time 3D Schrödinger equation solver compiled to an 18KB WASM module via Zig, running at 175fps in a Claude artifact on mobile. The pattern: WASM does the math, WebGPU does the parallelism, TypeScript does the thinking.*

### The Pattern

The initial TypeScript + WebGPU implementation is the right starting point. Once the CA rules and fluid sim are stable and well-understood, the hot inner loops can be compiled to WASM for near-native performance with zero GC pressure. The key insight is that **WASM and the pixel-packed typed array state are a natural fit** — WASM operates directly on ArrayBuffers with pointer arithmetic, no marshalling required.

### Why WASM Makes Sense Here

- **Zero GC** — WASM has no garbage collector. Combined with the pixel-packed flat arrays, there is literally nothing to collect. Deterministic performance every tick.
- **Near-native speed** — CA update loops and Navier-Stokes Jacobi iterations are tight inner loops that JITs struggle to fully optimize. WASM gives you predictable, consistent performance.
- **Tiny binary** — a full fluid sim solver compiles to ~18KB. The entire CA engine could be smaller than a typical JS framework import.
- **Runs everywhere** — mobile, desktop, embedded. If it renders on mobile it renders anywhere.
- **Direct typed array access** — WASM memory IS a SharedArrayBuffer. The existing pixel state format requires no changes.

### Zig as the Compiler

Zig is the recommended path based on Danielle Fong's proof-of-concept:

- `zig cc` bundles clang, lld, and sysroot in one package — no version mismatch hell
- `zig cc` can act as the linker for `rustc` — so Rust is also viable without giving up Zig's toolchain stability
- Zig's manual memory model maps naturally onto the pixel-packed grid — direct pointer arithmetic into typed arrays
- No runtime, no stdlib dependency unless you want it — truly freestanding WASM

```zig
// Example: CA update pass in Zig compiled to WASM
export fn updateCA(
    grid_ptr: [*]u8,
    scent_ptr: [*]f32,
    width: u32,
    height: u32,
    tick: u32
) void {
    // Direct pointer arithmetic into SharedArrayBuffer
    // Zero allocations, zero GC, deterministic timing
}
```

### Recommended Migration Strategy

Start TypeScript, migrate to WASM incrementally:

| Phase | What's in WASM | What stays in TypeScript |
|---|---|---|
| 1 (initial) | Nothing | Everything |
| 2 | Navier-Stokes solver (hottest path) | CA logic, rendering, game logic |
| 3 | CA update loop | Rendering, game logic, UI |
| 4 | Full simulation core | Rendering, orchestration, UI |

The TypeScript / WASM boundary is just a typed array pointer — the simulation state format never changes. Migration is purely additive.

### Layer Responsibilities (Full Stack)

```
┌─────────────────────────────────────┐
│  TypeScript                         │
│  Orchestration, UI, adaptive dispatch│
│  cujojs/meld AOP, game logic        │
├─────────────────────────────────────┤
│  WebGPU (WGSL)                      │
│  Rendering, full-grid parallel ops   │
│  Large diffusion passes              │
├─────────────────────────────────────┤
│  WASM (Zig/Rust)                    │
│  CA update loop, Navier-Stokes      │
│  Tight inner loops, deterministic   │
├─────────────────────────────────────┤
│  SharedArrayBuffer                  │
│  Pixel-packed world state           │
│  Zero-copy across all layers        │
└─────────────────────────────────────┘
```

### Reference

- Danielle Fong's Schrödinger solver: real-time 3D quantum wavefunction, 110k voxels, hand-rolled freestanding exp/sqrt (no libc), 18KB WASM, 175fps on mobile via three.js rendering. Proof that compiled physics under a diagram is a viable primitive for any domain where the math matters — fluid dynamics, orbital mechanics, reaction-diffusion, signal processing.
- https://x.com/DanielleFong/status/2055083211743695331

---

## 14. Key References

- **GPU Gems Chapter 38** — Fast Fluid Dynamics Simulation on the GPU (Harris 2004) — Navier-Stokes implementation
- **Stam 1999** — Stable Fluids — unconditionally stable fluid solver
- **Repenning 2006** — Collaborative Diffusion: Programming Antiobjects — pathfinding without pathfinding
- **Craig Reynolds 1999** — Steering Behaviors for Autonomous Characters — ant movement model
- **Dave Mark** — Behavioral Mathematics for Game AI + IAUS GDC talks (2010, 2013, 2015)
- **haxiomic GPU-Fluid-Experiments** — Modern WebGL/WebGPU fluid sim reference implementation
- **mharrys/fluids-2d** — 2D fluid sim reference
- **cujojs/meld** — AOP for JavaScript
- **cujojs/most** — Reactive streams for worker messaging

---

## 15. Data-Driven Design & MMO Architecture

### The Core Principle

Every behavioral difference in Antillean is a parameter, not code. Castes, species, materials, scents, terrain types, biomes — all defined as data tables that the simulation reads at runtime. The CA engine itself never changes. Only the data changes.

This is not just good software design. It is the architectural foundation that makes everything else possible — modding, streaming, procedural worlds, and eventually MMO-scale persistent worlds — without changing a single line of simulation code.

### Caste & Species as Parameter Tables

Each ant caste is a row in a table of coefficients. The simulation code is identical for every ant — only the parameters differ:

| Parameter | Worker | Soldier | Scout | Queen | Leafcutter |
|---|---|---|---|---|---|
| Pheromone sensitivity | High | Medium | Low | Low | High |
| Direction field weight | Low | Low | High | — | Medium |
| Step counter accuracy | Medium | Low | High | — | Medium |
| Sound sensitivity | Medium | High | Low | High | Low |
| Agitation threshold | Medium | Low | High | Very High | High |
| Hunger threshold | Medium | Low | Low | High | Medium |
| Density tolerance | High | High | Medium | Low | High |
| Speed | Medium | High | High | — | Medium |
| Digging ability | High | Low | Low | — | High |

A soldier isn't programmed to be aggressive — it just has a low agitation threshold and high sound sensitivity so it reaches rage state faster than a worker. A scout isn't programmed to explore — it just has a high direction field weight and step counter accuracy so it ranges further confidently.

**New ant species = new parameter table. No code changes.**

The same applies to everything else in the simulation:

- **Scent types** — volatility, pungency, strength, diffusion coefficient, decay rate
- **Materials** — thermal conductivity, sound conductivity, density, dig resistance, color
- **Terrain biomes** — ambient temperature, pressure, gas composition, food distribution
- **IAUS action definitions** — axis lists, response curve parameters, weights
- **Larval development** — temperature range, food requirements, caste output probabilities

### Emergent Caste Ratios from Colonial State

Because larval development responds to colonial feelings (hunger, agitation, contact rate — already tracked by the feelings system), caste ratios self-regulate without explicit programming:

- Colony under sustained attack → high agitation → larval development skews toward soldiers
- Food-rich, calm colony → low agitation, low hunger → more workers and scouts produced
- Population crash → high hunger, low contact rate → queen upregulates egg production

The colony manages itself. The player influences the conditions, not the outcomes directly.

### Streaming Data = Streaming World

Because behavior is data, the world can be streamed:

```
Region loads → fetch parameter tables for that region's species, materials, biomes
Region unloads → serialize grid state, cache parameter tables
New species discovered → stream in new parameter table, no client update required
Seasonal event → broadcast parameter delta to affected regions
```

A player's colony encountering a new ant species for the first time is just the client receiving a new parameter table and rendering it. The simulation handles it identically to any other ant.

### The MMO Architecture

The simulation never knows it's an MMO. It's a CA running on a grid. The MMO is the infrastructure around it:

```
┌─────────────────────────────────────────┐
│  MMO Layer                              │
│  Player accounts, persistence, social   │
├─────────────────────────────────────────┤
│  World Server                           │
│  Grid shard coordination, state sync    │
│  Parameter table registry               │
│  Seasonal / event broadcast             │
├─────────────────────────────────────────┤
│  Shard Servers (N machines)             │
│  Each runs CA on a grid region          │
│  Border cell sync between shards        │
│  Pheromone gradients bleed naturally    │
├─────────────────────────────────────────┤
│  Client                                 │
│  Renders local grid region              │
│  Streams adjacent shard borders         │
│  Caches parameter tables locally        │
└─────────────────────────────────────────┘
```

**Key properties:**

- **Inter-colony interaction is free** — rival colonies in adjacent shards interact through pheromone gradients and sound waves bleeding across shard boundaries. No special multiplayer code. The physics handles it.
- **Persistent world state** — a player's tunnel network is just a serialized region of the grid stored on a server. Log out, log back in, colony continues running (or doesn't, if it starved).
- **Seasonal and world events** — just parameter deltas broadcast to affected regions. Winter = lower surface temperature field values. Drought = reduced food spawn rates. Invasive species = new parameter table pushed to a region.
- **Procedural world generation** — biome parameter tables + terrain generation = infinite unique worlds with consistent physical laws.
- **Modding** — new species, materials, scents, behaviors = new JSON parameter tables. No engine access required.

### Selective Data Streaming

Not all data needs to be loaded at once. Parameter tables are small — a full species definition might be a few hundred bytes. The client streams them on demand:

- Core ant parameters — always loaded
- Regional species — loaded when entering region
- Rare/exotic species — streamed on first encounter
- Event species — pushed by server during world events

Combined with the grid sharding, this means a client only ever holds the simulation state for its visible region plus a thin border of adjacent shards. The rest of the world runs on servers the client never directly touches.

### The Fractal Architecture

The same principle — simple local rules producing emergent complex behavior — applies at every level of the stack:

| Level | Simple Rule | Emergent Complexity |
|---|---|---|
| Cell | CA update from neighbors | Pheromone trails, tunnel shapes |
| Ant | Parameter table + gradient climb | Caste behavior, colony roles |
| Colony | Feelings diffusion + caste ratios | Self-regulating superorganism |
| World | Sharded grids + parameter streaming | Living ecosystem, biome diversity |
| MMO | Persistent shards + player interaction | Emergent geopolitics between colonies |

No level requires special-case logic. Each level's complexity emerges from the level below it, driven by data rather than code.

---

## 16. Speculative / Unresolved Ideas

*A holding area for interesting concepts that aren't fully thought out yet. Not commitments — just things worth preserving for later consideration.*

---

### Subcell / Subpixel Movement (Dwarf Fortress style)

Dwarf Fortress subdivides creature movement internally into subcell coordinates, giving realistic momentum, collision, and body-part-level interaction without exploding the cell count. This produces much more naturalistic movement than strict grid-aligned stepping.

**Potential benefit for Antillean:**
- At FPS ant zoom level, strict 1-cell-per-tick movement looks janky
- Subcell positions would allow smooth navigation around obstacles, realistic carrying physics, more expressive fighting and tunneling
- Could make the individual ant experience feel genuinely alive rather than mechanical

**The tension:**
- CA elegance comes from everything being the grid — ants are cells, pheromones are cells, terrain is cells. Subcell positions introduce a second representation that needs to stay in sync with the CA
- Collaborative diffusion pathfinding assumes grid-aligned agents. Subcell ants need interpolation to follow gradients
- Pheromone spraying becomes ambiguous — which cell does a subcell-positioned ant spray into?

**Possible resolution:**
Scale-dependent representation. At close zoom (FPS ant control), switch the player-controlled ant to a subcell movement model. The CA runs at grid resolution underneath. The player ant is the exception, not the rule — detail applied where it matters, not globally.

**Status:** Unresolved. Worth revisiting when FPS ant control is being implemented.

---

### Heat Modeling + Tile Rendering (Oxygen Not Included style)

ONI is essentially a tiny ant farm with DuplicAnts — the parallel is striking. It runs a full per-cell thermal simulation with gas flow, and renders it as a clean tile-based view over the underlying pixel simulation. This two-layer approach — pixel-level sim, tile-level render — is exactly what Antillean needs to be both accurate and visually compelling.

**What ONI does that's directly relevant:**

- Every object in contact with another object of a different temperature will either transfer some heat to it or accept some of its heat. Amount of heat transferred depends on temperature difference, thermal conductivity of materials, heat capacity of both objects, and thickness of the more insulated object. This is per-cell, per-tick — exactly the CA model.
- Thermal conductivity, specific heat, and element phase changes are all modeled per tile. Different materials (dirt, fungus, water, air) conduct heat differently.
- Gas density determines layering — CO2 sinks, oxygen rises. In tunnels this creates realistic atmospheric stratification.
- Background tiles gradually normalize foreground heat to a local value each tick unless something in the foreground environment is generating or absorbing heat. Simple, cheap, effective.

**Why this matters for Antillean:**

Heat and pressure are real ant colony concerns:
- Ant larvae need specific temperature ranges to develop correctly
- Fungus farms (leaf-cutter ants) have optimal temperature windows
- Ants generate metabolic heat — a dense cluster warms its surroundings
- Deep tunnels are thermally stable; surface tunnels swing with ambient temperature
- Hot/cold zones would emerge naturally from hive architecture and ant density

**Pressure is already in the system.** The Navier-Stokes solver has a pressure projection step built in — it's not an addition, it's a property that falls out of the fluid sim for free. Implications:

- Ants digging a new tunnel changes the pressure gradient of the whole hive — new airflow paths open up, scents redistribute
- A cave-in doesn't just block movement, it seals off a pressure zone — CO2 builds up, oxygen depletes, trapped ants die in a physically accurate way
- Flooding creates pressure waves through the tunnel system
- The player engineering tunnels isn't just about traffic flow — it's atmospheric management. Ventilation shafts, insulated chambers, pressure relief via tunnel width. Emergent from physics, not explicit pipe systems.

**Modeling tunnels and rooms as spheres / cylinders:**

The 2D grid is a cross-section of a 3D world. A tunnel cell in 2D represents a cylindrical passage in 3D. A chamber cell represents a roughly spherical room. This has profound implications for volume-dependent calculations:

- A small tunnel (radius r) has volume ∝ r²
- A large chamber (radius R) has volume ∝ R³
- **Bigger rooms have disproportionately more volume** — gas concentrations dilute faster, pressure changes more slowly, heat capacity is higher
- The surface is effectively infinite volume (open atmosphere above) — pressure always equalizes upward, CO2 disperses freely, heat dissipates
- A sealed chamber with 10 ants has rapidly depleting oxygen; the same ants in a large spherical chamber survive much longer

In practice this means each cell stores not just its 2D state but a **derived volume scalar** based on the local open-space radius. Simple to compute — just measure the radius of connected open space around each cell. Volume then feeds into:
- Gas concentration calculations (moles per volume)
- Heat capacity (more air mass = more thermal inertia)
- Pressure equalization rate
- Pheromone dilution (a large chamber disperses scent faster than a narrow tunnel)

This gives the simulation 3D physical accuracy while remaining a 2D CA — the sphere/cylinder model is just a multiplier on the per-cell physics calculations.

Heat and pressure as CA layers would:
- Affect ant behavior (too hot / low O2 → seek better conditions)
- Influence larval development rate and caste determination
- Make tunnel and chamber design matter beyond pathfinding — atmospheric engineering becomes a core gameplay loop
- Interact with the pheromone fluid sim (warm air rises, carrying scents; pressure differentials drive scent flow through tunnels)

**The tile rendering insight:**

ONI renders a clean sprite-based view over its cell simulation. Antillean could do the same — run the pixel CA at full resolution for simulation accuracy, but render it as tiles with proper art assets. A dirt cell becomes a dirt tile sprite. A tunnel cell becomes a tunnel tile. An ant cell becomes an animated ant sprite positioned at the cell.

This gives:
- Pixel-level simulation fidelity
- Visually appealing presentation without requiring pixel art to look good at all zoom levels
- Natural LOD — zoomed out, draw tiles; zoomed in, draw sprites; FPS mode, render 3D

**The tension:**

Adding heat as a full CA layer means another Float32 texture to update every tick — thermal conductivity per cell, heat capacity per cell, source/sink terms from ants and metabolism. That's significant additional compute. Could be the WASM upgrade path's job rather than the initial TypeScript implementation.

**Status:** Compelling but complex. Recommend noting ONI as a key reference and revisiting when the pheromone fluid sim is proven. Heat modeling likely belongs in a later milestone, tile rendering could be tackled earlier as a pure visual upgrade.

**Key ONI reference mechanics to study:**
- Per-cell thermal conductivity based on material type
- Gas density stratification in open spaces
- Insulated vs radiant tile heat transfer differences
- How ONI handles the tile/simulation boundary for rendering

---

### Volume Scalar System — Grid Approximation of 3D Space

*This has crossed from speculative into concrete architecture and should eventually move into the main design.*

The 2D grid is a cross-section of a 3D world. Rather than full sphere math, each open cell stores a **volume scalar** — a simple approximation of how much 3D space that cell represents, computed by summing connected open cells within a neighborhood radius.

```
volume_scalar(cell) = count of open cells within radius R
                      (clamped to MAX_VOLUME for surface cells)
```

**Properties:**
- Cheap to compute — wider neighborhood sum over neighbor cells already scanned in CA update
- Only recalculates on terrain change (digging, cave-ins), not every tick
- Stored as a single channel value in the pixel-packed cell state
- Surface cells clamp to a large constant representing open atmosphere (infinite pressure sink)

**Volume scalar drives:**
- Gas concentration (moles per volume) — large chambers dilute gas faster
- Heat capacity — more air mass = more thermal inertia, protects larvae from temperature swings
- Pressure equalization rate
- Pheromone dilution — large chambers disperse scent faster than narrow tunnels

**Dual physics regime from one scalar:**

| Location | Volume Scalar | Ant Behavior |
|---|---|---|
| Large chamber | High | Multiple ants per cell, fluid/swarm behavior, density-based traffic |
| Narrow tunnel | Medium | Moderate density, emergent traffic flow, natural bottlenecks |
| Surface | Low (clamped) | Collision-based, individual agent movement, ants spread out |

This gives two different physics regimes — underground swarm fluid, surface individual agents — with a completely smooth transition as ants move through narrowing tunnels toward the surface. No explicit mode switching required. The volume scalar drops naturally, density limits tighten, and behavior shifts organically.

Biologically accurate: ant tunnels are extraordinarily dense with traffic in ways impossible if ants treated each other as solid objects. They flow past each other in 3D space the 2D grid cross-section can't fully represent. The volume scalar corrects for this implicitly.

---

### Sound / Stridulation

Ants are not purely chemical communicators — they also produce sound via stridulation (rubbing body segments together) and substrate tapping. This is used for:

- **Cave-in distress signals** — immobilized ants tap to signal location to rescue workers
- **Leaf-cutter coordination** — stridulation signals food quality on-site before hauling
- **Short-range coordination** — pinpointing specific food items, coordinating tight-space maneuvers

**In CA terms:**
Sound is just another CA layer with different parameters from pheromones:

| Signal | Speed | Decay | Range |
|---|---|---|---|
| Rage pheromone | slow | fast | contact |
| Alert pheromone | medium | medium | local |
| Sound pulse | fast | very fast | tunnel-dependent |
| Territory marker | very slow | very slow | permanent |

- Sound source injects a pulse into neighboring cells
- Pulse propagates outward at N cells per tick (much faster than pheromone diffusion, maybe 5-10 cells/tick)
- Amplitude attenuates with distance and material density
- Direction information is free — the wave front IS the memory. The spatial pattern of decaying amplitude across neighboring cells encodes source direction without explicitly storing it. Same principle as pheromone gradient encoding trail direction.

**Material conductivity:**

Each terrain cell type gets a sound conductivity coefficient — same concept as thermal conductivity in the ONI heat model:

- **Air/tunnel** — normal propagation, attenuates with volume scalar
- **Dirt** — moderate absorption, short range bleed-through
- **Stone** — high conductivity, carries sound far with little loss. A sound in one stone chamber could be heard in a distant chamber sharing no air connection
- **Wood** — resonant, slightly reflective, carries certain frequencies better
- **Water** — very high conductivity, fast propagation. Flooded tunnels become acoustic highways — alarm signals travel far faster through water than air
- **Fungus** — dense, absorptive. Fungus farm chambers are naturally quiet, good for larval development

Emergent consequences:
- Ants detect threats **through walls** via stone conductivity — vibrations from a digging predator traveling through rock before any scent arrives
- Building stone vs dirt walls becomes a strategic choice — stone connects you acoustically to more of the world, for better and worse
- Fungus chambers as naturally quiet/insulated zones
- Floods become acoustic highways, giving unexpected early warning reach

Volume scalar interacts here too — sound in a large chamber disperses quickly (low amplitude), sound in a narrow tunnel carries much further (waveguide effect). Exactly like real acoustics underground.

**Gameplay use:**
- Player hears/sees sound waves propagating through hive
- Distress signals from cave-ins create visible pulse patterns pointing toward trapped ants
- Part of the vision mode system — a "sound" overlay showing active stridulation waves

**Status:** Straightforward to implement as an additional fast CA layer once the pheromone system is stable. Material conductivity coefficients are just a lookup table per cell type.

---

### Alternative Pathfinding — Multi-Modal Navigation

Real ants use multiple navigation strategies simultaneously, not just pheromone gradient climbing. A fully realistic agent-based model would be complex, but simple approximations can fake the right behavior convincingly.

**Real ant navigation mechanisms:**

- **Pheromone trail following** — already implemented as collaborative diffusion gradient climbing
- **Path integration / dead reckoning** — ants count steps and track direction to estimate distance and bearing to home (desert ants are particularly good at this)
- **Magnetoreception** — some ant species detect Earth's magnetic field for absolute directional reference, similar to a compass
- **UV / sky polarization** — surface ants use polarized ultraviolet light from the sky as a sun compass for orientation
- **Visual landmarks** — some species use visual features (relevant on surface at close zoom)
- **Substrate vibration** — sound/stridulation for short-range coordination (see above)

**Magnetoreception and UV polarization don't need direct simulation.** Instead, ants get an implicit sense of absolute direction that feeds into dead reckoning — a cheap global directional bias baked into each ant's state.

**Global direction field:**

A static or slowly-updating vector field across the entire map encoding absolute cardinal directions. Think of it as a simulated magnetic field or polarized light gradient:

- Underground: direction field is weak/noisy (no sky reference, magnetic field attenuated by terrain)
- Near surface / surface: direction field is strong and reliable
- Disrupted by large metal deposits or water bodies (optional complexity)

Each ant has a **heading byte** in its creature layer state. When navigating without strong pheromone signal, the ant blends:
1. Its step-counted dead reckoning estimate of home direction
2. The local direction field value (how confident is the compass reading here?)
3. The global distance map gradient (Floyd-Warshall fallback)

The confidence weighting is key — underground ants rely more on step counting and pheromones, surface ants trust the direction field more. This produces naturalistic behavior differences between species and castes without explicit programming.

**Practical approximations:**

**Floyd-Warshall for global home awareness:**
Precompute all-pairs shortest paths on the tunnel graph. Each cell gets a "distance to nest" value. Ants that have lost pheromone trail fall back to this — they know roughly which direction home is without a specific scent to follow. Expensive to compute but tunnel topology changes slowly — incremental updates on terrain change, precomputed in a background worker tick.

**Step counter per ant:**
Each ant tracks approximate steps taken since leaving nest, combined with direction field reading at departure. Gives crude dead reckoning — produces naturalistic "lost ant" wandering that gradually curves homeward. Encoded in the creature layer, costs nothing extra per cell update.

**Tensor field / global direction bias:**
A slowly-updating vector field pointing toward nearest nest. Acts as weak background pull when all other signals fail. Strong enough to prevent permanent lostness, weak enough that pheromone trails dominate when present.

**The layered priority:**
```
1. Strong pheromone gradient → follow it (collaborative diffusion)
2. Weak/absent pheromone → dead reckoning (step counter + direction field)
3. Completely lost → global distance map (Floyd-Warshall fallback)
4. Emergency → stridulation (sound signal to nearby ants)
```

Each layer is simple. Together they produce robust navigation that degrades gracefully rather than failing completely when one system is unavailable.

**Status:** Floyd-Warshall global awareness and tensor direction field are concrete enough to implement early. Step counter dead reckoning is a per-ant state addition fitting in the creature layer. Full realistic path integration and magnetoreception simulation are later stretch goals.

---

### Pheromone Stigmergy as Neural Gating Function

Ant stigmergy is a chained complex mathematical gating function that feeds back into sensors. As an ant moves across a space infected with pheromones, the pheromones "spike" the sensors in various patterns — roughly replicating the spiking neuron model. The colony IS an external brain, distributed across the grid.

This means the CA pheromone sim isn't just navigation — it's computing. The colony is performing distributed inference across a chemical substrate. This is why tensor-based AI models feel so similar to pheromone simulations — they are the same underlying math.

Reynolds steering + pheromone gradients = **Braitenberg Vehicles by proxy**. Simple vehicles that exhibit complex goal-directed behavior purely from sensor-to-actuator coupling, no explicit goals required.

Practical implication: the IAUS behavioral layer may be less necessary than thought. If the pheromone physics is rich enough, behavior emerges from the chemistry without explicit utility scoring — the colony IS the utility function.

---

### Trophallaxis as Distributed Immune System (Ant Puke Networks)

When an ant is sick, other ants lick them. This distributes immune response across the colony — no individual knows which ant has the antibodies, so they share broadly. The healthy ants have a chance to develop antibodies, boosting colony-wide immunity.

The whole colony quickly gets sick... until the one immune ant spreads the antibody. Herd immunity rippling through the hive, exactly like our own immune system.

**Gameplay implications:**
- Disease spreads through contact (trophallaxis) — already modeled by the feelings diffusion system
- Some ants are naturally resistant — response threshold variation already in the parameter table
- Borax-based ant killer is so effective because it spreads through trophallaxis — a "poisoned food" mechanic
- Hyper-parasite fungi: some ants carry a beneficial fungus that fights the harmful Cordyceps. Ants spread this deliberately as inoculation. Rich quest/mechanic potential.

**The "lazy ant" insight (Temnothorax rugatulus):** ~45% of worker ants appear to do nothing. They aren't lazy — they're participating in trophallaxis and spreading immune function. They're also a reserve labor force for black swan events. Some are literal food storage (honeypot ants). This maps directly to idle ant behavior — ants that appear inactive are actually doing colony-level work through contact. Don't model them as wasted compute.

---

### Collective Decision Making — Bee Democracy Model

Bees decide on nesting sites through vigorous dancing. When multiple viable options exist, bees that know a better site headbutt those dancing for inferior sites. Enough headbutts and the dancer stops and re-evaluates.

This is a collective searching algorithm that biases toward the best option without exploring everything. The stop signal ("whoop of dismay") is a negative feedback mechanism.

**For Antillean:** colony-level decisions (where to expand, which food source to prioritize, when to swarm) could use a similar mechanism — scouts return and "dance" (lay strong pheromone trails), and counter-signals (disappointment pheromone) suppress inferior options. The colony votes through chemistry.

This is already partially in the system — the pheromone reinforcement/disappointment layers ARE the voting mechanism. Just needs explicit recognition in the design.

---

### Immune System T-Cell / Gas Diffusion Analogy

T cells operate like a gas, stochastically hitting other cells until contact triggers them. The inverse is chemotaxis — responding to chemical gradients. This shows up with the same gas/slit mechanics as diffusion.

The key insight: ants aren't purely Brownian motion. They interact with each other and have memory, so their collective flow is less stochastic than individual movement suggests. We only thought they were random because we tested individuals, not colonies. Same mistake made in immunology.

**For the simulation:** the wander behavior shouldn't be pure random walk. It should be Brownian-ish but modulated by:
- Recent contact with other ants (memory of collision affects next direction)
- Local pheromone history (gradient memory, not just current gradient)
- Colony agitation state (high agitation = more chaotic individual movement)

This produces the right emergent collective behavior — organized at the colony level, apparently random at the individual level.

---

### Insulin Signaling, Microbiome, and Caste Development

Insulin signaling in ants drives caste determination. Gut microbes act as epigenetic signaling mediators affecting caste development and behavior. Diet changes and food quality restrictions drive the production of alates (reproductive ants). The scent of colony members (modulated by microbes) drives social grouping during illness.

**For Antillean:**
- Larval diet composition (not just quantity) determines caste — feed larvae different food ratios to influence soldier vs worker ratios
- Colony microbiome as a hidden simulation layer — gut bacteria composition shifts with diet, affecting colony-wide behavior and immunity
- Food scarcity → diet restriction → alate production trigger. The colony "decides" to reproduce when resources are stressed, not when they're plentiful.
- Haplodiploidy: unfertilized eggs → males, fertilized → females. Queen controls this by selective fertilization. Gameplay: player directs queen reproductive strategy.

---

### Noita / Falling Sand as Reference Implementation

Multiple entries reference Noita (items 247, 260, 261) — a game that runs a full per-pixel physical simulation where every pixel has material properties. It's the most direct existing reference for what Antillean is doing.

Key Noita techniques worth studying:
- Cellular automaton update order (checkerboard to avoid artifacts)
- Per-pixel material property lookup tables
- Chunk-based world with active/inactive regions
- GPU acceleration of the CA update pass

Also The Powder Toy [^A254] and Sandspiel [^A183] — open source falling sand simulators with material physics. Good reference implementations for the terrain CA layer.

---

### Material Point Method (MPM) for Granular/Fluid Materials

MPM (Material Point Method)[^A225][^A226] — a hybrid particle/grid simulation used for snow, sand, water, and other complex materials in film VFX (Disney's Frozen used it for snow).

MPM could be relevant for:
- Sand/loose dirt behavior when tunnels collapse
- Water flooding through tunnel systems  
- Granular food particle physics (seeds, grain)
- The "ant colonies flow like fluid to build towers" behavior [^A230]

The nialltl incremental MPM implementation is a Unity reference for real-time MPM. Worth noting as an alternative to pure Navier-Stokes for terrain deformation physics.

---

### SpatialOS / Distributed World Architecture

Improbable's SpatialOS GDC 2017 talk. They built a distributed game world platform — exactly the shard architecture Antillean needs at MMO scale. Worth studying their approach to:[^A8]
- Worker (shard) boundary management
- Entity handoff between workers
- Interest management (what data each worker needs)
- Load balancing across the cluster

Their approach is more heavyweight than needed for Antillean's initial launch, but the boundary sync patterns are directly applicable.

---

### Z-Order Curve for Cache-Friendly Grid Layout

Z-order curve (Morton code) — a space-filling curve that maps 2D grid coordinates to 1D array indices while preserving spatial locality better than row-major layout[^A250].

For Antillean's pixel-packed typed arrays: using Z-order curve indexing instead of row-major means spatially nearby cells are more likely to be adjacent in memory. Better cache performance for the neighborhood lookups that drive every CA update. Potentially significant for large grids.

Worth benchmarking against row-major layout once the CA is running.

---

### Active Inference Framework for Ant Behavior

"Active Inferants: An Active Inference Framework for Ant Colony Behavior" — models ant foraging using active inference (Karl Friston's framework). Active inference unifies perception and action as minimizing free energy / prediction error[^A253].

This connects to the IAUS in an interesting way — rather than scoring actions against utility axes, active inference frames behavior as an ant minimizing surprise about its expected sensory states. An ant "expects" to find food on a pheromone trail. When it does, surprise is low. When the trail leads nowhere, surprise is high — this is the disappointment pheromone, physically embodied.

The math differs but the behavior is identical. Worth reading as a theoretical grounding for why the pheromone CA produces intelligent-seeming behavior.

---

### Herringbone Wang Tiles for Procedural World Generation

Herringbone Wang Tiles and procedural worlds from simple tiles[^A21][^A22]. Wang tiles allow complex procedural world generation from small tile sets with edge-matching constraints. Non-repeating, locally consistent, infinite worlds.

For Antillean's surface terrain generation — Wang tiles could generate the above-ground environment (gardens, human structures, natural areas) in a way that's visually non-repetitive but structurally consistent. The tile edge constraints map naturally to terrain adjacency rules (grass next to dirt, concrete next to grass, etc.).

---

### Novelty Search + Collaborative Diffusion

[^A83] in the archive is just four words: "Novelty Search + Collaborative Diffusion." Worth unpacking.

Novelty search (Lehman & Stanley 2011) is a search algorithm that rewards agents for doing things that haven't been done before, rather than optimizing toward a fixed goal. It often outperforms goal-directed search on deceptive problems where the direct path to the goal is blocked.

Scout ants are doing novelty search. They don't optimize toward known food — they explore novel areas. Combined with collaborative diffusion: scouts lay novelty-weighted pheromones in unexplored areas, drawing subsequent scouts toward unexplored rather than known regions. The colony automatically balances exploitation (following strong food trails) with exploration (following novelty gradients into uncharted territory).

Practical implementation: a separate "exploration" scent layer that decays fast and inverts in already-visited areas. Scouts bias toward low-exploration-scent cells rather than just high-food-scent cells. The colony gets automatic explore/exploit balance without programming it explicitly.

---

### Turing Reaction-Diffusion / Morphogenesis

Alan Turing's Forgotten Ideas. Turing's 1952 morphogenesis paper described how two diffusing chemicals (activator and inhibitor) interacting on a surface spontaneously produce stable spatial patterns — spots, stripes, spirals. This is a CA/diffusion system that generates biological structure[^A55].

For Antillean: hive chamber shapes and tunnel branching patterns may not need explicit design rules. A Turing reaction-diffusion system between "dig here" activator and "don't dig here" inhibitor pheromones could organically produce realistic chamber morphology — rounded chambers, branching tunnels, regular spacing — from the same diffusion physics already in the system.

The branching tunnel pattern in the early prototype screenshot may already be exhibiting Turing-like instabilities. Worth investigating.

---

### Slime Mould as Biological Collaborative Diffusion

agnescameron/slime-moulds — CA model of Physarum polycephalum[^A191].

Slime mould is the biological archetype of collaborative diffusion. It finds shortest paths through mazes, optimizes transport networks, and reproduces the Tokyo rail network from nutrient placement alone. It does this with no brain, no neurons, no centralized control — just chemical diffusion and local response rules.

It IS a CA. The slime mould CA model is essentially a simplified version of Antillean's pheromone system with feedback. Worth studying the agnescameron implementation directly — it's the most biologically grounded example of emergent pathfinding from pure diffusion.

---

### Hydraulic Erosion for Surface Terrain

Interactive terrain modeling using hydraulic erosion plus a WebGL GPU implementation[^A49][^A50].

Surface world generation in Antillean doesn't need handcrafted maps. Hydraulic erosion on a height map produces realistic terrain — valleys, ridges, drainage networks — the same features that would shape ant colony locations and foraging range in the real world. Erosion = water following gradients and removing material, a CA process on terrain.

GPU erosion runs in real time on WebGL. A procedurally eroded terrain gives Antillean an infinite, geologically plausible surface world with natural features that influence where colonies establish and how foraging territory develops.

---

### L-Systems / Algorithmic Botany for Vegetation

ABOP (Algorithmic Beauty of Plants) — the foundational text on L-system plant simulation[^A59].

Surface vegetation matters for Antillean — food sources, shelter, shade affecting surface temperature, organic matter affecting soil chemistry. L-systems generate realistic plant morphology (branching, leaf arrangements, growth patterns) from simple production rules. Implemented as a CA on a grid, plant growth interacts with the same terrain and soil chemistry layers already in the simulation.

Leaf-cutter ant colonies specifically need vegetation modeling — their entire food chain depends on plant diversity and availability.

---

### Warrens vs Plazas — Organic vs Legible Space

Ribbonfarm — "Warrens, Plazas and the Edge of Legibility."[^A102]

The essay distinguishes organic warrens (illegible, evolved, locally optimal) from designed plazas (legible, planned, globally optimal). Ant hives are the archetypal warren — no blueprint, each tunnel locally optimal, globally emergent structure. Human buildings are plazas — designed top-down, legible, globally planned.

For Antillean's gameplay: the player's intervention is a constant tension between warren and plaza. Ants naturally build warrens. The player can impose plaza-like structure (dig THIS chamber HERE) but the ants will continue evolving the warren around it. The most interesting gameplay states are at the edge of legibility — partially structured, partially emergent.

This also applies to the scent visualization system — making the invisible warren legible to the player IS the game's core interface challenge.

---

### Risk Tolerance Scales with Lifespan

Short-lived ants take greater risks during food collection[^A241].

Life history theory predicts organisms should take greater risks when life expectancy declines. Older ants forage further, take riskier routes, and accept more dangerous food sources — they have less future to lose.

This maps directly into the caste parameter table as an age-dependent modifier:

```
risk_tolerance = base_risk * f(remaining_lifespan)
```

Young ants: conservative, stay near hive, safe routes. Old ants: bold, range far, accept dangerous foraging. The colony gets age-stratified risk distribution automatically — young ants protect investment in youth, old ants maximize output in final days. Emergent from one parameter.

---

### Ant Teaching — Tandem Running

Ants are the first non-human animals documented to teach ([^A218] URL). Experienced foragers perform "tandem running" — slowing to let a naive ant follow, stopping when the follower falls behind, accelerating when contact is reestablished. The naive ant learns the route and can later teach others.

For Antillean: an experienced forager ant has a richer internal state — known route segments stored as directional memory, higher confidence on familiar paths. When a naive ant follows, it inherits a compressed version of that route knowledge. Teaching spreads route knowledge through the colony faster than individual discovery.

In CA terms: a teaching ant lays a specialized "route memory" pheromone on cells it has traversed repeatedly. Naive ants following this scent learn the spatial sequence. This is distinct from normal food-trail pheromone — it encodes path geometry, not just "food is this way."

---

### Altruist Catalysis — Schelling Model

"Giant catalytic effect of altruists in Schelling's segregation model." Even an infinitesimal proportion of altruistic agents has dramatic catalytic effects on collective utility[^A75].

In ant terms: a small number of ants that sacrifice themselves (blocking an enemy, sealing a breach, carrying infected nestmates away from the colony) disproportionately improve colony outcomes. The altruism is individually costly but colonially catalytic.

For gameplay: warrior ants that sacrificially block doorways, sanitation workers that quarantine infected nestmates, ants that seal themselves into compromised tunnels. These emerge from extreme parameter settings (very high colony-agitation sensitivity, very low self-preservation weighting) rather than explicit sacrifice programming. The altruism is a parameter value, not a behavior rule.

---

### Risk-Adjusted Sanitary Care

Ants avoid superinfections by performing risk-adjusted sanitary care. Ants calibrate grooming effort applied to infected nestmates based on infection level — high infection gets minimal care (too risky), low infection gets maximum care (worth the exposure)[^A235].

This is a non-linear response curve — exactly the Gaussian or sigmoid axis in IAUS. The "groom infected nestmate" action has a bell-curve axis: peaks at medium infection level, drops toward zero at very high (too dangerous) and very low (not worth it). The optimal grooming response emerges from the curve shape, not from explicit programming.

---

### Collective Memory Stored in Network Topology

"In the collective memory of 30 million ants." Colony memory isn't in individual ants — it's in the network topology of their interaction patterns. The colony "remembers" successful foraging strategies through which ants interact with which others and how frequently[^A167].

For Antillean: the pheromone trail network IS the colony's memory. The spatial pattern of scent gradients encodes everything the colony has learned about its environment — where food was, where threats came from, which routes are efficient. Destroying tunnels doesn't just damage infrastructure, it destroys memory. Rebuilding doesn't just restore paths, it restores knowledge.

This gives tunnel preservation a deeper meaning in gameplay — players protecting the hive from flooding or cave-ins are protecting the colony's accumulated spatial memory, not just its physical structure.

---

### Key References to Add

- **Lehman & Stanley (2011)** — Abandoning Objectives: Evolution Through the Search for Novelty — novelty search
- **Turing (1952)** — The Chemical Basis of Morphogenesis — reaction-diffusion pattern formation
- **Prusinkiewicz & Lindenmayer (1990)** — The Algorithmic Beauty of Plants (ABOP) — L-system vegetation
- **Hölldobler & Wilson** — The Superorganism; The Leafcutter Ants — core biological references for the entire simulation
- **Couzin et al.** — Collective memory and spatial sorting in animal groups
- **agnescameron/slime-moulds** — CA model of Physarum, biological collaborative diffusion reference
- **Tom Forsyth** — Cellular Automata for Physical Modelling (web.archive.org) — CA physics techniques
- **Ribbonfarm** — Warrens, Plazas and the Edge of Legibility — design philosophy reference

---

### Wave Function Collapse for World Generation

Multiple entries across both channels. WFC (Karth & Smith 2021, originally Gumin 2016) generates locally consistent tilemaps from a sample input by propagating constraints — each cell "collapses" to a tile compatible with its already-decided neighbors. Produces complex, non-repeating output from small training samples.

For Antillean surface terrain and underground structure generation:
- Train WFC on real ant habitat imagery or handcrafted sample maps
- Generated terrain is guaranteed locally consistent — soil types, rock formations, vegetation patches all have correct adjacency
- "Stitched WFC" (item 84/99) allows infinite world generation by overlapping region boundaries
- Caves of Qud (item 5/85) uses WFC end-to-end for all procedural content — a directly comparable project in ambition

Particularly relevant: Brian Bucklew's WFC dungeon generation talk (item 3/72) comes from a game with a living simulation world (Caves of Qud). His approach to making WFC output feel organic rather than random is directly applicable to hive tunnel generation.

**Galak-Z CA + Hilbert Curves** (item 7/73): used CA for dungeon generation combined with Hilbert curves for spatial indexing. Hilbert curves preserve 2D locality in 1D — better than Z-order for some access patterns. Worth comparing against Z-order curve for the grid memory layout.

---

### Cyclic Dungeon Generation (Unexplored)

Unexplored's "Cyclic Dungeon Generation." Generates dungeons with intentional loop structure — multiple paths to goals, meaningful backtracking, narrative coherence. Contrasts with pure WFC which has no concept of intended player path[^A75].

For Antillean hive generation: pure WFC or CA produces structurally random tunnels. Cyclic generation could overlay intentional structure — main corridors with loops, chamber clusters connected in meaningful ways — while still allowing the CA physics to evolve the hive organically from that seed structure. The "rails system" from the original 2014 design notes is exactly this — a preset structural seed that ants then elaborate organically.

---

### 2D Visibility / Line of Sight

Multiple resources on 2D visibility computation[^GU6][^GU7][^GU8][^GU9][^GR8] — shadow casting, sight lines, field of view.

For Antillean this matters at two scales:
- **FPS ant level**: what can an individual ant see/sense? Line of sight through tunnels, shadow casting from tunnel walls
- **Player vision modes**: which scent layers are visible from current camera position? Visibility masking of the influence map overlays

The shader-based dynamic 2D shadows approach ([^A8] unsorted) is particularly relevant — renders visibility as a texture that can be composited with the pheromone visualization layers. An ant's "darkness" of unexplored areas combined with pheromone light sources creates a natural fog-of-war that lifts as the colony explores.

---

### Dead Reckoning for Network Latency Hiding

Dead Reckoning: Latency Hiding for Networked Games[^A64].

Already referenced in the navigation system for individual ant movement. But this item specifically addresses it in the MMO networking context — extrapolating entity positions between server updates to hide latency from players.

For Antillean's sharded MMO architecture: when a player's view crosses a shard boundary, border ants are rendered using dead reckoning extrapolation while the actual shard state syncs. The ant's velocity and direction (already stored in the creature layer) are sufficient to extrapolate convincing movement across a network tick gap. Same technique, two uses: ant navigation AND network latency hiding.

**Planetary Annihilation ChronoCam** [A65]: took dead reckoning further — recorded deterministic game state and could replay/rewind at any speed. For a persistent world MMO, deterministic CA replay would allow full world history reconstruction from seed + event log. Significant for debugging and potential "time travel" spectator features.

---

### Machinations for Economy Design

Machinations[^GU78][^GU79] — a visual language and tool for designing and simulating game economies as flow networks. Resources flow through nodes (sources, drains, converters, pools) with rates and conditions.

For Antillean: the colony economy (food production → consumption → larval development → new workers → more foraging) is exactly a Machinations diagram. Modeling it explicitly before implementing lets you:
- Verify the economy is stable (no runaway accumulation or depletion)
- Find the interesting tension points where player intervention matters
- Tune parameters without running the full simulation

The colonial feelings system (hunger, agitation) are the Machinations flow rates. The caste parameter table determines converter efficiencies. Modeling this in Machinations first would surface balance issues early.

---

### Ambient Sound as Simulation Output

Cogmind's ambient soundscape[^GR9][^GR10] — procedurally generated audio from simulation state. Different machine types, densities, and activity levels produce different ambient sound. The soundscape communicates world state to the player subconsciously.

For Antillean: the simulation already generates everything needed for procedural audio:
- Ant density → ambient movement sound intensity
- Agitation level → alarm tone frequency/urgency  
- Digging activity → excavation sound placement
- Gas pressure → tunnel "wind" ambience
- Stridulation CA layer → directly maps to audio events

The sound vision mode (visualizing stridulation waves) has a direct audio counterpart — the CA pulse IS the sound. Rendering both the visual wave and the audio sample from the same CA layer means sound and vision are always synchronized with the simulation state.

Cogmind's approach of building soundscape from simulation rather than scripted triggers is exactly right for Antillean — the world sounds like itself because the sounds come from what's actually happening.

---

### Perceived Performance vs Actual Performance

Perceived Performance — the only kind that really matters[^GU13].

Directly relevant to the adaptive profiling system. Users don't experience frame rate numbers — they experience smoothness, responsiveness, and feel. The system that matters is one that maintains perceived smoothness even when actual performance varies.

Key techniques:
- Prioritize rendering and input response over simulation update rate — users feel input lag immediately, simulation lag less so
- Use the adaptive dispatch system to shed simulation load before it impacts rendering
- Cosmetic pauses for unavoidable computation feel intentional, not like a freeze — a brief acknowledged "thinking" beat reads better than a stutter

This reframes the 10k agent target: the goal isn't 10k agents at 60fps. It's 10k agents at a framerate that *feels* smooth — which may mean adaptive simulation rate, prioritized rendering, and strategic LOD on distant colony regions.

---

### Morton / Z-Order Curve — Confirmed Reference

[^GU56] / [GU74]: Morton encoding implementation library (libmorton) + Wikipedia article. Already in the document as a speculative idea — libmorton is the library to use for production-quality Morton encoding.

---

### SimCity + Cellular Automata Connection

SimCity, Cellular Automata, and emergent city simulation. SimCity's original zone simulation used CA-like rules — land use spreading, property values diffusing from zone centers. The connection between city simulation and ant colony simulation is direct — both are resource flow networks with emergent spatial organization[^GU23].

Worth noting for the MMO scale: a supercolony viewed at city scale IS a SimCity. Zones of foraging territory, industrial fungus farms, defensive perimeters, transport corridors — all emerging from the same CA physics. The player's RTS/SimCity interface at that scale is just a different viewport into the same simulation.

---

### Dijkstra's in Disguise — Unifying Navigation Algorithms

all shortest-path algorithms — Dijkstra, Bellman-Ford, Johnson's, Floyd-Warshall — are variants of the same underlying computation. They differ in what they trade off (memory vs compute, single-source vs all-pairs, negative weights, etc.)[^A124].

For Antillean this matters because the navigation system already uses several of these implicitly:
- Collaborative diffusion = Dijkstra running continuously on the whole grid
- Pheromone gradient = path memory from a Bellman-Ford-like relaxation
- Floyd-Warshall fallback = explicit all-pairs precomputation

Recognizing they're the same algorithm with different parameters means the navigation system can be implemented as one parameterized solver rather than four separate systems. Choose the trade-off appropriate to the use case — pheromone trails are fine-grained Dijkstra, magnetic field is coarse-grained, dead reckoning is approximate Bellman-Ford with bounded iterations.

---

### Parasitic Behavior Modification (Cordyceps Ecosystem)

[^A27], [^A28], [^A125], [A130]: zombie ant fungi and the hyperparasites that fight them. *Ophiocordyceps* manipulates carpenter ant behavior to climb high and bite leaves at specific times of day. The fungus has its own circadian rhythm controlling host biting. Even more remarkably, there's a *hyperparasitic* fungus that attacks the zombie fungus — the ants are protected by their parasite's parasite.

**Gameplay implications:**

- **Diseased ant mind control** as a real mechanic, not just a debuff. An infected ant's behavioral parameters get hijacked by the parasite. Bites at specific times, climbs to specific heights, then dies releasing spores. Visible, dramatic, biologically accurate.
- **Three-tier ecosystem** — host ants, primary parasites (Cordyceps), hyperparasites that fight Cordyceps. Players manage this ecosystem rather than eliminating any one layer. Eliminating hyperparasites lets Cordyceps explode. Eliminating Cordyceps removes the selection pressure that keeps hosts adapted.
- **Time-locked behaviors** — adds a daily cycle to the simulation. Some behaviors fire only at specific times. Pairs with circadian rhythms that real ants exhibit.

The hyperparasite is also a gameplay loop the player can engineer — deliberately cultivating beneficial Cordyceps-eating fungi in the hive becomes a defense strategy.

---

### Allometric Scaling — Larger Colonies Use Less Energy Per Capita

[^A154], [A155]: metabolic rate scales sub-linearly with colony size. Larger colonies consume proportionally less energy per ant, have lower per-capita activity levels, and show different behavioral patterns. This is biological — a real scaling law, not a design choice.

For Antillean's parameter table:
- Per-ant metabolic cost = base_cost × colony_size^(-0.25) approximately
- Foraging rate per ant decreases as colony grows
- Activity stratification increases — more "idle" ants in larger colonies (this is the Temnothorax NEET ant effect at scale)

This creates natural emergent challenges. A growing colony hits efficiency phase transitions as size scales. Players notice the colony "settles down" past certain population thresholds — fewer ants are visibly active, but the colony is actually more efficient overall.

Combined with [^A156] (colony size affects tunnel branching morphogenesis), large colonies also build different-shaped hives — more chambers, more complex branching. This emerges naturally from CA digging behavior responding to local density, but the biological data confirms the right pattern.

---

### Cecropia-Azteca Plant-Ant Mutualism

[^A112], [A164]: Cecropia trees provide hollow stems as ant homes and produce Müllerian bodies (food). Azteca ants defend the tree from herbivores and choking vines. Colony personality affects plant health — aggressive colonies produce healthier trees.

**For Antillean:** plant-ant mutualism as a core surface gameplay mechanic. Trees can be claimed as "ant houses" — providing shelter and food. Different tree species offer different deals (more food vs more space, better defense position vs more nutrients). Aggressive colonies thrive in this mode; passive colonies starve.

This is also a clean way to make the surface world matter at higher zoom levels. The colony's relationship to specific landmark trees becomes strategically important — Cecropia trees become persistent waypoints in the supercolony scale.

---

### Particle Life / Emergence from Simple Particle Rules

[^A133], [^A177], [A227]: Clusters and Particle Life — a system where particles of different colors attract and repel each other based on a small interaction matrix. Complex life-like emergent behavior arises from pure simple-rule particle interactions.

This is the smallest, simplest emergence model and produces stunning results. For Antillean it's both a reference implementation and a possible component:

- **As reference**: validates the "simple local rules → complex global behavior" thesis at the most extreme. If a 6×6 attraction matrix produces life-like clusters, the much richer rule set of Antillean's CA can clearly produce ant-colony complexity.
- **As component**: gut microbiome modeling. Each ant carries a microbiome — particles of different bacterial types with interaction rules. Diet, contact, antibiotic exposure all affect the particle population. Microbiome composition feeds back into ant behavior (the insulin-signaling caste mechanism).

A microbiome-as-particle-life subsystem would be a tiny CA running inside each ant, costing very little compute, and producing realistic gut bacteria dynamics that feed back into the main simulation.

---

### Fire Ants as Collective Material — Self-Assembled Rafts

[^A108], [^A128], [A230]: fire ants form rafts, towers, and bridges by gripping each other. The collective behaves as a non-Newtonian fluid — flowing when stressed slowly, rigid when stressed quickly. They self-organize material structures from their own bodies.

For Antillean: ants in dense aggregations should exhibit collective material properties:
- Flowing through tight tunnels
- Forming bridges across gaps when foraging
- Self-assembling rafts when flooding occurs
- Building towers to reach elevated food sources

This emerges naturally from the volume scalar + density tolerance parameters already in the design. Ants in high-density configurations gripping each other = increasing local "structural integrity" of the cell. Tower-building emerges when ants seek the highest pheromone gradient and cluster on top of each other. The CA handles this if density physics is modeled correctly.

The non-Newtonian behavior comes for free from the fluid sim — ant aggregations are a viscous fluid that solidifies under rapid stress because gripping reactions outpace movement.

---

### Camera Design for Multi-Scale Zoom

[^GU1], [GU2]: Math for Game Programmers — Juicing Your Cameras + 50 Game Camera Mistakes (John Nesky from thatgamecompany's Journey).

Critical for Antillean given the FPS-ant-to-supercolony zoom range. Nesky's talk specifically covers:
- Smooth transitions between camera modes
- Avoiding disorientation during scale changes
- Framing emergent action without being directorial
- Camera as player attention-direction tool

The 7-level zoom progression in Antillean (Individual → Squad → Platoon → Colony → Regional → Supercolony) requires careful camera design at every transition. Each transition should feel like a perspective shift, not a teleport. Nesky's specific advice on Journey's smooth camera is directly applicable.

---

### Procedural Animation with Personality

[^GU19], [GU91]: Animation Bootcamp's indie procedural animation approach + Giving Personality to Procedural Animations using Math.

Antillean has potentially hundreds of thousands of ants. Hand-authored animation is impossible. Procedural animation driven by the simulation state is the only viable approach. But it needs to feel alive, not robotic.

Key insights from these:
- Spring-damper based limb movement gives organic feel
- Easing functions encode personality (aggressive vs cautious leg lifts)
- Anticipation and follow-through can be procedural
- Caste-specific animation parameters in the same table as behavior parameters

A soldier ant's leg-lift parameters differ from a worker's. A sick ant's stride length is shorter. An agitated ant's antenna twitch frequency is higher. All driven from the parameter table that already exists for behavior — animation IS behavior visualization.

---

### Finite State Machines vs IAUS

FSMs and the AI of Half-Life. The simplest, oldest, most battle-tested game AI architecture[^GU47].

For Antillean's behavioral layer: IAUS is sophisticated but heavyweight. FSMs are crude but trivial to implement. Reality is a hybrid — most ant behavior is FSM-simple (wander, follow, eat, return) with IAUS only needed for complex decisions (Queen reproductive strategy, foraging vs defense priority during attack).

Recommended split:
- **Individual ants**: FSM with maybe 6-8 states, transitions driven by pheromone/feelings thresholds
- **Queen and complex entities**: IAUS for nuanced multi-axis scoring
- **Colony-level decisions**: emergent from pheromone aggregation, no explicit AI needed

This prevents the simulation cost of running full IAUS on 10k+ ants when 95% of them are doing FSM-simple things. Reserve IAUS compute for the entities that actually need it.

---

### Tale in the Desert — Player-Built MMO

A Tale in the Desert. An MMORPG where almost everything is player-built — laws, technology, society. Limited combat, focus on cooperation and emergent social systems[^GU16].

For Antillean's MMO direction: this is the design philosophy reference. Antillean's MMO shouldn't be PvP combat with colony skins — it should be persistent collaborative world-building where colonies negotiate territory, trade resources, form alliances, and develop emergent geopolitics across the shard map.

ATITD ran for 20+ years on this model with a small dedicated playerbase. Antillean's natural audience is the same kind of player — those who care about emergent systems more than reflexes.

---

### Tracery / Data-Oriented Procedural Content

Kate Compton's Tracery[^GR2][^GU38] — JSON-based grammar for procedural content generation. Authors data, not code.

This validates the data-driven design principle for content generation specifically:
- Random ant naming via Tracery grammars
- Procedural quest/event descriptions for emergent events
- Flavor text variations for similar events ("A worker found honeydew" vs "Forager #4827 returned with aphid secretions")
- All authored as JSON data, no code changes needed

The Tracery approach + the IAUS axis tables + caste parameter tables all share the same philosophy: content is data, engine is code, modders never need to touch code.

---

### Universal Sorting / Hierarchical Spatial Structures

Quanta Magazine on universal methods to sort complex information. The article describes hierarchical structures that adapt to data distribution — k-d trees, navigable small-world graphs, hierarchical navigable small-world structures[^A115].

For Antillean's spatial queries (what's near this ant? what's the closest food source? which ants are within sound range?): a naive grid scan is O(N²) for global queries. Hierarchical spatial structures are O(N log N) or better.

The Z-order curve already proposed gives grid-aligned hierarchical access. For non-grid-aligned queries (which entities are within radius R of point P), an HNSW or similar structure layered over the grid gives fast spatial search. Both can coexist.

---

### Berkeley Overmind / StarCraft Potential Fields

how the Berkeley Overmind won the 2010 StarCraft AI competition using potential fields for unit movement. Each unit follows a gradient computed from attractors (enemies, objectives) and repulsors (terrain, friendly units)[^A79].

This IS collaborative diffusion applied to a different domain. The Berkeley team's success validates the approach for large-scale agent navigation. For Antillean it's confirmation that the architecture chosen for ants would also work for the RTS-scale tactical layer — large-scale battles between supercolonies use the same potential field math, just with different attractor/repulsor weights.

---

### Emergent Narrative — James Ryan's Curating Simulated Storyworlds

James Ryan's PhD thesis on emergent narrative. The first dissertation in CS specifically about authoring tools for stories that emerge from simulation rather than being scripted[^GU42].

For Antillean: the simulation produces events constantly — colony founding, mating flights, disasters, wars, parasitic invasions, queen succession. These are stories. The question is how to surface them as narrative without scripting.

Ryan's approach: curate from the simulation. Build tools that watch the simulation for narratively significant patterns (dramatic reversals, character arcs, surprising outcomes), then present them to the player as discovered stories. The simulation generates the raw material, the narrative layer is a filter/curator.

For Antillean specifically: a colony chronicle that auto-generates from significant events. "Day 47: The queen survived an attack by parasitic Atta workers. Forager #234, the colony's most experienced scout, was killed defending her." Reads like a story, generated from simulation data. Tracery-style templates produce the prose, the simulation produces the substance.

---

### Voxel and 3D Pixel Art Approaches

[^GU89], [^GU93], [^GU94], [^GU98], [^GU100], [GU102]: voxel rendering, pixel art shaders, 3D pixel art game engines, voxel ray tracing.

For Antillean at FPS ant level: 2D grid simulation rendered as voxel/3D for the close-up view. The grid state is 2D but rendered as a 3D environment from the ant's perspective — tunnel walls have height, food has volume, the queen is genuinely larger.

This bridges the 2D simulation and the FPS gameplay mode. The CA runs in 2D for performance, but the renderer projects it into 3D at the close-up level. Voxel rendering is well-suited because grid cells map naturally to voxels, and voxel ray tracing is well-developed for real-time rendering.

The "Pixel Art game in a 3D world" approach [^A103] is exactly the visual style — clean pixel sprites against 3D environments.

---

### Rollback Netcode for Authoritative Simulation

Why rollback netcode is better. Used in fighting games but applicable to any networked simulation[^GU109].

For Antillean's MMO: rollback handles inter-shard sync elegantly. Each shard runs ahead optimistically, and when a remote update arrives that conflicts with predicted state, the shard rewinds to the conflict point and re-simulates with correct data. Players never see the rewind because rendering is interpolated.

Combined with deterministic CA (same seed + same inputs = same outputs), rollback gives Antillean's MMO architecture surprising robustness — temporary network issues don't desync the world, they just trigger a local rewind that converges back to consistent state.

---

### Allometric Quote-Worthy Insight: "Behavior in Bulk is More Predictable"

Aeon Essay — collective behavior is more predictable than individual behavior. This validates the whole simulation approach[^A200].

Why this matters for Antillean's adaptive performance system: at the colony scale, you can predict behavior reliably. At the individual ant scale, you cannot. This suggests an optimization — at high zoom levels, simulate every ant. At low zoom levels, simulate colony statistics and only spawn individual ants when needed for rendering. The predictability at scale means you can fake the individual layer without players noticing.

A bit like how human crowd simulations in films model the crowd as a flow field with individual figures procedurally injected for rendering — the simulation operates at a higher abstraction than the rendering.

*More speculative ideas to be added here as they arise.*

---

## 17. Biological Accuracy Notes

The simulation is grounded in real ant pheromone chemistry:

- **Alarm pheromones** — mandibular gland secretions, highly volatile, short-lived. Maps to Alert/Rage cascade.
- **Trail pheromones** — layered compounds, short and long-lived varieties. Maps to Food Trail scent.
- **Oleic acid (death scent)** — builds up on dead ants, triggers removal even in living ants daubed with it. Maps to Death/Refuse layer.
- **Negative reinforcement trails** — ants lay deterrent pheromones on exhausted routes. Maps to Disappointment scent.
- **Queen recognition** — workers identify queen by pheromone signature. Parasitic queens mimic this to take over colonies. Gameplay mechanic.
- **Trophallaxis** — mouth-to-mouth fluid transfer carrying chemical signals. Maps to contact-based feelings diffusion.

The pheromone CA is not an approximation of ant biology. It is the actual physics of chemical signaling expressed on a grid.

---

## 18. Source Channels

This document draws on three Are.na channels of curated reference material:

- [Useful For Simulating Ant Colonies](https://www.are.na/ultimape/useful-for-simulating-ant-colonies) — biology, simulation, emergence research (cited as `A###`)
- [Game Development Notes — Unsorted](https://www.are.na/ultimape/game-development-notes-unsorted) — general game dev references (cited as `GU###`)
- [Game Development Notes — Roguelikes](https://www.are.na/ultimape/game-development-notes-roguelikes) — procedural generation and emergent systems references (cited as `GR###`)

Inline citations throughout the document use GitHub Markdown footnotes — click any `[^ref]` to jump to the source.

[^A8]: [Improbable @ GDC '17 | a look inside SpatialOS](https://www.youtube.com/watch?time_continue=527&v=9lZNGU8bwGc)
[^A21]: [Herringbone Wang Tiles](https://nothings.org/gamedev/herringbone/herringbone_tiles.html)
[^A22]: [Procedural Worlds from Simple Tiles](http://ijdykeman.github.io/ml/2017/10/12/wang-tile-procedural-generation.html)
[^A27]: [Three-dimensional visualization and a deep-learning model reveal complex fungal parasite networks in behaviorally manipulated ants](http://www.pnas.org/content/early/2017/11/06/1711673114.full)
[^A28]: [Daily rhythms and enrichment patterns in the transcriptome of the behavior-manipulating parasite Ophiocordyceps kimflemingiae](http://journals.plos.org/plosone/article?id=10.1371/journal.pone.0187170)
[^A49]: [Interactive terrain modeling using hydraulic erosion](https://dl.acm.org/citation.cfm?id=1632592.1632622)
[^A50]: [WebGL GPU Landscaping and Erosion - Codeflow](http://codeflow.org/entries/2011/nov/10/webgl-gpu-landscaping-and-erosion/)
[^A55]: [Alan_Turing-s_Forgotten_Ideas.pdf](http://www.cs.virginia.edu/~robins/Alan_Turing%27s_Forgotten_Ideas.pdf)
[^A59]: [abop.pdf](http://algorithmicbotany.org/papers/abop/abop.pdf)
[^A64]: [Crashing Waves in the Jellygrade simulator](https://www.youtube.com/watch?v=A-0IXFLpX-4)
[^A75]: [[1803.10505] Giant catalytic effect of altruists in Schelling's segregation model](https://arxiv.org/abs/1803.10505)
[^A79]: [Skynet meets the Swarm: how the Berkeley Overmind won the 2010 StarCraft AI competition](https://arstechnica.com/gaming/2011/01/skynet-meets-the-swarm-how-the-berkeley-overmind-won-the-2010-starcraft-ai-competition/)
[^A83]: Note — "Novelty Search + Collaborative Diffusion" (untitled note in archive)
[^A102]: [Warrens, Plazas and the Edge of Legibility](https://www.ribbonfarm.com/2010/10/27/warrens-plazas-and-the-edge-of-legibility/)
[^A103]: [Autonomous task sequencing in a robot swarm](http://robotics.sciencemag.org/content/3/20/eaat0430)
[^A108]: [Amazing movie of fire ants forming escape rafts](https://www.youtube.com/watch?v=UxjT99l0mqw)
[^A112]: [Colony personality and plant health in the Azteca-Cecropia mutualism | Behavioral Ecology | Oxford Academic](https://academic.oup.com/beheco/article-abstract/29/1/264/4677340?redirectedFrom=fulltext)
[^A115]: [Universal Method to Sort Complex Information Found | Quanta Magazine](https://www.quantamagazine.org/universal-method-to-sort-complex-information-found-20180813/)
[^A124]: [Dijkstra's in Disguise](https://web.archive.org/web/20180918175812/https://blog.evjang.com/2018/08/dijkstras.html?m=1)
[^A125]: [Mind Control: How Parasites Manipulate Cognitive Functions in Their Insect Hosts](https://www.frontiersin.org/articles/10.3389/fpsyg.2018.00572/full)
[^A128]: [Fire ants - sting, prey, raft](https://www.youtube.com/watch?v=F60agY1IpmU)
[^A133]: [Clusters and Particle Life](https://softologyblog.wordpress.com/2018/11/08/clusters-and-particle-life/)
[^A154]: [Allometric Scaling of Metabolism, Growth, and Activity in Whole Colonies of the Seed‐Harvester Ant Pogonomyrmex californicus...](https://www.jstor.org/stable/10.1086/656266)
[^A156]: [The Role of Colony Size on Tunnel Branching Morphogenesis in Ant Nests](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0109436)
[^A167]: [Opinion | In the 'collective' memory of 30 million ants](https://www.livemint.com/Opinion/xzTIoDvk7o5B8aVZWRDkOM/Opinion--In-the-collective-memory-of-30-million-ants.html)
[^A177]: [How a life-like system emerges from a simple particle motion law](https://www.nature.com/articles/srep37969)
[^A183]: [sandspiel](https://sandspiel.club/info/)
[^A191]: [agnescameron/slime-moulds](https://github.com/agnescameron/slime-moulds)
[^A200]: [Our behaviour in bulk is more predictable than we like to imagine | Aeon Essays](https://aeon.co/essays/our-behaviour-in-bulk-is-more-predictable-than-we-like-to-imagine)
[^A218]: Washington Post (2006) — "Ants Are First Non-Humans To Teach, Study Says"
[^A225]: [mpm guide - niall t.l.](https://nialltl.neocities.org/articles/mpm_guide.html)
[^A226]: [nialltl/incremental_mpm](https://github.com/nialltl/incremental_mpm)
[^A230]: [Ant colonies flow like fluid to build tall towers](https://www.nature.com/news/ant-colonies-flow-like-fluid-to-build-tall-towers-1.22290)
[^A235]: [Ants avoid superinfections by performing risk-adjusted sanitary care](https://www.pnas.org/content/115/11/2782)
[^A241]: [Short-Lived Ants Take Greater Risks during Food Collection](https://www.jstor.org/stable/10.1086/668009?seq=1)
[^A250]: [Z-order curve - Wikipedia](https://en.wikipedia.org/wiki/Z-order_curve)
[^A253]: [Active Inferants: An Active Inference Framework for Ant Colony Behavior](https://www.frontiersin.org/articles/10.3389/fnbeh.2021.647732/full)
[^A254]: [The-Powder-Toy/The-Powder-Toy](https://github.com/The-Powder-Toy/The-Powder-Toy)
[^GU1]: [Math for Game Programmers: Juicing Your Cameras With Math](https://www.youtube.com/watch?v=tu-Qe66AvtY)
[^GU6]: [2d Visibility](https://www.redblobgames.com/articles/visibility/)
[^GU7]: [Sight & Light](http://ncase.me/sight-and-light/)
[^GU8]: [My technique for the shader-based dynamic 2D shadows](http://www.catalinzima.com/2010/07/my-technique-for-the-shader-based-dynamic-2d-shadows/)
[^GU9]: [2D Lighting and Shadows | Blog | Fisher Evans](http://fisherevans.com/blog/post/2d-lighting-and-shadows)
[^GU13]: [Perceived performance: The only kind that really matters - Eli Fitch (Social Tables)](https://www.youtube.com/watch?v=8oWpsNSOqOw)
[^GU16]: [A Tale in the Desert - Wikipedia](https://en.wikipedia.org/wiki/A_Tale_in_the_Desert)
[^GU19]: [Animation Bootcamp: An Indie Approach to Procedural Animation](https://www.youtube.com/watch?v=LNidsMesxSE)
[^GU23]: [SimCity, Cellular Automata, and Happy Tool for HyperLook (nee HyperNeWS (nee GoodNeWS))](https://medium.com/@donhopkins/hyperlook-nee-hypernews-nee-goodnews-99f411e58ce4)
[^GU38]: [Practical Low-Effort PCG: Tracery and data-oriented PCG authoring - Kate Compton](https://invidio.us/watch?v=Np9FRl847qM)
[^GU42]: [James Ryan on Twitter](https://twitter.com/xfoml/status/1096463136297832448)
[^GU47]: [Finite State Machines and the AI of Half-Life | AI 101 | AI and Games](https://invidio.us/watch?v=JyF0oyarz4U)
[^GU56]: [Morton encoding/decoding through bit interleaving: Implementations](https://www.forceflow.be/2013/10/07/morton-encodingdecoding-through-bit-interleaving-implementations/)
[^GU78]: [[11-13] Mihai Gheza - Machinations: The New Way of Designing Game Economies - Dev.Play 2018](https://www.youtube.com/watch?v=duOp3cNo0gc)
[^GU79]: [Machinations: A New Way to Design Game Mechanics](https://www.gdcvault.com/play/1016458/Machinations-A-New-Way-to)
[^GU89]: [How Are Games Rendering Fur?](https://www.youtube.com/watch?v=9dr-tRQzij4)
[^GU93]: [Crafting a Better Shader for Pixel Art Upscaling](https://www.youtube.com/watch?v=d6tp43wZqps)
[^GU94]: [God Rays in 3D Pixel Art Game Engine](https://www.youtube.com/watch?v=fSNdZ82I-eQ)
[^GU98]: [Voxel Ray Tracing](https://www.youtube.com/watch?v=gXSHtBZFxEI)
[^GU100]: [What are Voxels and why are they so cool?](https://www.youtube.com/watch?v=WWU8t0CpNQA)
[^GU109]: [Analysis: Why Rollback Netcode Is Better](https://www.youtube.com/watch?app=desktop&v=0NLe4IpdS1w)
[^GR2]: [Practical Low-Effort PCG: Tracery and data-oriented PCG authoring - Kate Compton](https://invidio.us/watch?v=Np9FRl847qM)
[^GR8]: [2d Visibility](https://www.redblobgames.com/articles/visibility/)
[^GR9]: [Music for Cogmind? - Grid Sage Games](https://www.gridsagegames.com/blog/2017/04/music-for-cogmind/)
[^GR10]: [Building Cogmind's Ambient Soundscape - Grid Sage Games](https://www.gridsagegames.com/blog/2020/06/building-cogminds-ambient-soundscape/)

---

*Antillean — design document. Synthesis of notes spanning 2010-2026.*
