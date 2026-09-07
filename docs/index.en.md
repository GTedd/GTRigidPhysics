---
i18n_source_sha: f433db229bd2
---

# GTRigidPhysics

A rigid body physics engine for Minecraft **Paper 26.2**. Buildings actually fall down,
dice actually roll, vehicles actually flip.

**Server-side only — players need no mod. The physics engine is a self-written pure-Java
implementation; the jar contains zero native binaries.**

---

## Who are you?

<div class="grid cards" markdown>

-   :material-server: **I run a server and want to install it**

    ---

    From download to your first collapse: about five minutes.

    [:octicons-arrow-right-24: Quick Start](guide/quick-start.md)

-   :material-tune: **It's installed; I want to tune it**

    ---

    14 config files, all hot-reloadable. Indexed by intent, so you don't have to hunt.

    [:octicons-arrow-right-24: Configuration Overview](guide/config/index.md)

-   :material-puzzle: **I want the admin panel and the wands**

    ---

    The engine doesn't bundle them — install add-ons. Panel, toolbelt, vehicle system.

    [:octicons-arrow-right-24: What is an add-on](addons/index.md)

-   :material-code-braces: **I write plugins and want to call it**

    ---

    One Gradle dependency: spawn rigid bodies, intercept collapses, query materials.

    [:octicons-arrow-right-24: Using the API](api/index.md)

-   :material-book-open-variant: **I want to know how it works**

    ---

    XPBD solver, box + point-cloud collision, ghost collisions cured at the root,
    full inertia tensors.

    [:octicons-arrow-right-24: Engine Internals](engine/index.md)

-   :material-source-pull: **I want to send a PR**

    ---

    Building, workflow, contribution guide, version migration.

    [:octicons-arrow-right-24: Contributing](dev/build.md)

</div>

---

## What it does

=== "Structural collapse"

    Break a load-bearing block and everything that loses support comes down as a whole,
    according to **structural integrity analysis**. Debris falls, tumbles and slides along the
    terrain as real rigid bodies, then — depending on the rules — restores blocks, drops items,
    or vanishes.

    This is not `FallingBlock`: debris **rotates**, collides with itself, and rolls down slopes.

    There is a third failure mode too: **still connected, but no longer able to carry the load**.
    Load-bearing analysis computes each block's load and capacity, so severing one column can
    trigger a progressive collapse. Buildings groan before they go, giving players a window to run.

    [:octicons-arrow-right-24: Structural Collapse](features/collapse.md)

=== "Real hitboxes"

    Debris isn't just decoration — it **blocks you, you can stand on it, and you can hit it**.

    A passenger stack cannot provide hitboxes, so the engine sends one invisible entity per block
    near each player. It only activates within reach, and the bandwidth accounting is careful.

    [:octicons-arrow-right-24: Real Hitboxes & Interaction](features/block-collision.md)

=== "Physics materials"

    Ice is slippery, slime bounces, wool is light — covering **all 1113 breakable blocks**,
    with a test guarding that coverage.

    Friction really decides **how steep a rubble pile can get**; "wool floats, iron slams" falls
    out of quadratic air drag — it emerges from the physics rather than being configured.

    [:octicons-arrow-right-24: Physics Materials](features/materials.md)

=== "Vehicles, mechanisms, characters"

    Wheeled vehicles use **raycast suspension plus tyre forces** — squat under acceleration,
    dive under braking and body roll in corners are all emergent, with zero special cases.
    Windmills and pistons are motorised constraints. There are also virtual characters blocked by
    terrain and bodies, plus ragdolls that fall over naturally under gravity.

    The full vehicle gameplay (garage, blueprint building, planes / helicopters / boats)
    lives in an add-on.

    [:octicons-arrow-right-24: Vehicle templates](features/objects/vehicle.md) ·
    [:octicons-arrow-right-24: Vehicle add-on](addons/vehicle.md)

=== "Camera roll"

    Explosions and collapses roll nearby players' screens sharply, then oscillate back to level.

    This is the **only** feature with a client-side requirement: it needs a resource pack
    (the plugin can push it automatically). When the shader isn't available it degrades to
    vanilla hurt-tilt.

    [:octicons-arrow-right-24: Camera Roll](features/camera-roll.md)

---

## Requirements

| Item | Requirement |
|---|---|
| Server | Paper **26.2+** |
| Java | **25** |
| Required plugin | packetevents **2.13.0+** (hard dependency, not shaded) |
| Architecture | **No restriction** |
| JVM flags | **None needed** |
| Client | None (camera roll needs a resource pack; it can be turned off) |

!!! success "The architecture restriction is gone"
    Early versions used jolt-jni, so physics ran on native binaries and only three platforms
    were supported.

    Since 2026-08-20 the engine is a **self-written pure-Java XPBD solver**. The jar has zero
    native code — macOS and Windows-ARM now work too, and `--enable-native-access` is no longer needed.

    [:octicons-arrow-right-24: Why write our own engine](engine/index.md)

---

## Two sets of docs

This site and the API reference have distinct jobs — don't look in the wrong one:

<div class="grid cards" markdown>

-   **This site** — for server owners and players

    How to install, configure and use it; how each system works; which knobs to turn.

-   **[Javadoc](https://gtedd.github.io/GTRigidPhysics/javadoc/)** — for plugin developers

    Exact signatures and contracts for every interface, method, parameter and event.

</div>

---

## For developers: one dependency line

```kotlin
repositories {
    maven("https://gtedd.github.io/GTRigidPhysics/")
}

dependencies {
    compileOnly("cn.gtedd:gtrigidphysics-api:1.0.0")
}
```

!!! tip "Use `compileOnly`, not `implementation`"
    The API is provided at runtime by the GTRigidPhysics plugin on the server. Shading it into
    your own jar only causes class conflicts — usually surfacing as a baffling `LinkageError`.

`gtrigidphysics-api` is only a few dozen KB, contains **no physics implementation and no
packetevents**, and is licensed **MIT** — closed-source plugins may depend on it freely.

[:octicons-arrow-right-24: Full integration guide](api/index.md)

---

## Licence

| Part | Licence |
|---|---|
| `api` / `common` / `physics` modules (the three published Maven artifacts) | **MIT** |
| The plugin itself (`GTRigidPhysics-*.jar`) | **GPL-3.0** |

The plugin is **GPL-3.0** by the author's choice (use it, credit it, keep derivatives open);
the API module is separately **MIT** so closed-source plugins can depend on it.
packetevents is a **required external plugin**, not shaded.

---

## Help translate

This site is written in Simplified Chinese; other languages are community translations.
Pages without a translation fall back to the Chinese source and carry a link straight to the
GitHub editor at the top — spot a missing page, click once, and you're editing.

[:octicons-arrow-right-24: Translating the docs](dev/translating.md)
