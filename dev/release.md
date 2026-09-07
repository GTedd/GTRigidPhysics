# 发布流程

本文写给维护者。日常发布只需要打一个 tag，其余全自动。

---

## 一次性准备

以下三步只在**第一次发布前**做一次。

### 1. 建 GitHub 仓库并推代码

```bash
git remote add origin https://github.com/GTedd/GTRigidPhysics.git
git push -u origin main
```

若用户名或仓库名不是 `GTedd` / `GTRigidPhysics`，有**四处**要同步改：

| 位置 | 影响 |
|---|---|
| `gradle.properties` 的 `githubOwner` / `githubRepo` | POM 的 url/scm、Javadoc 底栏 |
| `mkdocs.yml` 的 `site_url` / `repo_url` / `nav` 里的 Javadoc 外链 | 文档站 |
| `docs/index.md` 里的仓库与 Javadoc 链接 | 文档站首页 |
| `README.md` 顶部的两个站点链接 | 仓库主页 |

前者是构建脚本读的变量，后三者是 markdown 里的字面量 —— 没有统一的注入机制，
只能手改。改完跑一次 `mkdocs build --strict`，死链会被当场拦下。

### 2. 跑一次发布工作流

`gh-pages` 分支由 `release.yml` 首次运行时自动创建（用的是 `git worktree add --orphan`）。
**先发一个版本，再去开 Pages** —— 反过来的话 Pages 设置里根本看不到那个分支。

```bash
git tag v1.0.0
git push origin v1.0.0
```

### 3. 开启 GitHub Pages

仓库 **Settings → Pages**：

- Source: **Deploy from a branch**
- Branch: **gh-pages** / **/ (root)**

等一两分钟，访问 `https://<用户名>.github.io/<仓库名>/` 应该能看到落地页。

> 私有仓库的 GitHub Pages 需要付费方案。开源项目请把仓库设为 public。

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
3. 把 Maven 构件**追加**到 `gh-pages`（历史版本一直保留）；
4. 把最新 Javadoc 覆盖到 `gh-pages/javadoc/`（含 `zh/`、`en/` 与语言选择落地页）；
5. 重新构建文档站并覆盖 `gh-pages` 根路径（中文在 `/`，其余语言各占一层子目录）。

也可以在 Actions 页面手动触发 `发布` 工作流并填版本号，适合补发。

---

## 文档站单独发布

**改文档不需要发版。** `docs/**` 或 `mkdocs.yml` 一有改动推到 `main`，
`docs.yml` 工作流就会重新构建并发布文档站 —— 改个错别字不该需要打一个 tag。

PR 阶段只验证能不能构建、不发布，否则任何人提 PR 都能改线上文档。

本地预览：

```bash
pip install mkdocs-material jieba
mkdocs serve            # → http://127.0.0.1:8000，改 md 自动热重载
mkdocs build --strict   # 死链会让构建失败
```

!!! warning "jieba 不是可选依赖"

    没有它中文不分词，搜「视角滚转」这类词组一条都搜不出来 ——
    默认分隔符只按空格和标点切，而中文正文里根本没有空格。
    `mkdocs-material` 的 search 插件检测到 jieba 已安装会自动启用中文分词。

### gh-pages 上的内容

| 路径 | 内容 | 更新策略 | 由谁维护 |
|---|---|---|---|
| `/` | 文档站中文版（面向用户） | 整体替换 | `docs.yml` 与 `release.yml` |
| `/en/`、`/<lang>/` | 文档站各语言译本 | 整体替换 | 同上 |
| `/javadoc/` | 语言选择落地页 | 整体替换 | `release.yml` |
| `/javadoc/zh/`、`/javadoc/en/` | 各语言 API 文档（面向开发者） | 整体替换 | `release.yml` |
| `/cn/gtedd/...` | Maven 构件 | **只增不删** | `release.yml` |

最后一条是硬约束：别人的项目正锁着旧版本，删掉就是把他们的构建打断。
发布脚本用 `find ... ! -name cn ! -name javadoc -exec rm -rf` 逐项清理而不是
`rm -rf` 整个目录，就是为了守住这两个目录 —— 改这段脚本时务必保持这个语义。

`docs.yml` 与 `release.yml` 共用 `concurrency: gh-pages`，两者不会并发推送。

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
详见 [THIRD_PARTY_NOTICES.md](https://github.com/GTedd/GTRigidPhysics/blob/main/THIRD_PARTY_NOTICES.md)。

---

## CI 为什么要「剥离本机专属构建配置」

两个 workflow 里都有这一步：

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
> 和两个 workflow 里的 `gradle-version`。只改一处不会报错，只会让 CI 与本地跑在
> 不同版本上 —— 而这类不一致往往要到某个版本行为差异暴露时才被发现。

---

## 故障排查

| 现象 | 原因与处理 |
|---|---|
| CI 第一步就挂，报找不到 `D:\zulu25` | 剥离步骤没跑到，或新增了别的本机路径配置 |
| 发出来的包版本还是 1.0.0 | `build.gradle.kts` 里 `version` 被硬编码了 —— 必须走 `projectVersion` 变量 |
| gh-pages 上历史版本消失 | 发布脚本里的 `cp -r build/maven-repo/.` 被误改成了先清空目录 |
| Maven 仓库零星 404 | `gh-pages` 根缺 `.nojekyll`，Jekyll 吞掉了下划线开头的目录 |
| 下游拉不到 `gtrigidphysics-common` | 查 api 的 POM 里依赖坐标是不是写成了 `cn.gtedd:common` |
| Javadoc 任务报 `Input length = 1` | 用的是 Gradle 内置 `javadoc` 任务，应走 `javadocUtf8` / `aggregateJavadoc` |
| `:api:javadocUtf8` 失败 | api 模块用 `-Xdoclint:all`，缺 `@param` 或坏 `{@link}` 都会红 —— 这是设计如此 |
| 文档站构建报 link not found | `--strict` 拦下了死链。相对链接不能跑出 `docs/` 目录，指向仓库根文件要用 GitHub 绝对地址 |
| 文档站搜中文搜不到 | CI 的 `pip install` 里漏了 `jieba` |
| 发布后文档站没了但 Maven 还在 | `find` 的 `! -name` 排除项被改坏了 |

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
