---
i18n_source_sha: c79bbd817374
---

# Quick Start

From download to your first collapse: about five minutes.

---

## Requirements

| | Requirement |
|---|---|
| Server | **Paper 26.2** or newer (uses 26.2 protocol features; older versions are not supported) |
| Java | **25** (the plugin is built to Java 25 bytecode) |
| Required plugin | **[packetevents](https://modrinth.com/plugin/packetevents) 2.13.0+** — mandatory, not shaded |
| Client | **Nothing.** Server-side only; players need no mod |

!!! success "No `--enable-native-access` needed"
    The engine is **pure Java** — the jar contains zero native binaries.
    macOS and Windows-ARM run fine now.

    If you read elsewhere that this JVM flag is required, that refers to the old
    jolt-jni-based version.

---

## Install

1. Put **packetevents** in `plugins/` first (it loads before this plugin)
2. Put `GTRigidPhysics-1.0.0.jar` in `plugins/`
3. Start the server

!!! warning "packetevents is a hard dependency"
    Without it the plugin **refuses to load** and says so clearly, rather than starting
    half-initialised and throwing NPEs afterwards.

---

## Verify the install

These lines should appear in the console:

```
[GTRigidPhysics] 物理引擎已就绪（纯 Java XPBD，无需 native）。
[GTRigidPhysics] 物理物体服务已就绪（骰子/载具/机关/角色/布娃娃/冲量交互）。
[GTRigidPhysics] 对外 API 已注册：契约版本 ...
[GTRigidPhysics] 结构坍塌判定已启用（刚体 + packet 虚拟实体）。
[GTRigidPhysics] 物理材质：N 条方块规则、M 条后缀组规则。
[GTRigidPhysics] 落地规则：默认 RESTORE，...
[GTRigidPhysics] 重力已按 physics.yml 设为 -9.81 m/s²。
[GTRigidPhysics] 全部功能系统已启用（systems.yml）。
```

!!! note "Console messages follow `config.yml`'s `language`"
    Set `language: en_US` to get them in English.

If a line is missing, the corresponding subsystem failed to load and the actual error is
just above it in the console.

Then confirm with one command:

```
/gtrp status
```

---

## See your first collapse

**No command needed.** Collapse is automatic:

1. Build a two- or three-storey house, or a column at least 6 blocks tall holding up a platform
2. Break the load-bearing part
3. Everything that loses support comes down as a whole — debris rotates, collides and rolls
   along the terrain

!!! tip "Nothing happened?"
    The most common reason is that the building is **still connected to some other support**.

    Try the simplest possible case first: one column holding a 3×3 platform, then break the
    middle block of the column.

    Still nothing? See [Troubleshooting](troubleshooting.md).

### Tune the feel

```yaml
# structure.yml — the master knob for collapse feel
strength-scale: 0.5     # collapses at a touch, very dramatic
strength-scale: 1.0     # default
strength-scale: 2.0     # conservative; you must destroy a lot of structure
```

Then `/gtrp admin reload` — no restart required.

---

## What commands ship with the engine

Only five groups, all operational:

| Command | What it does |
|---|---|
| `/gtrp status` | Runtime state and budget usage |
| `/gtrp sim` | Time scale, gravity (runtime override, not persisted) |
| `/gtrp material` | Query materials, audit coverage |
| `/gtrp structure` | Load-bearing diagnostics, zone annotation |
| `/gtrp admin` | Hot reload, switch language |

!!! info "Spawning dice, wands and the admin panel are not in the engine"
    They are separate **add-ons**:
    [Admin Panel](../addons/panel.md) · [Toolbelt](../addons/toolbelt.md) · [Vehicles](../addons/vehicle.md)

    The engine works fine with no add-ons installed — physicalisation, collapse, explosions and
    impact consequences are all available; you just lack the interaction tools.
    See [What is an add-on](../addons/index.md) for why it is split this way.

`/gtrp` with no arguments lists the commands **you have permission for**; entries you cannot
use do not appear.

---

## Permissions

By default only operators hold `gtrigidphysics.admin`. Three granularities:

```bash
# Everything (admins)
/lp user <player> permission set gtrigidphysics.admin true

# Read-only diagnostics (ops) — changes nothing
/lp user <player> permission set gtrigidphysics.category.diagnostic true

# A single command
/lp user <player> permission set gtrigidphysics.command.status true
```

---

## Resource pack (optional)

Only [camera roll](../features/camera-roll.md) (explosion shake, collapse sway) needs it.

The build produces `build/distributions/GTRigidPhysics-RP-<version>.zip` and its SHA-1
automatically; put the direct link in [`resource-pack.yml`](config/resource-pack.md) to push it.

It works without one — players just install it themselves, or you rely on the
[fallback](config/camera-roll.md).

---

## Next

<div class="grid cards" markdown>

-   [:octicons-arrow-right-24: **Command Reference**](commands.md)

    Full arguments and permissions for the five groups

-   [:octicons-arrow-right-24: **Configuration Overview**](config/index.md)

    14 config files, indexed by intent

-   [:octicons-arrow-right-24: **Performance & Budget**](performance.md)

    How to configure a 100-player server

-   [:octicons-arrow-right-24: **Add-ons**](../addons/index.md)

    Panel, wands, vehicles

-   [:octicons-arrow-right-24: **Features**](../features/collapse.md)

    How collapse, explosions, materials and hitboxes work

-   [:octicons-arrow-right-24: **Using the API**](../api/index.md)

    Call it from your own plugin

</div>
