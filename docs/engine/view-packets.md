# 骑乘组发包系统

## 概述

GTRigidPhysics 的碎块表现全部走 packetevents 裸发包构造的**虚拟实体**——它们只以数据包形式存在于客户端，服务端不为其创建任何 `Entity` 对象。这是绕开 Paper entity tracker 性能瓶颈的关键设计（DESIGN.md 2.1：50,000 个 display entity 的 profiler 显示 60% tick 花在 tracking 上）。在此之上，通过**骑乘组**结构将平移一个簇的带宽成本从 O(方块数) 降到 O(1)，是本项目最重要的带宽优化。

参考：DESIGN.md 5.1、5.7、13.3。

---

## 骑乘组的工作原理

### 结构

一个簇（最多 64 个方块）的客户端表现由以下实体组成：

| 角色 | 实体类型 | 数量 | 可见性 | 职责 |
|---|---|---|---|---|
| 根实体 | `BlockDisplay`（空 block_state） | 1 | 不可见 | 载具，接收 teleport 包驱动整个簇平移 |
| 乘客 | `BlockDisplay` | N（簇内方块数） | 可见 | 通过 `translation` 分量摆出簇内相对位置，各自显示对应的 `block_state` |

**根实体为什么是 `BlockDisplay` 而不是 `Interaction`**：这条选择是碎块下落是否平滑的决定性因素。

最初使用 `Interaction` 当载具，结果碎块一顿一顿地掉落。原因在客户端的 `Entity.moveOrInterpolateTo` 逻辑中：

- `BlockDisplay` 覆写了 `getInterpolation()`，走 interpolator 通道，按 `teleportDuration` 逐 tick 插值
- `Interaction` **没有**覆写该方法，每个位置包都是硬瞬移，客户端只剩 1 tick 的 `xo→x` 渲染插值兜底。发包间隔 2 tick 时就是"动一帧、停一帧"

换成 `BlockDisplay` 当载具是**零成本替换**：两者都 `sized(0, 0)`，`PASSENGER` 挂点都是 `(0, 0, 0)`；`BlockDisplay` 的 block_state 默认空气，不发这项 metadata 就什么都不渲染——天然是个隐形载具。

乘客的 `translation` 布局一个字都不用改。

### 关键机制：乘客为什么不需要 teleportDuration

因为乘客**从来收不到位置包**。原版 `ServerEntity` 对 `isPassenger()` 的实体只发 Rot 包，位置分支整个跳过。客户端的乘客定位是每 tick 由 `vehicle.positionRider(passenger)` 硬算并 `setPos` 覆盖。乘客身上的 `teleportDuration` 永远没有介入的机会。

而 `tickNonPassenger` 的顺序是"先 `entity.tick()`、再遍历乘客定位"——载具是 `BlockDisplay` 时，`tick()` 里已经完成了这一 tick 的插值推进，**乘客拿到的正是插值之后的位置**。整条链路因此平滑。

---

## 包结构分析

下面是生成、操作、销毁一个簇所需的完整包序列：

| 操作 | 包数 | 复杂度 | 说明 |
|---|---|---|---|
| 生成一个簇 | `1 + 1 + 2N + 1` | O(N)，仅一次 | 根 spawn + 根 metadata + N×(display spawn + metadata) + setPassengers |
| **平移一个簇** | **1** | **O(1)** | 根实体 teleport |
| 旋转一个簇 | N | O(N) | 每乘客一次 metadata（translation 旋转 + 左旋转 + 插值参数） |
| 销毁一个簇 | 1 | O(1) | 批量 destroyEntities |

### 生成包的严格顺序

**顺序不可对调**：

1. **根实体** spawn + metadata（设 teleportDuration）
2. **乘客**逐个 spawn + metadata（设 blockState、translation、scale、interpolationDuration）
3. **最后**发 `SetPassengers` 建立骑乘关系

骑乘关系如果发早了，客户端还不知道那些乘客实体的存在，会静默失败——碎块不显示。

### 包类型与用途

| Wrapper | 用途 |
|---|---|
| `WrapperPlayServerSpawnEntity` | 生成虚拟 block_display / 骑乘根实体 |
| `WrapperPlayServerEntityMetadata` | 设置 block state、transformation、插值参数 |
| `WrapperPlayServerEntityTeleport` | 骑乘组根实体的位置更新（**主力带宽消耗**） |
| `WrapperPlayServerSetPassengers` | 建立骑乘组 |
| `WrapperPlayServerDestroyEntities` | 批量回收（一簇一个包） |

---

## 实体 ID 池设计

### 虚拟实体 ID 的分配策略

本项目碎块全部是纯客户端虚拟实体，服务端不为其创建 `Entity` 对象。因为服务端不知道它们，ID 必须由插件自行分配，且**绝不能与真实体撞号**——撞号会让客户端把碎块数据当成某个真实体的更新，表现为实体瞬移、消失或渲染错乱。

```java
// 起始 ID：2^27 = 134,217,728
private static final int START = 1 << 27;
private static final AtomicInteger NEXT = new AtomicInteger(START);
```

从 `2^27` 往下递减分配，原版服务端实体 ID 从 1 起递增——两端相向而行，要撞上得在单次运行里生成 1.3 亿个实体，实际游戏中永远不可能。

### 为什么不是 Integer.MAX_VALUE

协议里实体 ID 走 varint 编码。varint 在大于等于 2^28 时占 5 字节，低于则只要 4 字节。实体 ID 是本插件出现频率最高的字段（每个 teleport、每条 metadata、每个 spawn 都带），从 MAX_VALUE 起分配等于给每一次出现都多付 1 字节。取 2^27 既能保持"相向而行不变"，又能拿回那 1 字节。

### 批量分配

`allocate(int count)` 用 `getAndAdd(-count)` 一次占住整段，保证一个簇的所有实体 ID 连续，便于调试时辨认，同时避免并发下被别的簇插进来打散。

---

## Display Entity Metadata 索引表

以下为 26.2 实证的全部索引（来源：反汇编 `Display.class` 与 `BlockDisplay.class` 的 `<clinit>`，按 `SynchedEntityData.defineId` 调用顺序推定）：

| index | 字段（Mojang 名） | 序列化类型 | 用途 |
|---|---|---|---|
| **8** | `TRANSFORMATION_INTERPOLATION_START_DELTA_TICKS` | INT | `interpolationDelay` |
| **9** | `TRANSFORMATION_INTERPOLATION_DURATION` | INT | `interpolationDuration`，**姿态通道** |
| **10** | `POS_ROT_INTERPOLATION_DURATION` | INT | `teleportDuration`，**位置通道**，取值 0~59 |
| **11** | `TRANSLATION` | VECTOR3 | 骑乘组摆位靠它 |
| **12** | `SCALE` | VECTOR3 | 必须显式发 (1,1,1)，网络默认值不是 (1,1,1) |
| **13** | `LEFT_ROTATION` | QUATERNION | 碎块姿态靠它 |
| **14** | `RIGHT_ROTATION` | QUATERNION | |
| **15** | `BILLBOARD_RENDER_CONSTRAINTS` | BYTE | 碎块用 FIXED |
| **16** | `BRIGHTNESS_OVERRIDE` | INT | |
| **17** | `VIEW_RANGE` | FLOAT | per-player LOD 可做廉价剔除 |
| **18** | `SHADOW_RADIUS` | FLOAT | |
| **19** | `SHADOW_STRENGTH` | FLOAT | |
| **20** | `WIDTH` | FLOAT | |
| **21** | `HEIGHT` | FLOAT | |
| **22** | `GLOW_COLOR_OVERRIDE` | INT | |
| **23** | `BLOCK_STATE`（BlockDisplay 独有） | BLOCK_STATE | 碎块外观 |

> 该布局与社区流传的 1.20 时代索引表一致，26.2 未发生变更。但本表是针对目标版本实证得出的，**升级 MC 版本时必须重新反汇编验证**。

在代码中，相关常量如下：

```java
private static final int MD_INTERPOLATION_DELAY = 8;
private static final int MD_INTERPOLATION_DURATION = 9;
private static final int MD_TELEPORT_DURATION = 10;
private static final int MD_TRANSLATION = 11;
private static final int MD_SCALE = 12;
private static final int MD_LEFT_ROTATION = 13;
private static final int MD_BLOCK_STATE = 23;
```

---

## 两条独立插值通道

Display Entity 的位置和姿态通过**两条互不耦合**的插值通道驱动，这是表现层设计的基础：

### 位置通道：`teleportDuration` (index 10)

- 走 `ClientboundTeleportEntity` 包
- **只作用于根实体**——乘客人来收不到位置包，位置是客户端每 tick 通过 `vehicle.positionRider(passenger)` 硬算的
- `teleportDuration` 取值 0~59 tick。必须等于广播间隔：短了会走完后冻结几 tick，长了会被下一个包打断并重置速度——两种都是肉眼可见的顿挫

### 姿态通道：`interpolationDuration` (index 9) + `interpolationDelay` (index 8)

- 走 metadata 包，作用于 Transformation 的四个分量（translation、scale、left_rotation、right_rotation）
- 乘客的旋转更新全靠这条通道

### 两条通道的两个坑

**1. 分量耦合**：Transformation 的四个分量会**一起**被插值。如果骑乘组摆位用的 `translation` (index 11) 在运行时被修改了，每次姿态插值都会把它一起插——碎块的相对布局会"滑开"。所以 `translation` 只在生成时写一次，之后只改 `left_rotation`。

**2. 反向插值**：客户端会选最短旋转路径，可能导致反向旋转。碎块翻滚是大角度连续旋转，这个坑必踩。需要在关键帧之间保证四元数点积为正（必要时取反）。

---

## 骑乘偏移为零的设计

根实体的 `width` 和 `height` 均设为 0。这在 `EntityAttachment.PASSENGER` 的计算中意味着乘客的挂点偏移为 `(0, 0, 0)`——乘客的 `translation` 值直接就是它相对于根实体位置的世界偏移，无需任何位置补偿。

这与 ArmorStand 路线完全不同：ArmorStand 带有固定的骑乘偏移（约 y=0.375），且需要额外处理 `invisible`/`marker` 标志位。`Interaction` 和 `BlockDisplay` 的 `size(0, 0)` 天然避免了这些麻烦。

---

## 发包方式：writePacketSilently + 手动 flush

所有发包走 `writePacketSilently` 而非 `sendPacket`，理由两条：

1. `sendPacket` 会为**每一个包**构造 `PacketSendEvent` 并遍历全服监听链。这些是我们的虚拟实体，没有任何插件需要观察——纯开销。
2. `sendPacket` 每个包都 `writeAndFlush` 一次。稳态下这是每秒近十万次 flush 系统调用。改成"攒完一个观众的全部包再 flush 一次"后降到每秒百余次。

代价是调用方（`ActiveCollapse`）必须在处理完每个观众后统一 `flush`，否则包会一直躺在出站缓冲里发不出去。

---

## 使用边界与注意事项

- **簇内方块数上限 64**（即网格边长 4 的三次方）。这不是虚拟实体的限制，而是旋转配额的考量：旋转整个簇要给每个乘客各发一次 metadata，64 个方块的簇旋转一次就是 64 个包，比平移贵约 10 倍。
- **骑乘关系包必须最后发**。顺序错了客户端不知道乘客实体的存在，碎块不显示且不报错，排查困难。
- **每帧生成配额**必须设上限（默认 8 簇/帧/观众）。一场大坍塌中簇数可达数百，若在第一帧全推给所有观众，是几十万次发包压进单个 tick——先卡死主线程，再撑爆出站缓冲，玩家看到的是几秒空白后碎块从半空"补"出来。
- **旋转配额（R1）**只给最近的 N 个方块发姿态数据，远处只平移。远处碎块是否翻滚在视觉上无法分辨，但带宽差 10 倍。
- **destroy 必须批量**。一簇一个 `DestroyEntities` 包，不要逐个实体删除。
- **升级 MC 版本时必须重新反汇编验证 metadata 索引表**。这些索引号没有 API 保证，可能在新版本中变化。
- 根实体和乘客的 `teleportDuration`/`interpolationDuration` 必须等于广播间隔 tick 数。不等会导致肉眼可见的顿挫。
