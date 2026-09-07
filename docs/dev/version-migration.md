# 版本适配手册

> 这份文档回答：**Minecraft 又更新了，该做什么？**
>
> 以及一个更重要的问题：**怎么让官方的更新成为助力而不是负担。**
>
> 数据截至 2026-08-06。MC 正式版 26.2（2026-06-16），快照 26.3-snapshot-7（每周一发）。

---

## 1. 先看清楚我们站在什么上面

这个项目依赖的东西，没有一个是慢的。

!!! success "有一项已经从这张表上消失了"
    物理引擎曾经是 `jolt-jni`（2026-04 → 2026-07 四个月发了 8 个版本，major 从 4 跳到 6）。
    2026-08-20 换成**自研纯 Java 引擎**之后，这一整层外部依赖没有了 ——
    连带消失的还有三平台 native 分发、`--enable-native-access`、以及 native 内存泄漏这一整类问题。

    这正是当初做那次整改的动机之一。

| 依赖 | 实测节奏 | 破坏性 |
|---|---|---|
| **Minecraft 渲染管线** | 每个版本都改，见 §3.1 | 极高 —— 26.3 直接删掉了本项目在用的后处理效果 |
| **`packetevents`** | 约每月一个小版本 | 中 —— 跟着 MC 协议走 |
| **Paper API** | 跟随 MC 版本 | 低 —— 有明确的弃用政策，见 §4.1 |
| **资源包格式** | 26.2 是 `pack_format: 88`，26.3 是 **95** | 高 —— 一个小版本跳了 7 个格式号 |

**结论不是「要小心」，而是「必须假设它们每个季度都会变，并据此设计边界」。**

好消息是：项目现有的架构在这件事上已经做对了大半。§3.3 有实证。

---

## 2. 耦合面分层

把所有「会随外部更新而失效」的东西按**变化概率**分层。层级决定了它该被放在哪、
以及升级时要花多少精力去查。

| 层 | 内容 | 变化概率 | 隔离手段 |
|---|---|---|---|
| **L0 稳定** | 物理算法、结构分析、预算与 LOD 决策、材质模型 | 几乎不变 | 放 `common`，零外部依赖 |
| ~~**L1 库 API**~~ | ~~物理库的类与方法~~ | —— | **已消失**：引擎自研，物理层不再有外部 API 面 |
| **L2 服务端 API** | Bukkit / Paper 的类与方法 | 每个 MC 版本 | 放 `paper`，走 `api-version` 声明 |
| **L3 网络协议** | 实体 metadata 索引、包结构 | 每个 MC 版本 | 走 packetevents，索引集中成常量 |
| **L4 渲染管线** | 着色器、后处理效果、资源包格式 | **每个版本都改** | 全部关在 `ResourcePack/` 里 |

**这张表就是模块划分的真正理由。** `api` 不依赖 `physics`、`common` 零 Bukkit 零物理实现
这些约束，表面上是洁癖，实际上是在给 L2~L4 的变动划定爆炸半径。

**一个新功能该放哪，先问它属于哪一层。** 如果一段逻辑同时碰了 L0 和 L4，
那它一定写错了 —— 拆开。

---

## 3. 渲染管线（L4）

### 3.1 变更史：每个版本都在改

下表全部来自 [Minecraft Wiki 的 Shader 页面](https://minecraft.wiki/w/Shader)，
按版本整理。**注意没有一个版本是空的。**

| 版本 | 破坏性变更 |
|---|---|
| **1.21.9** (25w31a) | 删除 `post/blit.vsh`、`post/blur.vsh`、`post/invert.vsh`、`post/sobel.vsh`、`post/screenquad.vsh`、`core/blit_screen.vsh`，合并为 `core/screenquad.vsh`；**后处理顶点着色器不再收到 `Position` 属性**，改用 `gl_VertexID` 自行计算；且只跑 3 个顶点而非整个 quad |
| **1.21.9** (25w37a) | **游戏改为要求 OpenGL 3.3 Core Profile**；全部着色器从 GLSL `150` 升到 `330` |
| **1.21.11** (25w44a) | 新增 `core/block.vsh/fsh`，专门渲染「非区块网格的方块」——**下落的沙子、活塞推动的方块**；`core/terrain` 改为线性过滤；新增 `SpriteAnimationInfo` 与 `ChunkSection` uniform 块 |
| **26.1** (snap1) | `core/lightmap.fsh` 基本重写；`LightmapInfo` uniform 块增删改名 |
| **26.1** (snap6) | 删除 `rendertype_item_entity_translucent_cull`、`rendertype_entity_alpha`、`rendertype_entity_decal`，合并进 `core/entity`；物品改用新的 `core/item` |
| **26.1** (snap10) | 删除 `include/smooth_lighting.glsl`，换成 `include/sample_lightmap.glsl`；**`core/particle.vsh` 等一批着色器改了 lightmap 采样方式** |
| **26.1** (pre1) | 删除 `core/rendertype_translucent_moving_block`，并入 `core/block` |
| **26.2** (snap1) | **改用反转深度缓冲**（`post/transparency.fsh` 的深度逻辑随之反转）；text 系列着色器合并；**新增 Vulkan 后端**，Vulkan 下会对着色器做预处理（`gl_VertexID`→`gl_VertexIndex`、`gl_InstanceID`→`gl_InstanceIndex`） |
| **26.3** (snap2) | **用 OIT（顺序无关透明）取代 Improved Transparency**；**`transparency` 后处理效果与 `post/transparency.fsh` 被整个删除**；`rendertype_clouds`→`clouds`、`rendertype_world_border`→`world_border` 等改名；**`#include` 指令语法变更**；新增 8 个 OIT 相关 include 与一批 `OIT_*` 宏 |
| **26.3** (snap3) | **新增 `/posteffect` 命令** —— 见 §3.4，这是机会 |

### 3.2 本项目的暴露面

只有四个文件/目录直接吃这条管线：

| 路径 | 作用 | 已知受影响版本 |
|---|---|---|
| `ResourcePack/assets/minecraft/post_effect/transparency.json` | 挂载滚转后处理 | **26.3 删除，必须换成 `end_of_frame.json`** |
| `ResourcePack/assets/minecraft/shaders/core/particle.vsh` / `.fsh` | 识别数据粒子并画到约定像素 | 26.1 snap10 改了 lightmap 采样 |
| `ResourcePack/assets/shader_selector/shaders/post/*.fsh` | 解码角度、旋转画面 | 1.21.9 的 `gl_VertexID` 变更、26.3 的 `#include` 语法 |
| `ResourcePack/pack.mcmeta` | 格式号声明 | 每个版本（26.2 = 88，26.3 = 95） |

### 3.3 隔离已经生效 —— 有实证

`feature/camera-roll-26.3` 分支做的是「适配 26.3 全新 OIT 管线」这件事，
按说是伤筋动骨。实际改动统计：

```
16 个文件改动，341 行新增，435 行删除
其中 Java 源文件：0 个
```

具体分布：

- `ResourcePack/` 下 11 个文件（删掉 308 行的 `transparency.json`，新增 179 行的 `end_of_frame.json`，
  改写粒子着色器与全部 post 着色器）
- `paper/src/main/resources/camera-roll.yml` 1 个配置文件
- `docs/` 3 篇文档

**一次渲染管线级别的重写，没有碰到任何一行 Java 代码。**

原因在 `ShaderRollProtocol`（`common` 模块）：它定义的是**线路协议**
——「把角度压进一颗粒子的 ARGB 四字节，A=251 与 R=254 双字节校验，
G 是操作码，B 是 8 位角度值」。这个协议与 GLSL 怎么写、
后处理效果叫什么名字、深度缓冲是不是反的，全都无关。

> **这条边界要守住。** 任何时候只要有人想在 Java 侧写「如果是 26.3 就……」，
> 就说明边界正在被侵蚀 —— 正确的做法是把差异吸收进资源包。

### 3.4 官方更新带来的机会（这才是重点）

前面都在讲怎么不被打死。但 26.x 这一轮管线重写里，**有三件事是净利好**，
应当主动去吃：

#### ① `/posteffect` 命令（26.3 snap3）—— 最重要的一件

官方新增了 `posteffect add|remove|clear|list <players> <posteffect>`，
**服务端可以逐玩家增删后处理效果**，且效果本身可以是资源包里自定义的
（`assets/<namespace>/post_effect/`）。官方原话：

> Post effects themselves were already part of the resource pack format,
> but only a few hardcoded ones were available to use.

这直接命中本项目最脏的一处设计。现状是：滚转效果**只能常驻**，
靠劫持 `transparency`（一个本来另有用途的效果）挂上去，
所有装了资源包的玩家全程都在跑这段后处理。

有了 `/posteffect` 之后：

- 效果可以**按需挂载**：只有真正在经历爆炸/坍塌的玩家才挂上，其余人零开销
- 不必再劫持任何原版效果，用自己命名空间下的效果，**从此不受原版增删效果的影响**
- 玩家关掉时可以 `clear`，而不是靠发一个「角度归零」的粒子

**但注意它的边界**：官方明确说「post effects 存在于客户端资源包里，
服务端无法知道某个效果是否真的生效」。而且这个命令只能开关效果，
**不能传参数** —— 「转多少度」这个数值仍然只能走现有的粒子数据通道。
所以 `ShaderRollProtocol` 不会被淘汰，被淘汰的是「劫持 `transparency`」这个挂载方式。

> **行动项**：26.3 正式版发布后，把 `end_of_frame.json` 改为自有命名空间下的效果，
> 挂载改走 `/posteffect`，并保留资源包常驻方式作为回退（服主可能停在旧版本）。

#### ② OIT（26.3 snap2）

新的顺序无关透明算法「预期能显著改善半透明物体的表现」。
本项目大量使用 `BlockDisplay` 渲染碎块，其中玻璃、冰、树叶等半透明方块
在旧的排序透明下常有穿插错误。**这是白拿的观感提升，不需要改代码**，
但值得在 26.3 适配后做一次视觉验收（见仓库内的 `docs/internal/acceptance-checklist.md`）。

#### ③ Vulkan 后端（26.2 snap1）与 `core/block` 着色器（1.21.11）

- **Vulkan** 给客户端 FPS 留出了新的上限空间。本项目的瓶颈是带宽而非客户端渲染
  （`DESIGN.md` §2），但「display entity 的客户端 FPS 上限」一直是个未实测的风险项
  （§9 风险表），Vulkan 普及后这个风险会自然缓解。**要做的事：重测那条基准。**
- **`core/block`** 是官方专门为「下落的沙子、活塞推动的方块」新建的着色器。
  这类物体与本项目的碎块在渲染语义上高度接近，
  未来若官方继续扩展这条路径，可能出现比 `BlockDisplay` 更合适的载体。**保持关注。**

#### ④ 一条要警惕的：`gl_VertexID` 与 Vulkan 预处理

26.2 起 Vulkan 下会把 `gl_VertexID` 自动替换成 `gl_VertexIndex`。
这意味着**着色器必须在 OpenGL 与 Vulkan 两个后端下都验证**，
而玩家用哪个后端服务端并不知道。26.2 snap1 还有过一个 bug（MC-307311）
导致 Vulkan 下资源包着色器根本加载不了 —— 这类问题只能靠真机双后端验收发现。

### 3.5 渲染管线升级手册

MC 出新版本时，按顺序做：

1. **读变更日志**。[Minecraft Wiki 的 Shader 页面](https://minecraft.wiki/w/Shader)
   有逐快照的着色器变更表，比任何二手资料都全。重点看：
   删除/改名的着色器、uniform 块的增删、`#include` 语法、深度约定。
2. **对照 §3.2 的暴露面清单**，逐项判断是否受影响。
3. **开一个 `feature/camera-roll-<版本>` 分支**，只改 `ResourcePack/` 与配置。
   **如果发现必须改 Java，先停下来想清楚为什么** —— 大概率是边界被侵蚀了。
4. **更新 `pack.mcmeta`** 的 `pack_format` / `min_format`。
   格式号可在 [Pack format 页面](https://minecraft.wiki/w/Pack_format)查，不要猜。
5. **双后端真机验收**：OpenGL 与 Vulkan 各跑一遍
   面板 addon 的「视角效果」页自测，确认画面确实倾斜且能扳回。
6. **确认 Sodium 等优化 mod 的兼容性**。历史上 Sodium 会覆盖原版管线导致效果失效；
   26.3 起官方 OIT 之后这个冲突面缩小了，但仍要实测。
7. 合回 main，更新[视角滚转系统](../features/camera-roll.md)文档。

---

## 4. 服务端 API（L2 / L3）

### 4.1 Paper API 与弃用政策

Paper 有明确的[弃用政策](https://docs.papermc.io/paper/dev/roadmap/)：

- 标了 `@Deprecated` 的 API 仍可用，但不承诺不会进一步被标记为待移除
- 标了 `forRemoval` + `@ApiStatus.ScheduledForRemoval` 的，**只会在 MC 大版本上移除**，
  且会留出足够的迁移时间

**实践规则**：

- 构建时**不要屏蔽 deprecation 警告**。它是免费的预警系统 ——
  项目已经做过一轮「清废弃 API 到零警告」，这个状态要守住。
- `paper-plugin.yml` 的 `api-version` 声明目标版本（当前 `26.2`）。
  低于这个版本的服务器会拒绝加载插件，这是**特性不是缺陷**：
  与其让插件在不兼容的服务端上以奇怪的方式半死不活，不如干脆不加载。

### 4.2 实体 metadata 索引 —— 最危险的一处

`DESIGN.md` §5.7 记录了 26.2 实证得到的 Display entity metadata 索引表
（`TRANSLATION`=11、`LEFT_ROTATION`=13、`BLOCK_STATE`=23 等）。
这张表是**反汇编 Mojang jar 得到的**，不是任何公开 API 的一部分。

> **升级 MC 版本时必须重新验证这张表。**

索引变化不会编译失败、不会抛异常，症状是「碎块全部糊成一坨」
或者「方块外观变成空气」——而且很可能只在某些方块类型上出现。

**验证方式**（按可靠性排序）：

1. 反汇编目标版本的 `net/minecraft/world/entity/Display.class`，
   按 `SynchedEntityData.defineId` 的调用顺序推定
2. 对照 packetevents 对应版本的实现
3. 真机上生成一个骰子，肉眼确认位置/朝向/外观三项都对

**索引集中在一个地方：`common/view/DisplayMetadata.java`。升级时只改这一处。**

这曾经是五份拷贝（`PhysicsObject`、`PhysicsRagdoll`、`PhysicsCharacter`、
`ClusterView`、`FieldView` 各写一份），已于 2026-08-06 合并（`DESIGN.md` §25.9）。
合并的理由值得记住，因为它适用于所有版本耦合的常量：

> 五份拷贝是**升级成本的乘数** —— 每次 MC 升级要改五个地方，
> 而漏掉一份的症状是「骰子和碎块都正常，只有布娃娃糊了」
> 或者「黑洞的外观变成空气」这类局部错乱。
> 人的第一反应绝不会是「metadata 索引表错了」，于是要查很久。
> 一份拷贝把「五次犯错机会」压成一次。

**配套的绊线**：`DisplayMetadataTest` 会断言三件事 ——
索引互不重复、都落在 Entity 基类的 8 个槽位之后、以及**与 26.2 基线值逐一相等**。
最后一条是有意为之：任何人改了索引，这条测试就会红，
强制他确认是否已按本手册重新验证过，并同步更新测试与 `DESIGN.md` §5.7。

**另一个易混点**（合并时顺带修掉的）：不要把 `DisplayMetadata.TELEPORT_DURATION`
（metadata **索引**，值 10）和各表现类里的 `TELEPORT_TICKS`
（往那个索引里**写的值**，2 tick）搞混。它们原本都叫 `TELEPORT_DURATION`。

### 4.3 packetevents

packetevents 是**前置插件**而非内嵌依赖（`DESIGN.md` D8），
所以服主可能装着比我们编译时更新或更旧的版本。

- 升级 MC 版本时，先确认 packetevents 已支持目标版本（看它的 release note）
- `libs.versions.toml` 里的版本号是**编译期**版本；运行期以服主装的为准
- 因此**不要用 packetevents 的内部 API**，只用公开的 wrapper 类

### 4.4 Mojang 官方服务端方向

目前没有官方的服务端插件 API，Paper 仍是唯一现实选择。
但有两个信号值得跟进：

- **Minecraft Server Management Protocol**（26.2 已到 3.0.0）—— 目前只覆盖运维管理
  （心跳、状态查询），与插件 API 无关，但说明 Mojang 在正式化服务端的对外接口
- **`/posteffect` 这类命令**（§3.4）—— Mojang 正在把过去只能靠 hack 实现的客户端表现
  开成官方的、服务端可控的接口。**这个趋势对本项目是纯利好**，
  每出现一个这样的命令，就有一处 hack 可以退役

---

## 5. 物理引擎（原 L1）：这一层已经不存在了

引擎自研之后，物理层**没有任何外部 API 面**可跟。

原先这一节写的是「怎么升 jolt-jni」：改版本号、跑冒烟测试、读 sources jar 查 API 变更、
关注 native 体积、保证三平台覆盖不退化。这些工作现在**一件都不需要做**。

替代它的是另一类工作 —— **求解器自己的回归**：

| 要盯的 | 怎么盯 |
|---|---|
| 改了求解器常量之后手感是否退化 | `physics` 模块的标定测试（摩擦、重力系数、地形对齐、撞击记录） |
| 改了碰撞形状 / 合盒之后几何是否等价 | 质量、质心、惯性张量应当一个数都不变 |
| 改了接触生成之后是否引入幽灵碰撞 | 平地滑行不应被横推 |

!!! important "求解器常量不是配置项"
    `SUB_STEPS`、`POSITION_ITERATIONS` 这些写死在代码里，改它们不是「换一种手感」而是
    「可能解不出来」。动之前先读[引擎总览 · 那些写死的数字](../engine/index.md#那些写死的数字)。

已知的量化偏差（恢复系数欠松弛、动摩擦偏低、落坑容差）列在
[性能与上限](../engine/limits.md#已知偏差)，调参前先读一遍，否则会把它们当成 bug 去追。

---

## 6. 版本支持矩阵与分支模型

### 6.1 只支持一个 MC 版本

**这是一个决策，不是懒惰。**

理由：项目的表现层是**裸发包**（`DESIGN.md` D8），metadata 索引、包结构、
着色器管线三者全都绑死在具体协议版本上。做多版本兼容意味着
维护三套索引表 + 三套着色器 + 一层反射抽象，
而收益是让停在旧版的服主也能用 —— 这笔账在当前的人力下算不过来。

| | 策略 |
|---|---|
| **主线支持** | 最新正式版（当前 26.2） |
| **新版本适配** | MC 正式版发布后开分支适配，验收通过后合入 main 并发新版本 |
| **旧版本** | 保留最后一个支持该版本的 tag，不再回补 |

服主停在旧版本时，`api-version` 会让插件直接拒绝加载 —— 这是明确的失败，
好过加载成功然后碎块糊成一坨。

### 6.2 分支模型

```
main                    ← 始终对应「当前支持的 MC 正式版」，始终可发布
 ├─ feature/<主题>       ← 功能开发，合入前必须全量测试绿
 └─ feature/camera-roll-<版本>   ← MC 版本适配，只碰 ResourcePack 与配置
```

**MC 版本适配单独开分支的理由**：快照期的适配是「跟着快照反复改」的，
而快照本身会变（26.2 snap1 的 Vulkan 加载 bug 到 snap2 才修）。
放在独立分支上，main 始终对应一个已验收的稳定组合。

`feature/camera-roll-26.3` 就是当前的实例：代码已就绪（66f168e），
**待 26.3 正式版发布 + 真机双后端验收**后合入。

### 6.3 一个版本组合就是一个「已验收的四元组」

发布时要记录的不只是插件版本，而是：

```
GTRigidPhysics 1.0.0
  ├─ Minecraft   26.2
  ├─ Paper API   26.2.build.65-beta
  ├─ packetevents 2.13.0（前置，最低版本）
  └─ pack_format 88
```

这四项里任何一项变了，都要重新过一遍验收。写进 release note，
服主报问题时第一步就是核对这个四元组。

（这里从前还有一行 `jolt-jni 6.0.0` —— 引擎自研之后不再需要记录它。）

---

## 7. 升级操作总表

MC 出新正式版时，逐项勾。**没勾完不合 main。**

### 准备

- [ ] 读 [Shader 页面](https://minecraft.wiki/w/Shader)的变更表，列出受影响的着色器
- [ ] 确认 packetevents 已发布支持该版本的版本
- [ ] 确认 Paper 已有该版本的 API 构建
- [ ] 查 [Pack format](https://minecraft.wiki/w/Pack_format) 确定新的格式号

### 渲染管线（L4）

- [ ] 对照 §3.2 的四项暴露面逐项适配
- [ ] 更新 `pack.mcmeta` 的 `pack_format` / `min_format`
- [ ] **确认没有改动任何 `.java` 文件** —— 改了就说明边界被侵蚀，回去想清楚
- [ ] OpenGL 后端真机验收（面板 addon 的「视角效果」页）
- [ ] Vulkan 后端真机验收（26.2 起）
- [ ] Sodium 等优化 mod 共存验收
- [ ] 评估本版本有没有新的官方能力可以替换掉现有 hack（参考 §3.4）

### 服务端 API（L2 / L3）

- [ ] **重新验证 Display entity metadata 索引表**（§4.2）——
      只需改 `common/view/DisplayMetadata.java` 一处，
      改完 `DisplayMetadataTest` 的基线断言会红，同步更新它与 `DESIGN.md` §5.7
- [ ] 更新 `paper-plugin.yml` 的 `api-version`
- [ ] 更新 `libs.versions.toml` 的 `paper-api` 与 `packetevents`
- [ ] 构建无 deprecation 警告；有的话逐条迁移而不是屏蔽

### native（L1）

- [ ] 三平台 native 齐全（Windows64 / Linux64 / Linux_ARM64）

### 验收

- [ ] `./gradlew build -PrunTests` 全量绿
- [ ] 走一遍 `docs/internal/acceptance-checklist.md`
- [ ] release note 里写全 §6.3 的版本四元组
- [ ] 更新[视角滚转系统](../features/camera-roll.md)与[配置指南](../guide/config/index.md)

---

## 8. 一句话总结

**把每个版本都会变的东西（渲染管线）关进资源包，把每季度会变的东西（native 库）
关进 `physics`，把不变的东西（物理与决策逻辑）放进 `common`。**

26.3 的管线重写没有碰一行 Java 代码，说明这套边界是成立的。
后续要做的不是加固它，而是**守住它**，并在每次官方开放新能力时
（`/posteffect` 是第一个）主动退役掉一处 hack。
