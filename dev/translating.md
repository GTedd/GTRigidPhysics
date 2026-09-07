# 翻译文档

这个项目的文档以**简体中文**为源语言，其它语言都是它的译本。
本文讲怎么参与翻译 —— 从改一个词到认领一整篇，都在这里。

!!! tip "只想改一个错别字？"

    每页右上角有支铅笔（:material-pencil:），点它直接在 GitHub 上改，
    不用 clone、不用装任何东西。改完提 PR 就行。

---

## 两处需要翻译，规则不一样

| | 文档站（本站） | Javadoc |
|---|---|---|
| 面向 | 服主与玩家 | 插件开发者 |
| 源文件 | `docs/**/*.md` | 四个模块的 `*.java` 注释 |
| 译本放哪 | 原文旁边加语言后缀：`quick-start.en.md` | 覆盖目录：`i18n/javadoc/en/<包路径>.java` |
| 缺译本时 | 自动回退中文，页面照常存在 | 该类的注释保持中文，其余照常 |
| 硬性校验 | 无（过期只提示） | **有**，代码必须与原文逐字一致 |

两边的差别来自后果不同：文档站的旧译文顶多是说明过时；
Javadoc 的译本会在生成时**顶替源文件**，跟不上原文就意味着英文 API 参考里
少了一个方法 —— 那是一份看起来完整、实则缺东西的契约文档，比没有更糟。

---

## 环境准备

!!! tip "不想装环境？先把原文拿到手"

    每页右上角的**导出 Markdown**能直接下单页 `.md`，或者整站打包成 zip。
    包里的目录结构与 `docs/` 一一对应，翻完照着路径提 PR 就行 ——
    下面这套本地环境是给要预览效果、跑覆盖率统计的人准备的。
    详见[导出 Markdown](export.md)。

需要 [bun](https://bun.sh) 和 [uv](https://docs.astral.sh/uv/)。
**不需要 npm，也不需要 `bun install`** —— 本仓库的脚本零依赖。

```bash
git clone https://github.com/GTedd/GTRigidPhysics
cd GTRigidPhysics

bun run docs          # 起本地预览 → http://127.0.0.1:8000
```

第一次跑 `bun run docs` 时 uv 会按 `requirements-docs.txt` 装好 MkDocs，
之后走缓存，秒开。中文站在 `/`，英文站在 `/en/`，左上角有语言切换器。

??? note "没装 bun 或 uv 怎么办"

    bun 只是给命令起了个好记的名字，底下就是普通的 mkdocs：

    ```bash
    pip install -r requirements-docs.txt
    mkdocs serve                 # 等价于 bun run docs
    mkdocs build --strict        # 等价于 bun run docs:build
    ```

    i18n 的几个统计脚本确实需要 bun（它们是 TypeScript），
    但那些只是报告工具 —— 不跑也能正常翻译和提 PR。

---

## 翻译文档站

### 看还缺什么

```bash
bun run i18n:status
```

```
zh → en  ████████░░░░░░░░░░░░░░░░  13/39 页最新 (33%)

  ⟳ 原文已改，译本待同步（2）
      guide/commands.md  a1b2c3d4e5f6 → 9f8e7d6c5b4a
      译完跑：bun run i18n:bless en guide/commands.md

  · 尚无译本（24）—— 站点会回退到中文原文，不会 404
      systems/budget.md
      ...
```

### 开一篇新的

```bash
bun run i18n:new en guide/quick-start.md
```

这会生成 `docs/guide/quick-start.en.md`，内容是**中文原文的完整副本**，
外加一段 front matter。逐段把中文替换成英文即可。

!!! question "为什么给的是原文副本而不是空白模板"

    对着原文逐段替换，比对着空文件重写更不容易漏小节，
    标题层级、代码块、链接、提示框也能原样保住 ——
    这些结构一旦走样，中英两版就再也对不上行了。

生成的 front matter 长这样，**不要手动改它**：

```yaml
---
i18n_source_sha: a1b2c3d4e5f6
---
```

这一行记录「我是照着哪一版原文翻的」。原文一改，指纹对不上，
`i18n:status` 就会把这篇标成待同步，站点上也会挂一条提示给读者。

### 同步一篇过期的

原文改了之后：

1. 看原文改了什么 —— 页面上「原文有哪些改动」那个链接直接跳 GitHub 提交历史
2. 把对应改动搬进译本
3. 重打指纹：

```bash
bun run i18n:bless en guide/commands.md
```

!!! warning "bless 只盖章，不检查内容"

    它不会验证你真的同步了内容，只是把指纹更新成当前原文的。
    没跟完就 bless，等于对着读者撒谎说这页是新的。

### 提交前自检

```bash
bun run i18n:check     # 结构性问题：孤儿译本、缺指纹
bun run docs:build     # 严格模式构建，死链会失败
```

---

## 翻译 Javadoc

### 机制

Javadoc 没有原生 i18n。它的 `-locale` 只换「方法概要」这类**界面文字**，
动不了注释正文。所以注释的多语言靠**源码覆盖层**：

```
api/src/main/java/cn/gtedd/rigidphysics/api/RigidPhysicsAPI.java   原文（中文注释）
i18n/javadoc/en/cn/gtedd/rigidphysics/api/RigidPhysicsAPI.java     译本（英文注释）
```

生成英文 Javadoc 时，凡是覆盖层里有的文件，就用覆盖层那份；没有的用原文。
覆盖层里的文件**不参与编译、不进任何 jar**，只有 javadoc 会读它。

### 开一个

```bash
bun run javadoc:status                    # 看还缺什么，按公开成员数给了优先级建议
bun run i18n:new-javadoc en cn/gtedd/rigidphysics/api/object/PhysicsBody.java
```

### 唯一的硬性规则：只改注释，别碰代码

package、import、修饰符、签名、泛型、注解、字段初始值、方法体 ——
一个字节都不能动。只重写 `/** */`、`//`、`/* */` 里的内容。

这条规则是**强制**的，不是倡议：

```bash
bun run javadoc:check
```

它把两边的注释全部剥掉，再逐字比对剩下的代码。任何差异都会失败，
因此同时挡住两类问题 ——「译者顺手改了代码」和「原文变了、译本没跟」。
CI 在每个 PR 上都会跑。

报错时它会指出第一处分歧的上下文。处理办法看是哪一类：

- 译本动了代码 → 改回去
- 原文变了 → 重新复制一份当前原文，把已经译好的注释搬过去

### 翻译约定

- `@param` / `@return` / `@throws` 标签、顺序、参数名一律保留
- `{@link}` 与 `{@code}` 里的目标**是代码引用不是文字**，原样不动
- `<h2>` / `<pre>` / `<table>` 的结构保留，让两种语言读起来是同一个形状
- 译**意图**，别译字面。这些注释解释「为什么」远多于「是什么」，
  逐字直译通常正好把重点丢掉

### 预览

```bash
bun run javadoc:build
```

产出在 `build/docs/javadoc/`：`zh/` 与 `en/` 两套，加一个按浏览器语言分流的落地页。
直接用浏览器打开 `build/docs/javadoc/en/index.html` 就能看。

---

## 术语表

保持一致比保持优美重要。同一个概念在不同页面译成不同的词，读者会以为是两个东西。

| 中文 | English | 说明 |
|---|---|---|
| 刚体 | rigid body | 不用 "physics object" |
| 结构完整性分析 | structural integrity analysis | |
| 坍塌 | collapse | 动词名词同形 |
| 碎块 / 碎屑 | debris | 不可数 |
| 簇 | cluster | 坍塌切分出的连通块 |
| 落地规则 | settle rules | 不是 "landing rules" |
| 预算管理 | budget management | 刚体数量的配额 |
| 物理材质 | physics material | 不是 "texture" |
| 视角滚转 | camera roll | 不是 "view rotation" |
| 机关 | mechanism | 风车、活塞这类约束驱动物体 |
| 布娃娃 | ragdoll | |
| 载具 | vehicle | |
| 虚拟角色 | virtual character | |
| 高度场 | height field | |
| 服主 | server owner | 不用 "server admin" |
| 前置插件 | dependency plugin | |
| 物理帧 | physics frame | |
| 发包 | packet dispatch | |

**不要翻译的专名**：Minecraft、Paper、Folia、Bukkit、Spigot、XPBD、
packetevents、Gradle、以及一切配置键名（`camera-roll.yml`、`settle-mode` 之类）
和代码标识符。

---

## 加一种新语言

一种语言要在**四个地方**同时登记，缺一处就会出静默的怪事：

| 文件 | 加什么 | 漏了会怎样 |
|---|---|---|
| `mkdocs.yml` → `plugins.i18n.languages` | locale、名称、`nav_translations` | 站点根本不建这个语言 |
| `tools/i18n/shared.ts` → `TARGET_LOCALES` | locale 代码 | 统计脚本看不见它 |
| `build.gradle.kts` → `javadocLocales` | locale、Java Locale 名、标题 | Javadoc 没有这个语言 |
| `i18n/javadoc/index.html` → `LANGS` | locale 代码 | 落地页跳到 404 |

另外还要建两个文件：`i18n/javadoc/overview-<locale>.html`（照着
`overview-zh.html` 译）和 `i18n/javadoc/<locale>/`（目录必须存在，
放个 README 就行，否则 Gradle 会因为指向不存在的路径而构建失败）。

最后在 `overrides/partials/i18n-notice.html` 的 `STRINGS` 里补一份横幅文案。
不补也能跑 —— 会退回英文文案，但那对该语言的读者不太友好。

!!! note "语言代码用两位小写"

    `en`、`ja`、`ko`、`ru`。文档站与 Javadoc 刻意用同一套代码，
    这样 `/en/` 与 `/javadoc/en/` 是对应的，读者在两个站之间跳不会莫名换语言。
    注意这套代码和插件运行时的语言文件（`zh_CN.yml` / `en_US.yml`）不是一回事，
    那是另一个体系。

---

## 提交

分支与提交信息的规范见[贡献指南](contributing.md)。翻译类改动的 commit 前缀统一用
`docs`，并在括号里标语言：

```
docs(i18n/en): 翻译快速开始与命令参考
docs(i18n/en): 同步 configuration 到最新原文
```

PR 里说明清楚**翻了哪些页**、**是新译还是同步**即可。
翻译不需要跑插件的测试套件，CI 会自动校验文档站能不能构建、
Javadoc 覆盖层有没有跑偏。
