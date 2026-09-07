---
i18n_source_sha: 21742a8d4cf2
---

# Translating the Docs

This project is written in **Simplified Chinese**; every other language is a translation
of it. This page covers how to take part — from fixing one word to claiming a whole page.

!!! tip "Just want to fix a typo?"

    Every page has a pencil (:material-pencil:) in the top right. Click it to edit
    directly on GitHub — no clone, nothing to install. Open a PR and you're done.

---

## Two things to translate, with different rules

| | Documentation site (here) | Javadoc |
|---|---|---|
| Audience | Server owners and players | Plugin developers |
| Source | `docs/**/*.md` | Doc comments in the four modules' `*.java` |
| Translation lives in | Beside the original, with a language suffix: `quick-start.en.md` | An overlay directory: `i18n/javadoc/en/<package path>.java` |
| When missing | Falls back to Chinese; the page still exists | That class keeps its Chinese comments; everything else is unaffected |
| Enforced check | None (staleness is only reported) | **Yes** — the code must be byte-identical to the original |

The difference comes from the consequences. A stale page here is merely out-of-date prose.
A Javadoc translation **replaces the source file** during generation, so falling behind the
original means the English API reference is **missing a method** — a contract document that
looks complete but isn't, which is worse than having none.

---

## Setting up

!!! tip "Don't want to set anything up? Just grab the sources"

    **Export Markdown**, in the top right of every page, gives you that page's `.md`
    or a zip of the whole site. The zip mirrors the `docs/` directory, so once
    you've translated a file you can open a PR against the matching path. The local
    setup below is for people who want to preview the result or run the coverage
    report. See [Exporting Markdown](export.md).

You need [bun](https://bun.sh) and [uv](https://docs.astral.sh/uv/).
**No npm, and no `bun install`** — the scripts in this repository have zero dependencies.

```bash
git clone https://github.com/GTedd/GTRigidPhysics
cd GTRigidPhysics

bun run docs          # local preview → http://127.0.0.1:8000
```

The first `bun run docs` lets uv install MkDocs per `requirements-docs.txt`; after that it
is cached and starts instantly. Chinese is served at `/`, English at `/en/`, with a
language switcher in the header.

??? note "No bun or uv?"

    bun is only giving the commands memorable names; underneath it is plain mkdocs:

    ```bash
    pip install -r requirements-docs.txt
    mkdocs serve                 # same as bun run docs
    mkdocs build --strict        # same as bun run docs:build
    ```

    The i18n reporting scripts do need bun (they are TypeScript), but they are only
    reports — you can translate and open a PR without ever running them.

---

## Translating the documentation site

### See what is missing

```bash
bun run i18n:status
```

```
zh → en  ████████░░░░░░░░░░░░░░░░  13/39 pages current (33%)

  ⟳ Original changed, translation pending (2)
      guide/commands.md  a1b2c3d4e5f6 → 9f8e7d6c5b4a
      When done: bun run i18n:bless en guide/commands.md

  · No translation yet (24) — the site falls back to Chinese, never 404s
      systems/budget.md
      ...
```

### Start a new page

```bash
bun run i18n:new en guide/quick-start.md
```

That creates `docs/guide/quick-start.en.md` containing a **complete copy of the Chinese
original**, plus a bit of front matter. Replace the Chinese paragraph by paragraph.

!!! question "Why a copy of the original instead of a blank template?"

    Replacing paragraph by paragraph makes it much harder to drop a section than
    rewriting from an empty file, and it preserves heading levels, code blocks, links and
    admonitions. Once that structure drifts, the two languages stop lining up for good.

The generated front matter looks like this. **Do not edit it by hand:**

```yaml
---
i18n_source_sha: a1b2c3d4e5f6
---
```

That line records *which revision of the original this was translated from*. Once the
original changes the fingerprint stops matching, `i18n:status` flags the page as pending,
and the site shows readers a notice.

### Bring a stale page up to date

Once the original has changed:

1. See what changed — the "What changed in the original" link on the page goes straight to
   the GitHub commit history
2. Port those changes into the translation
3. Re-stamp the fingerprint:

```bash
bun run i18n:bless en guide/commands.md
```

!!! warning "bless only stamps — it does not verify"

    It does not check that you actually synced the content; it just updates the
    fingerprint to the current original. Blessing a page you haven't finished is telling
    readers it is current when it isn't.

### Before you submit

```bash
bun run i18n:check     # structural problems: orphan translations, missing fingerprints
bun run docs:build     # strict build; broken links fail
```

---

## Translating the Javadoc

### How it works

Javadoc has no built-in i18n. Its `-locale` option only switches **chrome** like "Method
Summary"; it cannot touch the doc comments. So comment translation goes through a
**source overlay**:

```
api/src/main/java/cn/gtedd/rigidphysics/api/RigidPhysicsAPI.java   original (Chinese comments)
i18n/javadoc/en/cn/gtedd/rigidphysics/api/RigidPhysicsAPI.java     translation (English comments)
```

When the English Javadoc is generated, any file present in the overlay is used instead of
the original; everything else falls back to the original. Overlay files are **never
compiled and never end up in any jar** — only javadoc reads them.

### Start one

```bash
bun run javadoc:status                    # what's missing, prioritised by public API surface
bun run i18n:new-javadoc en cn/gtedd/rigidphysics/api/object/PhysicsBody.java
```

### The one hard rule: translate comments, don't touch code

Package, imports, modifiers, signatures, generics, annotations, field initialisers, method
bodies — not one byte. Rewrite only what is inside `/** */`, `//` and `/* */`.

This is enforced, not merely requested:

```bash
bun run javadoc:check
```

It strips every comment from both files and compares what is left, byte for byte. Any
difference fails, which catches both "the translator edited code" and "the original
changed and this translation is stale". CI runs it on every PR.

When it fails it prints the context around the first difference. What to do depends on
which case it is:

- The translation edited code → change it back
- The original changed → re-copy the current original and port your translated comments over

### Conventions

- Keep `@param` / `@return` / `@throws` tags, their order, and their parameter names
- `{@link}` and `{@code}` targets are **code references, not prose** — leave them alone
- Keep the `<h2>` / `<pre>` / `<table>` structure so both languages read the same shape
- Translate the *intent*, not the words. These comments explain "why" far more than
  "what", and a literal rendering usually loses exactly the point

### Preview

```bash
bun run javadoc:build
```

The output lands in `build/docs/javadoc/`: a `zh/` and an `en/` tree plus a landing page
that routes by browser language. Open `build/docs/javadoc/en/index.html` directly in a
browser to read it.

---

## Glossary

Consistency matters more than elegance. If one concept is rendered two different ways on
two pages, readers assume they are two different things.

| 中文 | English | Notes |
|---|---|---|
| 刚体 | rigid body | not "physics object" |
| 结构完整性分析 | structural integrity analysis | |
| 坍塌 | collapse | same word as noun and verb |
| 碎块 / 碎屑 | debris | uncountable |
| 簇 | cluster | a connected component split out by a collapse |
| 落地规则 | settle rules | not "landing rules" |
| 预算管理 | budget management | the quota on rigid body count |
| 物理材质 | physics material | not "texture" |
| 视角滚转 | camera roll | not "view rotation" |
| 机关 | mechanism | constraint-driven objects such as windmills and pistons |
| 布娃娃 | ragdoll | |
| 载具 | vehicle | |
| 虚拟角色 | virtual character | |
| 高度场 | height field | |
| 服主 | server owner | not "server admin" |
| 前置插件 | dependency plugin | |
| 物理帧 | physics frame | |
| 发包 | packet dispatch | |

**Never translate** these proper nouns: Minecraft, Paper, Folia, Bukkit, Spigot, XPBD,
packetevents, Gradle — nor any configuration key (`camera-roll.yml`,
`settle-mode` and the like) or code identifier.

---

## Adding a new language

A language must be registered in **four places**. Miss one and the failure is silent:

| File | What to add | If you forget |
|---|---|---|
| `mkdocs.yml` → `plugins.i18n.languages` | locale, name, `nav_translations` | the site never builds that language |
| `tools/i18n/shared.ts` → `TARGET_LOCALES` | the locale code | the reporting scripts can't see it |
| `build.gradle.kts` → `javadocLocales` | locale, Java Locale name, titles | Javadoc has no such language |
| `i18n/javadoc/index.html` → `LANGS` | the locale code | the landing page redirects to a 404 |

You also need two more files: `i18n/javadoc/overview-<locale>.html` (translate it from
`overview-zh.html`) and the directory `i18n/javadoc/<locale>/` — the directory must exist
even if it only holds a README, otherwise Gradle fails on a path that isn't there.

Finally add a set of banner strings to `STRINGS` in
`overrides/partials/i18n-notice.html`. It works without them — the banner falls back to
English — but that isn't very friendly to readers of that language.

!!! note "Use two-letter lowercase codes"

    `en`, `ja`, `ko`, `ru`. The documentation site and the Javadoc deliberately share one
    set of codes, so `/en/` and `/javadoc/en/` correspond and readers don't switch
    language by accident when moving between them. Note this is a separate scheme from the
    plugin's runtime language files (`zh_CN.yml` / `en_US.yml`).

---

## Submitting

Branch and commit conventions are in the [Contributing guide](contributing.md).
Translation commits use the `docs` prefix with the language in parentheses:

```
docs(i18n/en): translate quick start and command reference
docs(i18n/en): sync configuration with the latest original
```

In the PR, say **which pages** you translated and whether they are **new or a sync**.
Translations don't need the plugin test suite; CI checks the docs site builds and that the
Javadoc overlay hasn't drifted.
