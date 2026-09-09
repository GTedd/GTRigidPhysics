<!--
  PR 模板。清单刻意分成三段 —— 大多数 PR 只需要填其中一段，
  不相干的整段划掉即可，别为了「填满」去勾不适用的项。

  PR template. The checklist is deliberately split into three sections; most PRs only need
  one of them. Strike out the sections that don't apply rather than ticking boxes that
  aren't relevant.
-->

## 这个 PR 做了什么 · What this PR does



## 类型 · Type

- [ ] 功能 / 修复（改代码）· Feature or fix (code change)
- [ ] 文档（改中文原文）· Documentation (editing the Chinese source)
- [ ] 翻译（新增或同步译本）· Translation (new or synced)
- [ ] 构建 / CI

---

## 改代码时 · For code changes

- [ ] `./gradlew build -PrunTests` 通过 · passes
- [ ] 无 deprecation 警告 · no deprecation warnings
- [ ] 公开 API 有完整 Javadoc（`@param` / `@return` / `@throws`）· public API has complete Javadoc
- [ ] 满足模块约束（`common` 不引 Bukkit，`physics` 不引 packetevents……）· module constraints satisfied
- [ ] 新增命令已同时补 `zh_CN.yml` 与 `en_US.yml` 的键 · new commands have keys in both language files
- [ ] 面向用户的行为变化已同步到 `docs/` · user-facing behaviour changes are reflected in `docs/`
- [ ] `bun run javadoc:check` 通过 —— 改动的 Java 文件若已有译本，代码改动要一并搬进去
      · passes; if an edited Java file has a translation, the code change must be ported into it too

## 改中文文档时 · For documentation changes

- [ ] `bun run docs:build` 通过（严格模式，死链会失败）· passes (strict mode; broken links fail)
- [ ] 已知译本会因此变「过期」，可接受 —— 站上会自动提示读者，不用在本 PR 里补翻
      · aware this marks translations stale; that's fine — the site tells readers, no need to translate here

## 翻译时 · For translations

- [ ] `bun run i18n:check` 通过 · passes
- [ ] `bun run docs:build` 通过 · passes
- [ ] 遵守了[术语表](https://gtedd.github.io/GTRigidPhysics/dev/translating/) · follows the glossary
- [ ] 每篇译本都有 `i18n_source_sha`，且确实对应当前原文（用 `bun run i18n:bless` 打，不要手写）
      · every page carries an `i18n_source_sha` matching the current original (stamp it with `bun run i18n:bless`, never by hand)
- [ ] （Javadoc）`bun run javadoc:check` 通过 —— 只改了注释，代码一个字节没动
      · (Javadoc) passes — comments only, not one byte of code

---

## 相关 issue · Related issues

<!-- Closes #123 -->
