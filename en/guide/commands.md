---
i18n_source_sha: 9cbc6ab6611e
---

# Command Reference

The engine has only **five command groups**, all operational.

!!! info "Spawning, wands and the panel are not in the engine"
    After the engine was slimmed down, `spawn` / `impulse` / `mechanism` / `terrain` /
    `character` / `ragdoll` / `vehicle` / `test` / `shader` / `wand` / `panel` all moved to
    separate add-ons.

    See [What is an add-on](../addons/index.md), or go straight to
    [Admin Panel](../addons/panel.md) / [Toolbelt](../addons/toolbelt.md) / [Vehicles](../addons/vehicle.md).

Root command `/gtrigidphysics`, alias `/gtrp` (used throughout below).

---

## Command tree

```
/gtrp
├─ status                        Runtime state and budget usage
├─ sim                           Simulation parameters
│  ├─ timescale <factor>          Time scale (slow / fast motion)
│  ├─ gravity <value>             Gravitational acceleration
│  └─ reset                       Restore defaults
├─ material                      Physics materials
│  ├─ info <block>                Query a block's physics material
│  ├─ audit [export]              Audit coverage; find blocks on defaults
│  ├─ apply <block> [player]      Apply the material to an entity
│  └─ reset [player]              Restore entity attributes
├─ structure                     Load-bearing structure
│  ├─ info                        Load / capacity / member type of the targeted block
│  ├─ scan [count]                Scan nearby and list the most stressed points
│  └─ zone                        Zone annotation
│     ├─ list                     List all zones
│     ├─ add <name> <mode> [r]    Add a zone
│     └─ remove <name>            Delete a zone
└─ admin                         The plugin itself
   ├─ reload                      Hot-reload every config file
   └─ locale <language>           Switch interface language
```

---

## `status` — runtime state

```
/gtrp status
```

Everything on one screen. Most useful run before and after a config change:

| Row | Meaning |
|---|---|
| Concurrent collapses | Current / limit, with percentage |
| Virtual entities | Current / limit, with percentage |
| Active bodies | Count @ physics rate (40 Hz) |
| Time scale / gravity | Currently effective values |
| Collapses being rendered | Number of collapses currently broadcasting |
| Settle queue | Blocks waiting to be written back |
| Adjacency mode | `FACE_ONLY` / `FACE_AND_EDGE` / `FULL_26` and neighbour count |
| View calibration | Origin shift and passenger Y offset |
| Hitboxes | Mode / radius / live clients / registered / ID headroom |
| Structural analysis | Running / limit, deferred re-runs, expansion count and radius cap |
| Language | Active locale and entry count |

---

## `sim` — simulation parameters

**Runtime overrides; not persisted.** A restart or `/gtrp admin reload` returns to the config file values.

| Command | Argument | Notes |
|---|---|---|
| `/gtrp sim timescale <factor>` | Clamped to [0.05, 4.0] | `0.2` is one-fifth speed. For staging and debugging |
| `/gtrp sim gravity <value>` | m/s², negative is downward | Earth `-9.81` (**default**), Moon `-1.62`, vanilla falling sand `-16` |
| `/gtrp sim reset` | none | Restores both to defaults |

!!! danger "Changing gravity rescales the whole velocity domain"
    `materials.yml`'s `fracture-speed` and `impact.yml`'s `min-break-speed` are both expressed as
    "the landing speed after falling N blocks", and the `g` in `v = √(2gh)` is exactly this value.

    Change gravity to `-16` without adjusting those two and everything shatters on the slightest
    drop — the same fall now yields 1.28× the landing speed, so both must be multiplied by 1.28.

    See [`physics.yml`](config/physics.md).

---

## `material` — physics materials

| Command | Argument | Notes |
|---|---|---|
| `/gtrp material info <block>` | Material name, tab-completed | Density / friction / bounciness / air drag, plus the values after conversion to solver units |
| `/gtrp material audit [export]` | optional `export` | Coverage audit: how many blocks hit exact rules, suffix groups, or defaults |
| `/gtrp material apply <block> [player]` | block + optional target | Writes the three vanilla attributes onto an entity |
| `/gtrp material reset [player]` | optional target | Restores entity attributes |

### `audit` is worth running regularly

It exists because of a real incident: an audit on 2026-08-22 found **284 blocks (25.5%) silently
sitting on default values** — including cobblestone, sandstone, bricks, granite and terracotta,
the most common building materials there are.

The config file looked completely filled in. Nothing looked wrong.

`MaterialCoverageTest` now guards this at build time, but running `audit` after editing
`materials.yml` is still a good habit.

---

## `structure` — load-bearing structure

Diagnostics are read-only; zone annotation changes collapse behaviour.

| Command | Argument | Notes |
|---|---|---|
| `/gtrp structure info` | none, aim at a block | Load, capacity and member type (column / beam / wall / slab / fill) |
| `/gtrp structure scan [count]` | optional | Scans nearby and lists the **most stressed** points |
| `/gtrp structure zone list` | none | List all zone annotations |
| `/gtrp structure zone add <name> <mode> [radius]` | modes below | Add a zone centred on you |
| `/gtrp structure zone remove <name>` | name | Delete |

### Four zone modes

| Mode | Effect |
|---|---|
| `NORMAL` | Default behaviour |
| `LOAD_BEARING` | Strict load-bearing evaluation |
| `IMMUNE` | Never collapses inside the zone |
| `FRAGILE` | Collapses more easily |

!!! tip "Load is measured in 'block self-weight equivalents'"
    Not newtons. A block with `density = 1.0` contributes 1.0 of load, so
    `compressive-strength: 120` reads directly as "can carry 120 baseline blocks on its head".

    See [`structure.yml`](config/structure.md).

---

## `admin` — the plugin itself

| Command | Argument | Notes |
|---|---|---|
| `/gtrp admin reload` | none | Hot-reloads **all** 14 config files without restarting |
| `/gtrp admin locale <language>` | `zh_CN` / `en_US` / any file under `lang/` | Switch interface language |

`reload` fires `RigidPhysicsReloadEvent`, which add-ons can listen to in order to refresh their caches.

Objects already on players' screens **converge naturally** to the new limits — those beyond the
visibility cap are destroyed farthest-first, and newly in-range ones are spawned within quota.
Nothing lingers and nothing flickers.

---

## Permissions

Three layers, coarse to fine:

```
gtrigidphysics.admin                  (default: op)
├─ gtrigidphysics.category.diagnostic   read-only diagnostics
├─ gtrigidphysics.category.admin        management operations
├─ gtrigidphysics.category.material     modifies entity attributes
└─ gtrigidphysics.category.testing      modifies the world
```

Every command also has its own node, `gtrigidphysics.command.<dotted.path>` — for example
`gtrigidphysics.command.sim.timescale` or `gtrigidphysics.command.structure.zone.add`.

Evaluation order: `gtrigidphysics.admin` → category node → individual node; any match grants access.

!!! tip "One `category.diagnostic` is enough for ops"
    Read-only diagnostics change nothing. Add `category.admin` if they also need the time scale.

!!! warning "`paper-plugin.yml` still declares some obsolete permissions"
    `gtrigidphysics.command.panel`, `command.shader.*`, and the `category.testing` children
    `command.spawn` / `command.test.*` / `command.wand.*` are still declared, but the
    corresponding commands **no longer exist in the engine**.

    They cause no failure (an unchecked permission node is inert), but they will make permission
    plugins suggest commands that aren't there.

---

## The help menu lists only what you can use

`/gtrp` with no arguments groups by category and **only includes nodes the sender may use**.

Listing a pile of commands that answer "no permission" is pure noise for an administrator.

---

## Related

- [Quick Start](quick-start.md)
- [Configuration Overview](config/index.md)
- [Performance & Budget](performance.md) — how to read those `status` numbers
- [Add-on commands](../addons/index.md) — spawning, wands and the panel live there
