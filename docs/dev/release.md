# 发布流程

本文写给维护者。发版打一个 tag 即可；**文档站与 Javadoc 要手动搬一次** —— 原因见下。

---

## 先弄清楚：这个项目有两个仓库

源码仓库是**私有**的，而文档站要给所有人看 —— 私有仓库发不了免费的 GitHub Pages。
所以对外的一切都落在另一个**公开**仓库上：

| 仓库 | 可见性 | 放什么 |
|---|---|---|
| `HappyWithMin/GTRigidPhysics` | 私有 | 源码、CI、`docs/` 的**真相源** |
| `GTedd/GTRigidPhysics` | 公开 | `main` = 文档源码副本<br>`gh-pages` = 文档站 + Javadoc + Maven 构件 |

发布出去的东西全在公开仓库那一侧：

```
https://gtedd.github.io/GTRigidPhysics/           文档站
https://gtedd.github.io/GTRigidPhysics/javadoc/   API 文档
https://gtedd.github.io/GTRigidPhysics/           Maven 仓库（同一个地址）
```

### 两边之间是手动搬的

私有仓库的 CI **只做校验，不做发布**：

| 工作流 | 触发 | 做什么 |
|---|---|---|
| `build.yml` | 改了源码 | 编译、跑测试、校验 API 文档、验证发布产物可生成 |
| `docs.yml` | 改了 `docs/**` 等 | 翻译结构校验 + 严格模式构建（死链会红） |
| `javadoc.yml` | 改了 `*/src/main/java/**` 或译文覆盖层 | 译文覆盖层校验 + doclint + 生成聚合文档 |
| `release.yml` | 打了 `v*` tag | 建 GitHub Release |

四条都把产物上传成 artifact，但**没有一条会往公开仓库推**。

!!! note "为什么不做成自动的"

    跨仓库推送用不了 `GITHUB_TOKEN`（它只对当前仓库有权限），只能配一个 PAT。
    那意味着把公开仓库的写权限以 secret 形式挂在组织仓库上 —— 组织成员的
    Actions 权限边界比个人仓库复杂得多，为省几次手动操作不值得。

    发布频率也支持这个选择：文档改动虽多，但**积攒着一次性发**完全够用。

搬运步骤见下面的[手动发布文档站与 Javadoc](#manual-publish)。

---

## 一次性准备

以下几步只在**第一次发布前**做一次。

### 1. 建两个仓库并推代码

```bash
# 私有仓库：源码
git remote add origin https://github.com/HappyWithMin/GTRigidPhysics.git
git push -u origin main
```

公开仓库的 `main`（文档源码）与 `gh-pages`（构建产物）手动推一份上去，
之后按[手动发布](#manual-publish)那一节更新。

若归属或仓库名有变，有**四处**要同步改：

| 位置 | 影响 |
|---|---|
| `gradle.properties` 的 `githubOwner` / `githubRepo` | POM 的 url/scm、发布落地页 |
| `gradle.properties` 的 `copyrightHolder` | Javadoc 底栏、POM 的 developer。**与仓库归属刻意分开**，改它要同步改 `LICENSE-MIT` |
| `mkdocs.yml` 的 `site_url` / `repo_url` / `nav` 里的 Javadoc 外链 | 文档站 |
| `docs/index.md`、`README.md` 里的站点链接 | 首页与仓库主页 |

第一二项是构建脚本读的变量，其余是字面量 —— 没有统一的注入机制，只能手改。
改完跑一次 `mkdocs build --strict`，死链会被当场拦下。

### 2. 开启 GitHub Pages

在**公开**仓库 `GTedd/GTRigidPhysics` 的 **Settings → Pages**：

- Source: **Deploy from a branch**
- Branch: **gh-pages** / **/ (root)**

等一两分钟，访问 <https://gtedd.github.io/GTRigidPhysics/> 应该能看到首页。

> 私有仓库的 GitHub Pages 需要付费方案 —— 这正是要分出一个公开仓库的原因。

---

## 日常发布

```bash
# 1. 改版本号
#    gradle.properties 里的 version 只是本地默认值，
#    CI 用的是 tag，两者保持一致以免混淆
vim gradle.properties

# 2. 本地过一遍
./gradlew build -PrunTests
bun run javadoc:check             # 译文覆盖层是否还与原文代码一致
./gradlew aggregateJavadoc        # 产出 build/docs/javadoc/{index.html,zh,en}
./gradlew publishAllToStaging     # 产物在 build/maven-repo/

# 3. 提交并打 tag
git commit -am "chore: 发布 1.0.1"
git tag v1.0.1
git push origin main --tags
```

推 tag 之后 `release.yml` 会自动：

1. 用 tag 里的版本号构建（`-Pversion=1.0.1`）并跑测试；
2. 建 GitHub Release，附上插件 jar、资源包 zip 与它的 SHA-1；
3. 把 Maven 构件、Javadoc、文档站三份产物上传成 artifact。

**第 3 步之后还要手动搬一次** —— 见下一节。工作流跑完会在日志里留一条
notice 提醒，别漏掉：GitHub Release 建好了不等于文档站更新了。

也可以在 Actions 页面手动触发 `发布` 工作流并填版本号，适合补发。

---

## 手动发布文档站与 Javadoc { #manual-publish }

私有仓库的 CI 只校验、不推送，所以线上那份要自己搬。一次性 clone 好公开仓库，
之后每次重复第 3 步起即可。

```bash
# 1. 本地生成产物
bun run docs:build            # → site/          （严格模式，死链会失败）
./gradlew aggregateJavadoc    # → build/docs/javadoc/{index.html,zh,en}

# 2. clone 公开仓库（只需一次）
git clone https://github.com/GTedd/GTRigidPhysics.git /tmp/pub

# 3. 更新 gh-pages
cd /tmp/pub && git checkout gh-pages
#    清旧站点，但守住 cn/（Maven 构件）—— 见下面的警告
find . -mindepth 1 -maxdepth 1 ! -name '.git' ! -name 'cn' ! -name 'javadoc' -exec rm -rf {} +
cp -r <项目路径>/site/. .
rm -rf javadoc && mkdir javadoc && cp -r <项目路径>/build/docs/javadoc/. javadoc/
touch .nojekyll               # 不加这个 Jekyll 会吞掉下划线开头的目录
git add -A && git commit -m "docs: 更新文档站与 Javadoc" && git push

# 4. 同步文档源码到 main，让站上每页的「编辑本页」铅笔有地方可去
cd /tmp/pub && git checkout main
rm -rf docs hooks overrides tools mkdocs.yml requirements-docs.txt package.json
cp -r <项目路径>/{docs,hooks,overrides} .
mkdir -p tools && cp -r <项目路径>/tools/i18n tools/
cp <项目路径>/{mkdocs.yml,requirements-docs.txt,package.json} .
rm -rf docs/internal hooks/__pycache__      # 内部材料与字节码缓存不外发
git add -A && git commit -m "docs: 同步文档源码" && git push
```

!!! danger "两个地方错了就会造成实际损害"

    **`cn/` 只增不删。** 第 3 步那句 `find ... ! -name 'cn'` 不能省 ——
    别人的项目正锁着旧版本，删掉就是把他们的构建打断。发 Maven 构件时也一样，
    是把 `build/maven-repo/` **叠加**上去，不是替换。

    **第 4 步是单向覆盖。** 公开仓库上合并的翻译 PR 必须先回流到私有仓库，
    否则这一步会把它抹掉。合了就立刻带回来，别攒着。

发版时的 Maven 构件多一步：

```bash
cd /tmp/pub && git checkout gh-pages
cp -r <项目路径>/build/maven-repo/. .       # 叠加，不清空
git add -A && git commit -m "发布 v1.0.1：Maven 构件" && git push
```

---

## 文档站的日常改动

**改文档不需要发版。** 推到 `main` 后 `docs.yml` 会校验翻译结构与死链，
但**不会发布** —— 站点更新要走上面那节的手动步骤。

好在文档改动可以**积攒着一次性发**：CI 已经保证了「能构建、没死链、译本结构没坏」，
攒几次再搬不会积累风险。

本地预览：

```bash
bun run docs           # → http://127.0.0.1:8000，改 md 自动热重载
bun run docs:build     # 严格模式，死链会让构建失败
```

!!! warning "jieba 不是可选依赖"

    没有它中文不分词，搜「视角滚转」这类词组一条都搜不出来 ——
    默认分隔符只按空格和标点切，而中文正文里根本没有空格。
    `mkdocs-material` 的 search 插件检测到 jieba 已安装会自动启用中文分词。

### gh-pages 上的内容

这个分支在**公开**仓库 `GTedd/GTRigidPhysics` 上，由维护者手动更新。

| 路径 | 内容 | 更新策略 | 产物来自 |
|---|---|---|---|
| `/` | 文档站中文版（面向用户） | 整体替换 | `bun run docs:build` → `site/` |
| `/en/`、`/<lang>/` | 文档站各语言译本 | 整体替换 | 同上 |
| `/llms.txt`、`/llms-full.txt`、`/export/` | Markdown 导出（译者与 agent 用） | 随站点一起 | 同上 |
| `/javadoc/` | 语言选择落地页 | 整体替换 | `./gradlew aggregateJavadoc` |
| `/javadoc/zh/`、`/javadoc/en/` | 各语言 API 文档（面向开发者） | 整体替换 | 同上 |
| `/cn/gtedd/...` | Maven 构件 | **只增不删** | `./gradlew publishAllToStaging` |

最后一条是硬约束：别人的项目正锁着旧版本，删掉就是把他们的构建打断。
所以清理时用 `find ... ! -name cn ! -name javadoc -exec rm -rf` 逐项删而不是
`rm -rf` 整个目录 —— 照抄[上一节](#manual-publish)的命令就不会错。

---

## 版本号规则

遵循[语义化版本](https://semver.org/lang/zh-CN/)，tag 格式 `v主.次.修`（可带预发布后缀）。

工作流会校验格式，不合规直接失败 —— **版本号一旦发布就永久留在 Maven 仓库里**，
校验在这里比事后清理便宜得多。

| 改动 | 该升哪一位 |
|---|---|
| api 模块删/改了公开成员的签名 | 主版本 |
| api 模块新增了公开成员 | 次版本 |
| 只改实现，api 模块没动 | 修订号 |

api 模块动了签名时，记得同步改 `RigidPhysicsApiImpl.API_VERSION`
—— 它是下游做能力判断的依据，与插件版本各自演进。

---

## 发布了什么，没发布什么

| 构件 | 去向 | 许可证 |
|---|---|---|
| `gtrigidphysics-api` | Maven（gh-pages） | MIT |
| `gtrigidphysics-common` | Maven（gh-pages） | MIT |
| `gtrigidphysics-physics` | Maven（gh-pages） | MIT |
| `GTRigidPhysics-*.jar`（插件本体） | **仅 GitHub Release 附件** | GPL-3.0 |
| `GTRigidPhysics-RP-*.zip`（资源包） | **仅 GitHub Release 附件** | 见资源包内 LICENSES |

插件本体刻意不进 Maven 仓库，两个理由任一个都足够：它是可执行插件本体，依赖服务器上
已安装的 packetevents 前置插件，无法脱离运行环境独立使用；且含三平台 native、体积数十 MB。
详见源码仓库根目录的 `THIRD_PARTY_NOTICES.md`。

---

## CI 为什么要「剥离本机专属构建配置」

凡是要跑 Gradle 的 workflow（`build.yml`、`javadoc.yml`、`release.yml`）里都有这一步：

```bash
sed -i '/^org\.gradle\.java\.home=/d' gradle.properties
sed -i '/^javaHome=/d' gradle/wrapper/gradle-wrapper.properties
```

这两处都写死了 `D:\zulu25`，runner 上不存在，不删就是构建第一步直接挂。

它们留在仓库里是刻意的：开发机路径含中文，那套配置有实测依据
（见 `gradle.properties` 顶部注释），不该为了 CI 牺牲本地体验。
**新增别的本机绝对路径配置时，记得同步更新这两个 workflow。**

同理，CI 用 `gradle/actions/setup-gradle` 直接装 Gradle 而不走 `./gradlew`：
wrapper 的 `distributionUrl` 指向阿里云镜像（开发机直连 gradle.org 不通），
而 runner 在境外从阿里云拉发行包又慢又不稳。两边各用各的源。

> ⚠ 升级 Gradle 时要**同时**改 `gradle-wrapper.properties` 的 `distributionUrl`
> 和三个 workflow 里的 `gradle-version`。只改一处不会报错，只会让 CI 与本地跑在
> 不同版本上 —— 而这类不一致往往要到某个版本行为差异暴露时才被发现。

---

## 故障排查

| 现象 | 原因与处理 |
|---|---|
| CI 第一步就挂，报找不到 `D:\zulu25` | 剥离步骤没跑到，或新增了别的本机路径配置 |
| 发出来的包版本还是 1.0.0 | `build.gradle.kts` 里 `version` 被硬编码了 —— 必须走 `projectVersion` 变量 |
| gh-pages 上历史版本消失 | 手动发布时清空了 `cn/` —— 它只增不删，必须叠加 |
| Maven 仓库零星 404 | `gh-pages` 根缺 `.nojekyll`，Jekyll 吞掉了下划线开头的目录 |
| 下游拉不到 `gtrigidphysics-common` | 查 api 的 POM 里依赖坐标是不是写成了 `cn.gtedd:common` |
| Javadoc 任务报 `Input length = 1` | 用的是 Gradle 内置 `javadoc` 任务，应走 `javadocUtf8` / `aggregateJavadoc` |
| `:api:javadocUtf8` 失败 | api 模块用 `-Xdoclint:all`，缺 `@param` 或坏 `{@link}` 都会红 —— 这是设计如此 |
| 文档站构建报 link not found | `--strict` 拦下了死链。相对链接不能跑出 `docs/` 目录；指向构建期产物（zip、llms.txt）要用绝对 URL |
| 文档站搜中文搜不到 | CI 的 `pip install` 里漏了 `jieba` |
| 改完文档推上去了，线上却没变 | **正常** —— CI 只校验不发布，站点更新要走[手动发布](#manual-publish) |
| 发布后文档站没了但 Maven 还在 | 手动发布时 `find` 的 `! -name` 排除项抄漏了 |

---

## 迁移到 Maven Central（可选）

GitHub Pages 静态仓库的好处是零成本、零认证、下游一行 `maven(...)` 即可。
如果日后要上 Maven Central，需要额外准备：

1. 在 [Central Portal](https://central.sonatype.com/) 注册并验证 namespace
   —— 用 `cn.gtedd` 需要证明拥有 `gtedd.cn` 域名；没有域名可改用 `io.github.<用户名>`；
2. 生成 GPG 密钥并把公钥推到公共密钥服务器；
3. 在 `build.gradle.kts` 里加 `signing` 插件，密钥从 CI secrets 注入；
4. 把发布目标从本地 staging 目录改为 Central Portal 的上传端点。

现有的 POM 元数据（name / description / url / licenses / developers / scm）
已经按 Central 的必填项配齐了，届时不需要再补。

**注意 Central 的版本不可撤回也不可覆盖** —— 这是它与静态仓库最大的行为差异。
