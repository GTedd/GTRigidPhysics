---
i18n_source_sha: 1a73825e0924
---

# Contributing

## Code style

### Java conventions

- **Encoding**: UTF-8 end to end. Every source and resource file is UTF-8
- **Indentation**: 4 spaces, no tabs
- **Naming**:
  - Classes: `PascalCase`, e.g. `RigidCollapseExecutor`
  - Methods and fields: `camelCase`, e.g. `spawnQuotaPerFrame()`
  - Constants: `UPPER_SNAKE_CASE`, e.g. `MAX_PENDING`
  - Packages: all lowercase, e.g. `cn.gtedd.rigidphysics.paper.collapse`
- **Javadoc**: every public API needs complete Javadoc including `@param`, `@return` and `@throws`
- **Zero deprecation warnings**: the build runs with `-Xlint:deprecation` and no deprecation warning is acceptable

### Comment requirements

- Significant architectural decisions must be commented with **why**, not what
- Traps must be called out (thread-safety constraints, required call ordering)
- Code derived from an open source project must name the source project and where it came from
- When referencing external code, check license compatibility (see "Licensing rules" below)

### Review checklist

Before opening a PR:

- [ ] Is the new logic covered by unit tests?
- [ ] Any deprecation warnings?
- [ ] If you added a command, did you add the translation keys to **both** `zh_CN.yml` and `en_US.yml`? (test with `/gtrp admin locale`)
- [ ] Is there Javadoc?
- [ ] Are the module constraints satisfied?
- [ ] If user-facing behaviour changed, did the matching page under `docs/` change too?
- [ ] If you edited a Java file that has an English translation, does `bun run javadoc:check` still pass? (see below)

### The two separate "translation" systems

There are two independent multilingual systems in this project. Don't confuse them:

| | Plugin runtime messages | Docs and Javadoc |
|---|---|---|
| Where | `paper/src/main/resources/lang/*.yml` | `docs/*.en.md`, `i18n/javadoc/en/` |
| Read by | Players on the server | Readers of the docs site and API reference |
| Adding a language | Add one `xx_XX.yml` | See [Translating the Docs](translating.md) |

When changing code you only need to worry about the first. Docs and Javadoc translations
are community-maintained — but one rule will stop you:

**If the Java file you edited already has an English translation** (a file at the same
path under `i18n/javadoc/en/`), `bun run javadoc:check` will fail — the translation is a
byte-for-byte copy of the original apart from comments, so any code change breaks the
match. Either port your code change into the translation as well (code only; leave the
comments in English), or say so in the PR and let a maintainer sync it. CI tells you
exactly which file is affected.

## Module constraints

### The four modules

```
api/          the public contract: interfaces, events, value objects. No native, no packetevents
common/       pure logic, zero external dependencies
   └── physics/    the self-written XPBD engine, depends only on common
          └── paper/    the Paper 26.2 platform layer, depends on api + common + physics
```

### Hard constraints

| Rule | Why |
|------|------|
| **`common` must not `import org.bukkit.*`** | Pure logic module, independently unit-testable |
| **`common` must not import any physics implementation class** | Physics logic belongs in `physics`; `common` is isolated simply by not declaring the dependency |
| **`physics` must not `import org.bukkit.*`** | Simulation never touches the server API |
| **`physics` must not `import com.github.retrooper.packetevents.*`** | Packet logic belongs in `paper` |
| **Async threads must not touch Bukkit objects** | Async code only handles flattened `int[]` / `float[]` snapshots |
| **Engine objects must never be passed across threads raw** | The physics thread emits an immutable `PoseSnapshot` (primitive arrays); the main thread consumes it. `paper` has zero `physics.engine` imports, and `:paper:checkEngineIsolation` verifies this after every `compileJava` |

### Why the constraints exist

These are not dogma; each has a concrete reason:

- `common` has zero dependencies, meaning everything in it can be verified in unit tests without starting a Paper server
- `physics` has zero Bukkit, meaning its performance benchmarks run in a bare JVM, undisturbed by server load
- Thread discipline: touching the Bukkit API from an async thread produces `ConcurrentModificationException` or, worse, quiet data corruption

When adding a file under `paper/src/main/java/cn/gtedd/rigidphysics/paper/`, ask yourself:
"could this logic live in `common`?" If it could, move it there and write unit tests.

## Testing

### Framework

JUnit 5 (`org.junit.jupiter.api`), run through Gradle.

### Test categories

| Module | Kinds of test | Current count |
|------|----------|----------|
| `common` | Structural analysis specs, performance, budget management, material lookup, settle planning, shader protocol | 40 |
| `physics` | XPBD solver, object world, friction calibration, gravity scale, terrain alignment | 9 test classes |

### Principles

- **Behavioural specs** over implementation details: test "given this input, this output", not "this method was called"
- **Boundary conditions**: empty input, maximum, minimum and null must all be covered
- **Performance regressions**: hot paths need a benchmark (worst-case structural analysis, solver step time)
- Name tests as `method_scenario_expectation`

### Running tests

```bash
# everything
./gradlew test

# only the common module
./gradlew :common:test

# only the physics module
./gradlew :physics:test
```

HTML reports:
- `common/build/reports/tests/test/index.html`
- `physics/build/reports/tests/test/index.html`

## Licensing rules

### This project's license

| Part | License |
|------|------|
| The `api` / `common` / `physics` modules | **MIT** — closed-source plugins may depend on them |
| The plugin itself (`GTRigidPhysics-*.jar`) | **GPL-3.0** |

The split is deliberate: downstream plugins only need `api` to compile, and should not be
infected by the GPL. packetevents is a required dependency plugin and is not shaded in, so
`api` is not bound by its license either.

Third-party dependencies are all compatibly licensed:

| Dependency | License |
|------|------|
| packetevents | MIT |

### Rules for referencing external code

1. **MIT-licensed code**: may be used directly; credit the source
2. **LGPL-3.0 code**: read for architectural ideas only, never copy code (this project does not dynamically link such code)
3. **GPL-3.0 code**: never copy code; public algorithmic ideas only
4. **PolyForm Shield** (noncompete clause): entirely off-limits

The list of reference projects is in DESIGN.md section 7.

### Attribution format

How to credit a source in a comment:

```java
/**
 * The interior face culling approach comes from Velthoric's TerrainVoxelShape (LGPL-3.0).
 * Independently implemented here — the algorithmic idea only, no code was copied.
 */
```

## Pull request process

### Branching

- `main`: the stable branch — always buildable, always green
- Feature branches: cut from `main`, named `feature/<description>` or `fix/<description>`

### Commit messages

Conventional Commits style:

```
feat(paper): 新增 TNT 法杖齐射功能
fix(physics): 修正浮力计算中浸没深度的错误
docs: 补充命令参考文档
docs(i18n/en): translate quick start and command reference
test(common): 添加邻接模式规格测试
```

Translation-only changes use the `docs` prefix with the language in parentheses; see
[Translating the Docs](translating.md).

### Before opening a PR

1. All tests pass: `./gradlew test`
2. Zero deprecation warnings: check the build output
3. Every module builds: `./gradlew build`
4. If you added a command, check that `zh_CN.yml` and `en_US.yml` have the same key count
5. Verify the feature on a local test server, if you have one

### What reviewers look at

Reviewers pay particular attention to:

- Module constraints (`common` must not pull in Bukkit)
- Thread safety
- Memory leak risk, especially releasing native resources
- Whether budget management pairs every acquire with a release
- Whether language keys are present and consistent on both sides

## Development environment

### Recommended IDE

IntelliJ IDEA (Community or Ultimate), with:
- the Gradle plugin
- the Minecraft Development plugin (optional; handy for editing paper-plugin.yml)

### Importing the project

```bash
git clone <repository url>
cd GTRigidPhysics
# IDEA: File > Open > select the project root > import as a Gradle project
```

### Notes on the build configuration

- The Gradle wrapper uses an Aliyun mirror (`gradle/wrapper/gradle-wrapper.properties`)
- `gradle.properties` sets `org.gradle.jvmargs`, `org.gradle.parallel` and friends
- **Do not** add `-Dfile.encoding=UTF-8` to `org.gradle.jvmargs` — in a project whose path contains non-ASCII characters it breaks classpath resolution

## Adding a command

1. Create a node class under `paper/src/main/java/cn/gtedd/rigidphysics/paper/command/node/` implementing `CommandNode` (extend `BaseNode`)
2. Attach the node to the right `CommandGroup` in the `CommandRegistry` constructor
3. Add a permission declaration to `paper-plugin.yml`
4. Add the matching `description` and `usage` keys to `zh_CN.yml` and `en_US.yml`
5. `CommandRegistry.findMissingKeys()` validates this at startup — anything missing is logged as a WARN
6. Build, run, and test the command and its tab completion yourself
