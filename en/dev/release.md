# 发布流程

本文写给维护者。文档站已经自动化；**发版与 Javadoc 全部手动** —— 原因见下。

---

## 先弄清楚：这个项目有两个仓库

源码仓库是**私有**的，而文档站要给所有人看 —— 私有仓库发不了免费的 GitHub Pages。
所以对外的一切都落在另一个**公开**仓库上：

| 仓库 | 可见性 | 放什么 |
|---|---|---|
| `HappyWithMin/GTRigidPhysics` | 私有 | 源码与 `docs/` 的**真相源**。不跑任何 CI |
| `GTedd/GTRigidPhysics` | 公开 | `main` = 文档源码副本<br>`gh-pages` = 文档站 + Javadoc + Maven 构件 |

发布出去的东西全在公开仓库那一侧：

```
https://gtedd.github.io/GTRigidPhysics/           文档站
https://gtedd.github.io/GTRigidPhysics/javadoc/   API 文档
https://gtedd.github.io/GTRigidPhysics/           Maven 仓库（同一个地址）
```

### 谁跑 CI，谁不跑

**私有仓库不跑任何 CI**，它只存源码。2026-09 删掉了原有的四条工作流 ——
它们在这个组织仓库上持续失败并向维护者发通知，而排查要看 Actions 日志。
本地等价命令当时全部通过，说明是 CI 环境特有的问题（组织对第三方 action
的策略是最可能的原因，`setup-bun` 与 `setup-gradle` 都是第三方）。

**公开仓库自己发布文档站**：推到它的 `main` 就自动构建并更新 gh-pages。
同仓库推送用自带的 `GITHUB_TOKEN` 就够，不需要任何 PAT。那条工作流
（`.github/workflows/pages.yml`）刻意只用 GitHub 官方 action，把依赖面压到最小。

于是分工是：

| 产物 | 怎么更新 |
|---|---|
| 文档站（`/`、`/en/`） | **自动** —— 把 `docs/` 同步到公开仓库 main 即可 |
| Javadoc（`/javadoc/`） | 手动 —— 公开仓库里没有 Java 源码，只能本地生成再推 |
| Maven 构件（`/cn/`） | 手动，且**只增不删** |
| 插件 jar、资源包 | 手动 —— 本地构建，手动建 Release |

**所有校验现在只在本地跑**：

```bash
bun run check                      # 翻译结构 + Javadoc 覆盖层 + 严格模式构建
./gradlew build -PrunTests         # 编译与测试
```

提交前跑它们。少了 CI 兜底，这两条命令就是唯一的门禁。

!!! warning "`bun run check` 要求 uv 在 Windows 全局 PATH 里"

    不是只在 Git Bash 的 PATH 里 —— bun 起的是原生进程，看不到 Git Bash 补的那份，
    会报 `command not found: uv`。把 `%USERPROFILE%\.local\bin` 加进用户 PATH 即可。
    临时绕开：`uv run --with-requirements requirements-docs.txt mkdocs build --strict`。

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

没有发版工作流了，整条链路都在本地：

```bash
# 1. 改版本号
vim gradle.properties

# 2. 构建全部产物（-Pversion 覆盖 gradle.properties 里的默认值）
./gradlew build -PrunTests -Pversion=1.0.1
bun run javadoc:check                             # 译文覆盖层是否还与原文代码一致
./gradlew aggregateJavadoc -Pversion=1.0.1        # → build/docs/javadoc/
./gradlew publishAllToStaging -Pversion=1.0.1     # → build/maven-repo/

# 3. 提交并打 tag
git commit -am "chore: 发布 1.0.1"
git tag v1.0.1
git push origin main --tags
```

打完 tag **什么都不会自动发生**。接下来手动做三件事：

1. **建 GitHub Release** —— 在私有仓库的 Releases 页面新建，选刚推的 tag，
   附上 `paper/build/libs/GTRigidPhysics-1.0.1.jar`、`build/distributions/` 下的
   资源包 zip 与它的 `-sha1.txt`；
2. **推 Maven 构件与 Javadoc** 到公开仓库的 gh-pages —— 见下一节；
3. **同步 `docs/` 到公开仓库 main** —— 文档站会自己重新部署。

!!! warning "版本号格式自己把关"

    原先有工作流校验 `v主.次.修` 的格式，现在没有了。
    **版本号一旦推进 Maven 仓库就永久留在那里**，打 tag 前多看一眼。

---

## 手动发布文档站与 Javadoc { #manual-publish }

**文档站不用管**：把 `docs/` 同步到公开仓库 main（下面第 4 步），它会自己重新部署。
要手动搬的是 **Javadoc** 和 **Maven 构件** —— 公开仓库里没有 Java 源码，
生成不了它们。

一次性 clone 好公开仓库，之后每次重复第 3 步起即可。

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

**改文档不需要发版。** 把改动同步到公开仓库的 `main`，它的 `pages.yml`
就会重新构建并发布 —— 这条链路是自动的。

但**私有仓库这边推了不算**：两个仓库之间没有任何自动同步，`docs/` 要自己搬过去
（[手动发布](#manual-publish)那节的第 4 步）。

同步前本地跑一次 `bun run check`。公开仓库那边只做 `mkdocs build --strict`，
翻译结构与 Javadoc 覆盖层的校验它跑不了 —— 那是 TypeScript 写的，
而那条工作流刻意不装 bun。

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

这个分支在**公开**仓库 `GTedd/GTRigidPhysics` 上，三类内容更新方式不同：

| 路径 | 内容 | 谁更新 | 策略 |
|---|---|---|---|
| `/` | 文档站中文版（面向用户） | `pages.yml` **自动** | 整体替换 |
| `/en/`、`/<lang>/` | 文档站各语言译本 | 同上 | 整体替换 |
| `/llms.txt`、`/llms-full.txt`、`/export/` | Markdown 导出（译者与 agent 用） | 同上 | 随站点一起 |
| `/javadoc/` | 语言选择落地页 | 维护者手动 | 整体替换 |
| `/javadoc/zh/`、`/javadoc/en/` | 各语言 API 文档（面向开发者） | 维护者手动 | 整体替换 |
| `/cn/gtedd/...` | Maven 构件 | 维护者手动 | **只增不删** |

最后一条是硬约束：别人的项目正锁着旧版本，删掉就是把他们的构建打断。
`pages.yml` 清理站点时用 `find ... ! -name cn ! -name javadoc -exec rm -rf`
逐项删而不是 `rm -rf` 整个目录，就是为了守住下面那三行 —— 改那段脚本时
务必保持这个语义，手动推的时候也照抄[同一段命令](#manual-publish)。

---

## 版本号规则

遵循[语义化版本](https://semver.org/lang/zh-CN/)，tag 格式 `v主.次.修`（可带预发布后缀）。

**没有任何东西会校验这个格式** —— 原先那条校验随发版工作流一起删了。
而版本号一旦推进 Maven 仓库就永久留在那里，所以打 tag 前自己看一眼。

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

## 仓库里为什么留着本机专属的构建配置

`gradle.properties` 与 `gradle-wrapper.properties` 里各有一处写死的本机路径：

```properties
org.gradle.java.home=D:/zulu25        # gradle.properties
javaHome=D:\zulu25                    # gradle/wrapper/gradle-wrapper.properties
```

它们留在仓库里是刻意的：开发机路径含中文，那套配置有实测依据
（见 `gradle.properties` 顶部注释），不该为了别的环境牺牲本地体验。

原先四条工作流各有一步 `sed -i` 把它们剥掉 —— runner 上没有 `D:\zulu25`，
不删就是构建第一步直接挂。**工作流现在都删了，这些路径也就再没人管**。
以后要在别的机器上构建（或者恢复 CI），记得先处理这两行。

同理，`distributionUrl` 指向阿里云镜像（开发机直连 gradle.org 不通）。
换到境外机器构建时它会又慢又不稳，那边该改回官方源。

---

## 故障排查

| 现象 | 原因与处理 |
|---|---|
| 换台机器构建，报找不到 `D:\zulu25` | `gradle.properties` 与 wrapper 里的本机路径没处理，见上一节 |
| 发出来的包版本还是 1.0.0 | `build.gradle.kts` 里 `version` 被硬编码了 —— 必须走 `projectVersion` 变量 |
| gh-pages 上历史版本消失 | 手动发布时清空了 `cn/` —— 它只增不删，必须叠加 |
| Maven 仓库零星 404 | `gh-pages` 根缺 `.nojekyll`，Jekyll 吞掉了下划线开头的目录 |
| 下游拉不到 `gtrigidphysics-common` | 查 api 的 POM 里依赖坐标是不是写成了 `cn.gtedd:common` |
| Javadoc 任务报 `Input length = 1` | 用的是 Gradle 内置 `javadoc` 任务，应走 `javadocUtf8` / `aggregateJavadoc` |
| `:api:javadocUtf8` 失败 | api 模块用 `-Xdoclint:all`，缺 `@param` 或坏 `{@link}` 都会红 —— 这是设计如此 |
| 文档站构建报 link not found | `--strict` 拦下了死链。相对链接不能跑出 `docs/` 目录；指向构建期产物（zip、llms.txt）要用绝对 URL |
| 文档站搜中文搜不到 | 装文档依赖时漏了 `jieba` —— 它在 `requirements-docs.txt` 里，别单独 pip install |
| 改完文档推上去了，线上却没变 | **正常** —— 站点更新要走[手动发布](#manual-publish)，没有任何自动化 |
| 发布后文档站没了但 Maven 还在 | 手动发布时 `find` 的 `! -name` 排除项抄漏了 |

---

## 迁移到 Maven Central（可选）

GitHub Pages 静态仓库的好处是零成本、零认证、下游一行 `maven(...)` 即可。
如果日后要上 Maven Central，需要额外准备：

1. 在 [Central Portal](https://central.sonatype.com/) 注册并验证 namespace
   —— 用 `cn.gtedd` 需要证明拥有 `gtedd.cn` 域名；没有域名可改用 `io.github.<用户名>`；
2. 生成 GPG 密钥并把公钥推到公共密钥服务器；
3. 在 `build.gradle.kts` 里加 `signing` 插件，密钥从环境变量注入（别提交进仓库）；
4. 把发布目标从本地 staging 目录改为 Central Portal 的上传端点。

现有的 POM 元数据（name / description / url / licenses / developers / scm）
已经按 Central 的必填项配齐了，届时不需要再补。

**注意 Central 的版本不可撤回也不可覆盖** —— 这是它与静态仓库最大的行为差异。
