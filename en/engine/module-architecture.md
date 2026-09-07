# 模块架构

> 源码：`settings.gradle.kts` 与各模块的 `build.gradle.kts`（铁律都写在文件头的注释里）

四个 Gradle 模块，依赖方向严格单向。
这套划分不是为了好看 —— 每一条边界都对应一件具体的事：能不能单元测试、下游插件要背多大的包、
重构时会不会波及别人。

```
                   ┌──────────┐
                   │  common  │  纯逻辑地基
                   └────┬─────┘
              ┌─────────┴─────────┐
        ┌─────▼─────┐       ┌─────▼─────┐
        │  physics  │       │    api    │  对外契约
        └─────┬─────┘       └─────┬─────┘
              └─────────┬─────────┘
                  ┌─────▼─────┐
                  │   paper   │  平台层 + api 的唯一实现方
                  └───────────┘
```

**`api` 不依赖 `physics`。** 下游插件只该看见契约，不该被拖上求解器的实现细节。

---

## `common` —— 纯逻辑地基

结构完整性分析、簇切分、预算管理、LOD 决策、材质表、区域规则。58 个类。

!!! quote "铁律"
    **零 `org.bukkit` import、零物理引擎 import。**
    本模块不声明这两类依赖，靠编译期天然隔离。

目的很直接：**让结构分析算法能脱离服务器与物理引擎跑单元测试**。
`common` 有 30 个测试类，是全项目测试最密的模块 —— 这不是巧合，是这条边界换来的。

JOML 用 `compileOnly` 而非 `api`：

1. Paper 服务端自带 JOML（Display API 的 `Transformation` 就基于它），再 shade 一份属冗余
2. `joml:1.10.8` 的 pom 会拖进 1.8 MB 的 kotlin-stdlib，纯 Java 用不上

---

## `physics` —— 自研 XPBD 引擎

刚体、地形、求解器、位姿快照、坍塌世界与物体世界的封装。24 个类。

!!! quote "铁律"
    **零 `org.bukkit` import。本模块不认 Minecraft。**

    `engine` 子包更严：**零第三方依赖**，连 JOML 都不用 —— 向量数学全是标量字段。

`engine` 那条额外的严格性带来一个直接收益：**整个求解器可以在普通 JVM 上直接跑单测**。
`physics` 的 9 个测试类不需要服务器、不需要任何原生库、不需要 mock。

### 那道防泄漏的墙

`ObjectPhysicsWorld` 与 `ClusterPhysicsWorld` 的整套 API **只收发 `double`、`float` 与 id** ——
`RigidBody`、`ContactSet`、求解器常量一个都不出现在签名里。

于是 `paper` 层无从、也无需触碰物理内核：它只会「按 id 下命令、按 id 读位姿」。

!!! info "这道墙是重构的主要结构性收益之一"
    从前这套东西**整个长在 `paper` 里** —— 两千多行，通配符 import 了整个原生引擎的包，
    平台层与物理层彻底纠缠。

    `MechanismHandle` 是同一思路的另一处应用：铰链与滑轨在引擎里是两个类，
    平台层只看见一个「驱动 / 读值 / 拆掉」的接口。

---

## `api` —— 对外发行的稳定契约

接口、事件、值对象。64 个类。社区插件依赖的就是这一个 artifact。

!!! quote "三条铁律"
    1. **零物理引擎、零 packetevents。** 产物必须是几十 KB 的纯接口 jar ——
       下游插件加一行依赖不该背上三平台 native 二进制。
    2. **只依赖 `:common` 与 `paper-api`。** `common` 本身零 bukkit、零引擎，
       把它作为传递依赖是安全的 —— 下游因此能直接拿到 `PhysicsMaterial`、`SettleMode`、
       `AnalysisSettings` 这些值类型，不必再声明一次。
    3. **许可证是 MIT**，而非仓库根的 GPL-3.0。闭源插件也可以依赖本模块编译。

第 1 条在迁移到自研引擎之后**变得容易遵守了** —— 现在整个引擎都是纯 Java，
就算不小心依赖也不会拖进 native 二进制。但铁律仍然保留：
`api` 依赖 `physics` 会让「内部重构不波及下游」这条承诺失效。

---

## `paper` —— 平台层

事件接入、packetevents 发包表现层、配置、命令、`api` 的唯一实现方。127 个类。

!!! quote "铁律"
    **唯一允许 import `org.bukkit` 与 packetevents 的模块。**

packetevents 是**前置插件**而非内嵌依赖 —— 不 shade 进 jar。
`paper-plugin.yml` 里声明 `required: true`。

第三方仓库：Paper（`repo.papermc.io`）、packetevents（`repo.codemc.io`）、
CraftEngine（`repo.momirealms.net`）。

---

## 引擎 jar 与 addon

引擎 jar 只承载「物理系统 + API 实现 + 最低限度的服务端基础设施」。
玩家交互工具、管理面板、测试命令这些**不内置**。

```
GTRigidPhysics.jar          api + common + physics + paper
        │
        │  addon 只依赖 gtrigidphysics-api
        ▼
panel-addon / toolbelt-addon / vehicle-addon
```

引擎命令因此只剩五组：`status` / `sim` / `material` / `structure` / `admin`。
详见 [addon 机制](../addons/index.md)。

---

## 依赖方向为什么必须单向

反向依赖（比如 `common` 用一个 `paper` 的工具类）在写的当下总是最省事的，
代价要过几个月才显形：

| 违反 | 代价 |
|---|---|
| `common` → `bukkit` | 结构分析再也不能跑单元测试，只能起服务器验证 |
| `physics` → `bukkit` | 求解器测试要 mock 整个 Bukkit，实际结果是不写测试 |
| `api` → `physics` | 下游插件的编译期类路径上出现求解器，内部重构变成破坏性变更 |
| `paper` → `engine` 内部类 | 就是重构前那两千行的状态 |

这几条在构建里靠**依赖声明本身**保证 —— 模块根本没有声明那些依赖，所以 import 写不出来。
不是靠 code review 记着。

---

## 相关

- [引擎总览](index.md)
- [线程与数据流](threading.md) —— 边界在运行期的表达
- [addon 机制](../addons/index.md) —— 引擎之外那一层
- [构建指南](../dev/build.md) —— 怎么把它们编出来
