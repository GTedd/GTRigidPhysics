# GTRigidPhysics

Minecraft **Paper 26.2** 的原版刚体物理引擎。建筑会真的塌下来，骰子会真的滚，载具会真的翻。

**纯服务端插件，玩家不需要装任何 mod。物理引擎是自研的纯 Java 实现，jar 里零 native 二进制。**

---

## 你是谁？

<div class="grid cards" markdown>

-   :material-server: **我是服主，想把它装上**

    ---

    从下载到看见第一次坍塌，大约五分钟。

    [:octicons-arrow-right-24: 快速开始](guide/quick-start.md)

-   :material-tune: **我装好了，想调参数**

    ---

    14 个配置文件，全部支持热重载。按目的索引，不用翻。

    [:octicons-arrow-right-24: 配置总览](guide/config/index.md)

-   :material-puzzle: **我想要面板和法杖**

    ---

    引擎不内置它们 —— 装 addon。面板、工具腰带、载具系统。

    [:octicons-arrow-right-24: addon 是什么](addons/index.md)

-   :material-code-braces: **我是插件开发者，想调用它**

    ---

    一行 Gradle 依赖，生成刚体、拦截坍塌、查询材质。

    [:octicons-arrow-right-24: 接入 API](api/index.md)

-   :material-book-open-variant: **我想知道它是怎么做到的**

    ---

    XPBD 求解器、盒 + 点云碰撞、幽灵碰撞的根治、完整惯性张量。

    [:octicons-arrow-right-24: 引擎原理](engine/index.md)

-   :material-source-pull: **我想给它提 PR**

    ---

    构建、开发流程、贡献指南、版本适配。

    [:octicons-arrow-right-24: 参与开发](dev/build.md)

</div>

---

## 它能做什么

=== "建筑坍塌"

    挖掉承重方块，失去支撑的部分会按**结构完整性分析**的结果整片塌下来，
    碎块用真实刚体模拟下落、翻滚、沿地形滑动，落地后按规则还原方块 / 变掉落物 / 消失。

    不是 `FallingBlock` —— 碎块会**旋转**，会互相碰撞，会顺着斜坡滚。

    还有第三种失效方式：**还连着，但扛不住了**。承重分析会算出每块的载荷与容量，
    打断一根柱子就能引发连续倒塌。塌之前先吱呀作响，给玩家一个逃生窗口。

    [:octicons-arrow-right-24: 建筑坍塌](features/collapse.md)

=== "真实碰撞箱"

    碎块不只是好看 —— 它们**挡得住人、站得上去、能被左右键打中**。

    骑乘组给不了碰撞箱，所以引擎给玩家身边的每个方块单独发一个隐形实体。
    只在够得着的距离激活，带宽账算得很细。

    [:octicons-arrow-right-24: 真实碰撞箱与交互](features/block-collision.md)

=== "物理材质"

    冰面滑、史莱姆块弹、羊毛轻 —— 覆盖全部 **1113 个可破坏方块**，有测试守着覆盖率。

    摩擦真正决定的是「**废墟能堆多陡**」；「羊毛飘、铁块砸」来自二次空气阻力，
    是从物理量里长出来的而不是配出来的。

    [:octicons-arrow-right-24: 物理材质](features/materials.md)

=== "载具 / 机关 / 角色"

    轮式载具走**射线悬挂 + 轮胎受力** —— 加速抬头、刹车点头、过弯侧倾全是涌现的，
    没有一行特判。风车与活塞是带马达的约束机关。还有被地形与刚体阻挡的虚拟角色、
    受重力自然倒地的布娃娃。

    完整的载具玩法（车库、蓝图搭建、飞机 / 直升机 / 船）在 addon 里。

    [:octicons-arrow-right-24: 载具](features/objects/vehicle.md) ·
    [:octicons-arrow-right-24: 载具 addon](addons/vehicle.md)

=== "视角滚转"

    爆炸和坍塌会让附近玩家的画面猛地滚一下再震荡回正。

    这一项**需要玩家装客户端资源包**（插件可自动下发），是全插件唯一有客户端要求的功能。
    着色器不可用时自动降级到原版受击倾斜。

    [:octicons-arrow-right-24: 视角滚转](features/camera-roll.md)

---

## 运行要求

| 项目 | 要求 |
|---|---|
| 服务端 | Paper **26.2+** |
| Java | **25** |
| 前置插件 | packetevents **2.13.0+**（必须，不内嵌） |
| 系统架构 | **无限制** |
| 启动参数 | **不需要额外参数** |
| 客户端 | 无要求（视角滚转需要资源包，可关） |

!!! success "架构限制已经消失"
    早期版本基于 jolt-jni，物理跑在 native 二进制上，因此只支持三个平台。

    2026-08-20 起引擎换成**自研的纯 Java XPBD 求解器**，jar 里零 native ——
    macOS、Windows-ARM 现在都能跑，也不再需要 `--enable-native-access`。

    [:octicons-arrow-right-24: 为什么要自己写引擎](engine/index.md#为什么要自己写)

---

## 两套文档

本站和 API 文档分工明确，别在错误的地方找东西：

<div class="grid cards" markdown>

-   **本站** —— 面向服主与玩家

    怎么装、怎么配、怎么用、各系统怎么运作、参数怎么调。

-   **[Javadoc](https://gtedd.github.io/GTRigidPhysics/javadoc/)** —— 面向插件开发者

    每个接口、方法、参数、事件的精确签名与契约。

</div>

---

## 给开发者：一行依赖

```kotlin
repositories {
    maven("https://gtedd.github.io/GTRigidPhysics/")
}

dependencies {
    compileOnly("cn.gtedd:gtrigidphysics-api:1.0.0")
}
```

!!! tip "用 `compileOnly`，不要用 `implementation`"
    API 由服务器上的 GTRigidPhysics 插件在运行时提供。打进自己的 jar 只会造成类冲突，
    报错通常是莫名其妙的 `LinkageError`。

`gtrigidphysics-api` 只有几十 KB，**不含物理实现、不含 packetevents**，
以 **MIT** 授权 —— 闭源插件也可以自由依赖。

[:octicons-arrow-right-24: 完整接入指南](api/index.md)

---

## 许可证

| 部分 | 许可证 |
|---|---|
| `api` / `common` / `physics` 模块（发布到 Maven 的三个构件） | **MIT** |
| 插件本体（`GTRigidPhysics-*.jar`） | **GPL-3.0** |

插件本体以 **GPL-3.0** 授权（作者自选：可使用、必须署名、衍生必须开源）；
API 模块单独按 **MIT** 授权，闭源插件也可依赖。packetevents 是**必须前置插件**，不内嵌。

---

## 帮忙翻译

本站以简体中文写作，其它语言由社区翻译。缺译本的页面会自动回退到中文原文，
并在页首挂一条直通 GitHub 编辑器的链接 —— 看到哪页缺，点一下就能开工。

[:octicons-arrow-right-24: 翻译文档](dev/translating.md)
