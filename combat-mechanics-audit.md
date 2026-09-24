# Combat Mechanics & Tuning Audit

Analysis and recommendation task only — no architecture or AI rewrites were made. All findings reference actual code/data in this repo as of this audit.

## 1. Current combat model

**Data flow:** `AISystem` (perception/state/movement/facing/attack intent) → `ItemSystem.useItem/fireWeapon` (cooldown + resource check) → `ProjectileSystem.fireAtTarget` → `CollisionSystem` (overlap detection only) → `CombatSystem` (damage, hit-reaction, knockback).

**Per-enemy loop (`AISystem.js:449-627`):**
```
idle/patrol → isAware? → chase (moveToward target at ai.moveSpeed)
  → distance <= attackRadius && LOS? → attack (strafe via CombatMovementComponent, fire on cooldown)
  → target lost for awarenessMemory seconds → back to idle/patrol
```
There is exactly one distance threshold, `AIComponent.attackRadius` (default 30). Once inside it, the enemy stops approaching and only strafes sideways (`applyCombatMovement`, `AISystem.js:566-585`) — it never backs off if the player closes to melee range, and never has a separate "get closer" band. So today there is no `too close → preferred → too far` structure, only `outside range → inside range`.

**Attacking is not gated by anything except a raw per-item cooldown** (`ItemComponent.nextFireTime`, `ItemSystem.js:44-67`). There's no wind-up state, no telegraph, and the attack animation (`ANIMATION_DEFINITIONS.attack`, `spriteAnimations.js:12-15`) is purely cosmetic — `applyAttack` fires the instant cooldown expires regardless of animation frame (`AISystem.js:616-627`, `AnimationSystem.js:44-68` never gates firing).

**Hit reaction** (`CombatSystem.applyHitReaction`, `CombatSystem.js:70-109`) is driven by two independent per-projectile numbers, `staggerPower` and `knockback`, both decoupled from `damage`. Reaction state (`flinch`/`stagger`) and knockback vector are written to `HitReactionComponent`; `AISystem.tickHitReaction`/`applyKnockback` (`AISystem.js:174-226`) interpret them every frame.

**Collision has no entity-vs-entity resolution.** `CollisionSystem.update()` only records overlap *events* for `CombatSystem` to turn into damage; `MovementSystem.update()` (`MovementSystem.js:36-71`) checks position only against `raycaster.isWallWorld`, never against other entities. Nothing pushes overlapping entities apart, ever — for player-vs-NPC or NPC-vs-NPC.

**Enemy variety is currently minimal.** Only two templates exist in `componentDefaults.json`: `enemy` and `enemyHunter` (the latter just adds `HuntingComponent` + faster/harsher `CombatMovementComponent`/`HitReactionComponent` numbers). Both use `viewDistance: 100`, `attackRadius: 30`, and the inherited `AIComponent.moveSpeed` default of `6`. No level/entity data anywhere overrides `AIComponent` per spawn — every enemy in every map is one of these two profiles.

---

## 2. Existing tuning controls (what we already have)

| Concept | Component/file | Notes |
|---|---|---|
| Approach speed | `AIComponent.moveSpeed` (`AIComponent.js:55`) | Per-entity, but never varied in data today |
| View/aggro range | `AIComponent.viewDistance`, `fieldOfView` | Per-entity |
| Attack engagement range | `AIComponent.attackRadius` | Single threshold, per-entity |
| Turn rate | `AIComponent.turnSpeed` | Per-entity |
| Target memory | `AIComponent.awarenessMemory` | Per-entity |
| Decision cadence | `AIComponent.decisionInterval` | Per-entity, decoupled from movement/facing (those run every frame) |
| In-combat repositioning | `CombatMovementComponent.strafeSpeed/strafeFrequency` + randomized `phase` | Per-entity, already has anti-lockstep randomization |
| Fire cadence | `itemData[item].fireRate` | Per-weapon, but see gap below (hidden +2s AI penalty) |
| Damage | `projectileData[type].damage` | Per-projectile |
| Stagger trigger | `projectileData[type].staggerPower` vs `HitReactionComponent.staggerThreshold` | Both sides tunable independently — already a weapon-vs-enemy relationship |
| Stagger duration/anti-lock | `staggerDuration`, `minStaggerDuration`, `diminishingFactor`, `recoveryDuration` | Per-entity; genuinely well designed already (see §8) |
| Knockback | `projectileData[type].knockback` (magnitude) × `HitReactionComponent.knockbackDecay` (per-entity mass/resistance) | Duration is *derived*, not stored (see §6) |
| Weapon reach | `projectileData[type].speed × lifetime` | No explicit "range" field, but this product defines effective range |
| Hitbox sizes | `CollisionComponent.radius/height`, `projectileData[type].collisionRadius/Height` | Per-entity/per-projectile |
| Resource cost | `itemData[item].consumes` + `ResourceComponent` | Player-relevant; enemies bypass this (no `ResourceComponent`) |
| Health scaling | `EntitySpawner.applyModifiers` → `modifiers.healthMultiplier` (`EntitySpawner.js:19-32`) | The *only* wired scenario-level modifier today |

**Ergonomics of the above:** enemy behavioral values (speed, ranges, turn rate) live in one small component; weapon identity values (damage/stagger/knockback/speed) live in a second small file (`projectileData.js`); fire cadence lives in a third (`itemData.js`). All are flat, readable objects — genuinely easy to hand-tune once you know where to look. The friction is less "hard to edit a number" and more "the same gameplay concept is spread across 3 files with a hidden multiplier in the middle" (see §5/§11).

---

## 3. Combat design gaps

1. **Range mismatch is real, not hypothetical.** Pistol: `speed 50 × speedMultiplier 2 = 100 u/s`, `lifetime 2s` → ~200 units of reach. Shotgun (unused in data, but defined): `speed 50 × 4 = 200 u/s × 2s` → ~400 units. Enemy `attackRadius` is `30`. Enemy `viewDistance` is `100`. So a player can often see/shoot an approaching enemy well before that enemy is close enough to fire back at all — and since enemy `moveSpeed` (6) is a third of the player's default `MovementComponent.speed` (20), the player can kite indefinitely while chipping away. This is exactly the "stay outside enemy range and shoot them indefinitely" failure mode, and it's visible directly in the data, not just in feel.
2. **No preferred-distance band.** `attackRadius` is a single threshold; `CombatMovementComponent` only strafes sideways at whatever distance the enemy happened to cross into "attack" at. Nothing repels the enemy if the player gets in its face, and nothing pulls it forward if it's sitting at the very edge of `attackRadius`.
3. **No enemy awareness of other enemies, and no physical separation at all.** `NPC` layer's default collision mask (`CollisionComponent` default `mask = COLLISION.PLAYER`, `CollisionComponent.js:26`) never includes `NPC`, so two enemies don't even generate a collision *event* against each other, let alone get pushed apart. Combined with `MovementSystem` never checking entity-vs-entity overlap, enemies can fully stack on the same coordinate.
4. **No attack wind-up/telegraph.** Firing is instant on cooldown; the attack animation is decorative and unlinked to the actual shot. There's no window in which the player can read "this enemy is about to fire" and react.
5. **Flinch is not purely cosmetic.** Per `AISystem.update` (`AISystem.js:151-168`), *both* `flinch` and `stagger` zero out movement and block attacking; only `stagger` additionally blocks turning. So today's "small hit" reaction already fully interrupts the enemy, not just a visual twitch — this conflicts with the "small hit → visual only" principle in §8.
6. **Only two enemy profiles exist, and neither preferred distance nor `moveSpeed` is varied per instance anywhere**, so every enemy in a wave behaves identically and — combined with gap #3 — clusters into a single stack of identical AI converging on the same point.
7. **A hidden, hardcoded fire-rate penalty exists only for AI.** `ItemSystem.fireWeapon` adds `fireRateModifier = 2` (seconds) whenever `enemyTarget` is present (`ItemSystem.js:53-56`, flagged in the code itself with `// Move this to component`). This means enemy pistols actually cool down at `0.5 + 2 = 2.5s`, not the `0.5s` visible in `itemData.js` — a real trap for anyone tuning combat by reading the data file alone.
8. **`enemyBolt` and `rocket` projectile definitions, and the `shotgun` item, are fully authored but unused** (nothing in any entity/level data equips anything but `pistol`, and only `pistol`/`shotgun` reference `plasma`). The data model for weapon identity (§7) is already richer than what's actually wired into the game.

---

## 4. Tuning opportunities that require no code changes (Category A)

All of these can be tried today purely by editing `componentDefaults.json` / `itemData.js` / `projectileData.js` / entity JSON:

- **Close the range gap:** raise `enemy.AIComponent.attackRadius` (e.g. 30 → 60-80) and/or reduce projectile `speed`/`lifetime` on the player's weapon, and/or raise `AIComponent.moveSpeed` toward the player's `MovementComponent.speed` (20). Any one of these already changes the "kite forever" dynamic.
- **Give `enemyHunter` (or a new copy of `enemy`) a different `attackRadius`/`moveSpeed`/`CombatMovementComponent` today** — the template mechanism already supports as many named profiles as you want; nothing stops adding `enemyRanged`, `enemyAggro`, etc. to `componentDefaults.json` right now with only `attackRadius`, `moveSpeed`, `strafeSpeed/Frequency`, `staggerThreshold/Duration` differing.
- **Give the `shotgun` item a distinct, higher-knockback/lower-stagger projectile** by pointing `itemData.shotgun.projectile` at a new `projectileData` entry (or reusing `rocket`'s numbers as a starting point) — this alone demonstrates weapon-identity variety (§7) with zero code.
- **Fix the real fire-rate mismatch by editing data**, e.g. lower `fireRateModifier`'s effective value by raising `itemData.pistol.fireRate` closer to what you actually want enemies to feel like (can't remove the hidden `+2` without code, but can compensate for it — see §5 for the real fix).
- **Vary `HitReactionComponent.staggerThreshold`/`staggerDuration` per enemy template** (already done between `enemy` and `enemyHunter`) to give "tanky" vs "flinchy" enemy identities today.
- **Use `wave.modifiers.healthMultiplier`** (already wired end-to-end in `EntitySpawner`/`WaveRules`) to scale difficulty across waves without touching code.

---

## 5. Small implementation opportunities (Category B)

These are small, local, additive changes that fit the existing architecture — described here as recommendations/examples, not applied.

1. **Move the hidden AI fire-rate penalty into data.** Replace the literal `fireRateModifier = 2` in `ItemSystem.fireWeapon` (`ItemSystem.js:53-56`) with a field the AI's equipped item (or `ItemComponent`) already declares, e.g. `item.aiFireRatePenalty ?? 0`. This is a one-line source change plus a data field, and it's the single highest-value ergonomics fix in the codebase — right now nobody tuning `itemData.js` can see the number that actually governs enemy cadence.
2. **Add a genuine preferred-distance band**, expressed as two new `AIComponent` fields, e.g. `minCombatDistance` and `attackRadius` (already exists) used together in `applyCombatMovement`: if `distance < minCombatDistance`, bias the strafe vector outward; if `distance` is near `attackRadius`'s upper edge, bias inward. This reuses the existing strafe/wobble math (`AISystem.js:566-585`) — no new state machine, just adding a radial term to the existing lateral one.
3. **Per-instance preferred-distance variation**, e.g. `preferredDistance = attackRadius * (0.6 + Math.random() * 0.4)` computed once at spawn/construction time on `AIComponent` (same pattern `CombatMovementComponent.phase` already uses for its own per-instance randomization, `CombatMovementComponent.js:28`). Purely additive, no new perception logic, and naturally reduces clustering since enemies stop converging on one exact ring.
4. **Minimal separation nudge, no NPC-to-NPC perception needed.** `AISystem` already iterates `this.aiList`/`this.movementList` every frame for its own registered entities. A tiny O(n²) pass (cheap at realistic enemy counts — waves are small) that adds a small "push away from any other AI entity closer than `collisionRadius*2`" vector into `moveX/moveY` before `MovementSystem` runs would satisfy "don't occupy the same space" without introducing flocking, coordination, or new perception. This is the smallest plausible version of §2's ask — it does not require fixing the `NPC` collision mask or building collision resolution into `CollisionSystem`.
   - Alternative/complementary: give `enemy` entities a mask that includes `NPC` (currently only `PLAYER`) so `CollisionSystem` at least *detects* NPC-NPC overlap — but note this system still wouldn't resolve/separate them; it would just start firing collision events (which today only `CombatSystem` consumes for damage), so this alone is **not** sufficient and would need the AISystem-side nudge above regardless.
5. **A minimal attack wind-up**, without new architecture: reuse the existing `attack` animation duration as the gate. Right now `applyAttack` fires as soon as `ai.state === "attack"` and cooldown allows; the smallest change is to only allow firing once `combatMovement`/a new tiny per-entity timer (`attackWindUp` seconds, defaulting to 0 so nothing breaks for entities without it) has elapsed since entering the `attack` state, tracked the same way `decisionTimer` already is. No animation system changes required — you can even drive it directly off `ANIMATION_DEFINITIONS.attack.frameDuration` if you want the wind-up and the visible tell to always match.
6. **Distinguish flinch from stagger's movement lockout**, per §8's hit-reaction principle: currently both fully block movement and attacking (`AISystem.js:151-168`). A one-line change — let `flinch` continue to allow movement (only block attack), reserving the full movement lockout for `stagger` — would make small hits read as pure feedback rather than a second, shorter stun, matching the "temporary combat advantage" framing you want stagger to have.
7. **Wire per-wave AI overrides.** `WaveRules.spawnWave` (`WaveRules.js:170-189`) only forwards `prefab`/`spawnZone`/`spawnPoint`/`modifiers` to `EntitySpawner.spawn`, dropping any `components` override even though `EntitySpawner.spawn`/`PrefabFactory.createEntity` already fully support merging a `components.AIComponent` override per spawn request. Forwarding `wave.components` through untouched is a couple of lines and immediately unlocks per-wave `attackRadius`/`moveSpeed`/etc. experimentation without touching `componentDefaults.json`.

---

## 6. Ratio/derived-value opportunities

Going through the requested list against what actually exists in the code:

| Relationship | Worth exposing as a ratio? | Why |
|---|---|---|
| **Knockback duration** | Already implicitly derived (`length` decays via `knockbackDecay` each frame, `AISystem.js:208-226`) — there is no stored "duration" today. **Worth making explicit**: expose `knockbackDuration` per weapon and derive `knockback` magnitude and/or `knockbackDecay` from it at data-load time, so a designer can reason in seconds instead of a magnitude/decay pair whose combined duration isn't visible anywhere. |
| **stagger duration / weapon fire interval** | **Yes, worth it.** This is exactly the `staggerRatio` example from the brief. `HitReactionComponent.staggerDuration` and `itemData[item].fireRate` currently live in two unrelated files with no visual link; a designer can't tell from either file whether a hit is a "control weapon" (stagger ≈ fire interval) or "feedback only" (stagger ≪ fire interval) without cross-referencing both and doing the division themselves. |
| **knockback / damage** | Marginal. They're already independent fields on the same `projectileData` object, sitting right next to each other — the relationship is visible at a glance without a ratio. A comment documenting *intended* archetypes (e.g. "shotgun: high dmg/high kb/med stagger") would do most of the work a ratio would. |
| **projectile speed / attack range** | **Yes, but as a derived read-only value, not an input.** "Effective range" = `speed × lifetime` is a real, non-obvious number (shown in §3) that nobody currently computes anywhere. Even just logging/displaying it next to each `projectileData` entry (a debug/tooling addition, not gameplay code) would prevent range mismatches like the current one. |
| **attack cooldown / movement speed** | Not obviously useful as a ratio — these govern different axes (how often vs how fast) and combining them doesn't map to a single tunable knob a designer would reach for. Better handled via the wind-up + preferred-distance changes in §5. |
| **enemy movement speed / preferred distance** | Somewhat useful conceptually (how many seconds to close the preferred gap), but low payoff to formalize until preferred distance itself exists (§5.2/5.3). Revisit after that lands. |
| **hitbox size / projectile size** | Not worth a ratio — these are already just two radii compared directly in `CollisionSystem.overlaps`; a ratio would obscure rather than clarify. |
| **damage / fire rate (DPS)** | **Yes, useful as a derived/reported value**, especially once more weapons exist — a "DPS" readout per weapon (damage ÷ fireRate) is the standard way balance discussions happen, and currently requires manual arithmetic across two files. |
| **damage / enemy health (TTK)** | **Yes, same reasoning** — "shots to kill" is a directly meaningful number for feel and is trivial to derive once weapon/enemy data are read together; worth a small dev-only tool/log rather than a stored field. |

**General principle:** ratios earn their keep specifically where two values from *different systems/files* interact non-obviously (stagger vs fire-rate, projectile speed/lifetime vs enemy attack radius, damage vs health/fire-rate). Where two values already sit side by side in the same object (damage/knockback/staggerPower all on one `projectileData` entry), a ratio adds indirection without adding clarity — a short comment documenting the intended relationship is enough.

---

## 7. Clustering analysis

**Root cause, precisely:** two independent gaps compound.
1. `CollisionComponent`'s default `mask` is `COLLISION.PLAYER` only (`CollisionComponent.js:26`), and enemy templates never override it — so NPC vs NPC never even satisfies `CollisionSystem.canCollide` (`CollisionSystem.js:151-154`). No event is ever generated between two enemies.
2. Even if it were, `CollisionSystem` never resolves overlaps positionally — it only queues events for `CombatSystem` to turn into damage (`CollisionSystem.js:180-183`). `MovementSystem` only ever checks the world (`raycaster.isWallWorld`), never other entities (`MovementSystem.js:59-65`). So there is no physical "solid body" behavior between any two entities in this engine today, NPC or otherwise.

**Smallest plausible intervention:** a repulsion nudge inside `AISystem`, not a `CollisionSystem`/`MovementSystem` change. `AISystem` already holds `this.aiList`/`this.movementList` for every AI entity each frame; a short pairwise pass (bounded by however many AI entities exist at once — small for wave-based combat) that adds a scaled "push away from anyone within `2×collisionRadius`" vector into the entity's `moveX/moveY` before `MovementSystem` consumes it is a handful of lines, touches no other system, and requires no new component. This literally is "don't occupy the same space" rather than "coordinate tactically."

**Preferred-distance variation as a complementary, even cheaper fix:** because every enemy currently converges on the *same* `attackRadius` (30) with no jitter, stacking is worse than it would otherwise be even with separation in place — several enemies trying to sit at exactly the same ring around the player naturally overlap. Randomizing a per-instance `preferredDistance` (§5.3) reduces the *pressure* toward clustering without any NPC-to-NPC perception at all, and is strictly simpler to add than the separation nudge (it's a spawn-time scalar, not a per-frame O(n²) pass). If only one can be tried first, this is the cheaper/lower-risk one.

---

## 8. Stagger/knockback analysis

**How stagger works today** (`CombatSystem.applyHitReaction`, `AISystem.tickHitReaction`):
- Triggered when `projectile.staggerPower >= entity.HitReactionComponent.staggerThreshold` **and** the entity isn't in post-stagger `recoveryTimer`.
- Duration = `max(minStaggerDuration, staggerDuration × diminishingFactor^staggerChainCount)` — genuinely well-designed anti-stunlock: repeated qualifying hits shorten each subsequent stagger, down to a floor, so a weapon *can* pin a susceptible enemy but never fully forever.
- While staggered: no movement, no turning, no attacking (`AISystem.js:151-168`).
- A hit below threshold, if the entity isn't already staggered, produces `flinch` instead — **but flinch blocks movement and attacking too**, differing from stagger only in (shorter) duration and in still permitting turning. This is the one place current behavior conflicts with the "small hit → visual only" principle (§4.5, §5.6).
- After a stagger ends, `recoveryDuration` seconds of "next qualifying hit is downgraded to flinch" follow, then `staggerChainCount` resets. **An enemy cannot be permanently stun-locked** by design — this is already solved.
- **Stagger and knockback are independent** (`applyHitReaction` computes them from separate fields, `source.knockback` and `source.staggerPower`), so a hit can carry either, both, or neither — this already supports the desired "knockback controls where, stagger controls what" split at the data level; nothing stops a projectile from defining high knockback + low stagger or vice versa today.

**Stagger vs fire-rate as a design lens, applied to current numbers:** pistol fires every `0.5s` (or effectively `2.5s` for AI, per the hidden penalty in §3.7) and does `staggerPower: 6` against a threshold of `8` (enemy) / `14` (enemyHunter) — meaning **the pistol currently never staggers a base enemy at all**, only flinches it (`6 < 8`), and never even flinches-to-stagger an `enemyHunter`. Only `staggerDuration: 0.5`/`0.4` values exist per-enemy, and they're never actually reached by the only weapon in play. This is a concrete, checkable gap: right now stagger is essentially inert content because no shipped weapon crosses any shipped enemy's threshold.

**How knockback works today:** magnitude comes entirely from `projectileData[type].knockback`, direction is away from the hit source, and "duration" isn't a stored value — it's an emergent property of `knockback` magnitude divided against `HitReactionComponent.knockbackDecay` (an exponential-ish per-second falloff). It already interacts correctly with world walls (via `MovementSystem`'s existing wall check) but, per §7, **not at all with other entities** — a knockback can shove an enemy through/into another enemy's space since neither resolves collision.

**Assessment against "weapons control space":** the *data model* already fully supports it — `damage`/`staggerPower`/`knockback` are three independent numbers per projectile, and `staggerThreshold`/`knockbackDecay` are two independent per-enemy resistances. The only reason today's game doesn't feel like it has weapon identity is that **only one projectile (`plasma`) is actually used**, by both the player and every enemy. This is a data-authoring gap, not an architecture gap — a shotgun-vs-control-weapon split is achievable by writing two more `projectileData` entries and pointing items at them, zero code required.

---

## 9. Tuning matrix

| Variable | Where defined | What it affects | Current relationship | Easy to tune? | Suggested tuning approach |
|---|---|---|---|---|---|
| `AIComponent.moveSpeed` | `AIComponent.js:55` | Chase speed | Independent; default 6 vs player's default `MovementComponent.speed` 20 | Yes (per template) | A/B test raising toward player speed |
| `AIComponent.viewDistance` | `AIComponent.js:32` | Aggro/perception range | Independent | Yes | Fine as-is |
| `AIComponent.fieldOfView` | `AIComponent.js:33` | Perception cone | Independent | Yes | Fine as-is |
| `AIComponent.attackRadius` | `AIComponent.js:34` | Sole engage/attack threshold | Compared against player's effective weapon range (derived, not stored) | Yes, but relationship to weapon range is invisible | Add a derived "effective range" readout per weapon; raise `attackRadius` |
| `AIComponent.turnSpeed` | `AIComponent.js:38` | Facing responsiveness | Independent | Yes | Fine as-is |
| `AIComponent.awarenessMemory` | `AIComponent.js:47` | How long target-lock persists after LOS break | Independent | Yes | Fine as-is |
| `AIComponent.decisionInterval` | `AIComponent.js:52` | Perception/state cadence (not movement/attack cadence) | Independent | Yes | Fine as-is |
| `CombatMovementComponent.strafeSpeed/Frequency` | `CombatMovementComponent.js:18-22` | In-combat lateral movement | Independent, already randomizes `phase` per-instance | Yes | Add radial (toward/away) term for preferred distance |
| `HitReactionComponent.staggerThreshold` | `HitReactionComponent.js:27` | Whether a hit staggers vs flinches | Compared against `projectileData.staggerPower` — currently never crossed by pistol | Yes, but cross-file | Expose stagger-vs-weapon check as a derived/logged value |
| `HitReactionComponent.staggerDuration` / `minStaggerDuration` / `diminishingFactor` | `HitReactionComponent.js:30-38` | Stagger length + anti-lock decay | Self-contained, well-designed | Yes | Consider expressing `staggerDuration` relative to `itemData.fireRate` (ratio) |
| `HitReactionComponent.recoveryDuration` | `HitReactionComponent.js:44` | Stagger-chain cooldown/reset window | Independent | Yes | Fine as-is |
| `HitReactionComponent.flinchDuration` | `HitReactionComponent.js:31` | Weak-hit reaction length | Behaves like a short stagger today (blocks move+attack) | Yes, but semantics need a code tweak | See §5.6 |
| `HitReactionComponent.knockbackDecay` | `HitReactionComponent.js:48` | Per-entity knockback "resistance"/falloff rate | Combines with projectile `knockback` to produce an *implicit* duration | Yes, but duration isn't visible | Derive/expose effective knockback duration |
| `projectileData[type].damage` | `projectileData.js` | HP loss per hit | Compared against `HealthComponent.maximum` for TTK | Yes, but TTK isn't computed anywhere | Add a derived TTK readout |
| `projectileData[type].staggerPower` | `projectileData.js` | Stagger/flinch trigger strength | See above | Yes | — |
| `projectileData[type].knockback` | `projectileData.js` | Push magnitude | See above | Yes | — |
| `projectileData[type].speed` / `lifetime` | `projectileData.js` | Effective weapon range (`speed × lifetime`) | Directly drives the range-vs-`attackRadius` mismatch (§3.1) | Yes individually, but the *product* (range) isn't surfaced | Add a derived "range" field/log |
| `projectileData[type].collisionRadius/Height` | `projectileData.js` | Hit registration size | Compared directly against `CollisionComponent.radius/height` in `overlaps()` | Yes | Fine as-is |
| `itemData[item].fireRate` | `itemData.js` | Nominal cooldown between shots | **Silently modified by a hardcoded `+2s` for any AI-fired shot** (`ItemSystem.js:56`) | No — hidden constant elsewhere | Move `fireRateModifier` into data (§5.1) |
| `itemData[item].speedMultiplier` | `itemData.js` | Multiplies projectile speed (contributes to range) | Independent | Yes | — |
| `itemData[item].consumes` | `itemData.js` | Ammo/resource cost per shot | Player-only (`ResourceComponent`); enemies bypass it | Yes for player | Fine as-is |
| `CollisionComponent.radius/height` | `CollisionComponent.js:19-20` | Physical footprint, hit detection | Default `mask` excludes `NPC` layer entirely | Yes to edit, but the *behavioral* gap (no NPC-NPC collision) needs code | See §5.4/§7 |
| `HealthComponent.maximum` | `HealthComponent.js:12` | Enemy durability | Only scenario-level lever is `EntitySpawner`'s `healthMultiplier` | Yes | Fine as-is |
| `EntitySpawner.applyModifiers` (`healthMultiplier`) | `EntitySpawner.js:19-32` | Per-wave/session health scaling | The only wired scenario modifier today | Yes | Could add analogous `speedMultiplier`/`damageMultiplier` the same way |

---

## 10. Concrete experiments to try next

Ordered roughly existing-data-only → small isolated code change → larger future AI work.

**Experiment A — Close the range/speed gap (data only)**
Hypothesis: raising `AIComponent.attackRadius` (30→60) and `moveSpeed` (6→10-12) removes the "kite forever" exploit.
Variables: `componentDefaults.json` `enemy`/`enemyHunter` → `AIComponent.attackRadius`, `moveSpeed`.
Expected effect: enemies close distance fast enough to threaten before the player can fully disengage.
Risk: none — pure data, easily reverted.

**Experiment B — Make stagger actually reachable (data only)**
Hypothesis: pistol's `staggerPower: 6` never exceeds either enemy's `staggerThreshold` (8/14) — stagger is currently inert. Lowering `staggerThreshold` (or raising `staggerPower`) will let players observe the existing anti-stunlock system at all.
Variables: `HitReactionComponent.staggerThreshold` or `projectileData.plasma.staggerPower`.
Expected effect: stagger/flinch loop becomes visible in actual play.
Risk: none — data only.

**Experiment C — Give the shotgun real identity (data only)**
Hypothesis: pointing `itemData.shotgun.projectile` at a new high-damage/high-knockback/low-stagger `projectileData` entry (vs. pistol's balanced numbers) demonstrates weapon-space-control without any code.
Variables: new `projectileData` entry + `itemData.shotgun.projectile`.
Expected effect: two weapons feel meaningfully different in a firefight.
Risk: none — data only, and it exercises already-unused content (`shotgun` item is defined but never equipped anywhere).

**Experiment D — Per-wave AI variety (data only, once §5.7 wiring lands)**
Hypothesis: once `WaveRules` forwards `wave.components`, later waves can spawn an `AIComponent` override (e.g. faster, longer `attackRadius`) purely from map/wave data.
Variables: `wave.components.AIComponent` in wave definitions.
Expected effect: perceptible escalation across waves without new enemy types.
Risk: low — requires the one-line pass-through change in §5.7 first.

**Experiment E — Fix the hidden AI fire-rate constant (small change)**
Hypothesis: exposing `fireRateModifier` as `item.aiFireRatePenalty` (default 0) lets you tune enemy cadence directly instead of fighting an invisible `+2s`.
Variables: `ItemSystem.fireWeapon`, `itemData[item].aiFireRatePenalty`.
Expected effect: enemy aggression becomes directly readable/tunable from `itemData.js`.
Risk: low — one call site, default preserves current numeric behavior if set to 2.

**Experiment F — Preferred-distance variation (small change)**
Hypothesis: a per-instance `preferredDistance = attackRadius × (0.6–1.0)` randomized at spawn reduces clustering and makes encounters read as less mechanical, with zero new perception.
Variables: `AIComponent` constructor, `applyCombatMovement`'s radial term.
Expected effect: enemies naturally spread into a loose band instead of one exact ring.
Risk: low — additive field, degrades gracefully if unset.

**Experiment G — Minimal NPC separation nudge (small change)**
Hypothesis: a small O(n²) repulsion pass inside `AISystem` (bounded by wave size) stops enemies from fully stacking, without collision-mask or `CollisionSystem`/`MovementSystem` changes.
Variables: new private method in `AISystem`, reading `this.aiList`/`this.movementList`.
Expected effect: visually distinct enemy positions even when several converge on the same target.
Risk: low-medium — needs a sanity check on enemy-count scaling (fine for wave-sized counts; would need spatial partitioning if enemy counts ever grow large).

**Experiment H — Attack wind-up via existing timers (small change)**
Hypothesis: gating `applyAttack` behind a short per-entity timer that starts when `ai.state` becomes `"attack"` gives the player a reactable telegraph, reusing the same timer pattern `decisionTimer` already establishes.
Variables: new `attackWindUp` field (default 0) somewhere `applyAttack` can read it; a runtime timer alongside it.
Expected effect: `approach → telegraph → shot → cooldown` loop becomes possible, enabling meaningful risk/reward decisions for the player.
Risk: medium — first change that touches the actual attack-decision timing rather than pure data/positioning; wants a UI/animation tell to pay off, though a bare timer alone still creates the reactable gap.

**Experiment I — Flinch/stagger movement-lock split (small change)**
Hypothesis: letting `flinch` keep movement (blocking only the attack) makes small hits read as pressure/feedback rather than a second stun, matching "temporary advantage" framing.
Variables: `AISystem.update`'s reaction-state branch (`AISystem.js:151-168`).
Expected effect: hit reactions feel graduated (flinch = keep moving but can't shoot; stagger = fully open).
Risk: medium — changes existing feel for every current encounter; worth an isolated playtest before committing.

**Experiment J — (future, out of scope now) Real NPC-NPC collision resolution + coordinated positioning**
Only after A–I are validated: give `CollisionSystem`/`MovementSystem` genuine entity-vs-entity resolution (not just events) and/or let AI reason about ally positions for flanking. This is the first item that's a true architectural change — deliberately last, and not recommended before the low-risk experiments above are tried.
