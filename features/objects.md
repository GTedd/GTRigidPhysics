# 物体模板总览

「物体模板」是一组标定好的独立物理物体参数：骰子、载具、多米诺、趣味物件。
它们与坍塌碎块走**同一套物理**，区别只在生命周期 —— 碎块是一次性的，物体是常驻的。

---

!!! warning "当前状态：模板库在引擎里，但没有内置的生成入口"
    引擎瘦身把 `/gtrp spawn` 命令与内置面板一起迁出了，
    而现有的 [panel-addon](../../addons/panel.md) 只提供三种形态（骰子 / 木板 / 大立方体）× 六种外观方块，
    **没有覆盖下面这 21 个模板**。

    `paper/template/ObjectTemplates.java` 里的模板定义仍在引擎 jar 内，但目前**没有任何调用方**
    （`TestStructures` 同理）。

    所以这一组页面现在的定位是**参数参考表** —— 这些数值是标定过的，
    用 `bodies().spawn(SpawnOptions...)` 照着填就能复现同样的手感。
    见[接入 API · 刚体](../../api/bodies.md)。

---

## 二十一个模板

### 骰子（6）

半边长 `a`，质量统一 17。

| id | 名称 | 半边长 | 外观方块 |
|---|---|---|---|
| `dice_4` | 四面骰子 | 0.45 | `DIAMOND_BLOCK` |
| `dice_6` | 六面骰子 | 0.25 | `GOLD_BLOCK` |
| `dice_6_s` | 实心六面骰子 | 0.25 | `IRON_BLOCK` |
| `dice_8` | 八面骰子 | 0.30 | `EMERALD_BLOCK` |
| `dice_10` | 十面骰子 | 0.50 | `LAPIS_BLOCK` |
| `dice_12` | 十二面骰子 | 0.24 | `AMETHYST_BLOCK` |

[详细参数 →](dice.md)

### 载具（6）

| id | 名称 | 半长 (x, y, z) | 质量 | 外观方块 | 多部件 |
|---|---|---|---|---|---|
| `test_car` | 测试车 | 0.5 × 0.3 × 1.0 | 50 | `OAK_PLANKS` | ✔ |
| `green_car` | 绿车 | 0.6 × 0.4 × 1.0 | 50 | `GREEN_WOOL` | ✔ |
| `test_boat` | 测试船 | 0.5 × 0.3 × 1.0 | 50 | `OAK_BOAT` | — |
| `lite_vehicle` | 轻量载具 | 0.4 × 0.25 × 0.8 | 35 | `SPRUCE_PLANKS` | — |
| `truck` | 卡车 | 0.85 × 0.4 × 1.3 | 70 | `IRON_BLOCK` | ✔ |
| `motorcycle` | 摩托 | 0.3 × 0.35 × 1.2 | 20 | `RED_WOOL` | ✔ |

[详细参数 →](vehicle.md)

### 连锁物理（3）

| id | 名称 | 尺寸 | 质量 | 外观方块 |
|---|---|---|---|---|
| `domino` | 多米诺骨牌 | 1.0 × 0.1 × 2.0 | 50 | `QUARTZ_BLOCK` |
| `plank` | 木板 | 1.0 × 0.1 × 2.0 | 1 | `OAK_SLAB` |
| `slime_block` | 史莱姆方块 | 1.0 × 1.0 × 1.0 | 17 | `SLIME_BLOCK` |

[详细参数 →](domino-and-plank.md)

### 趣味物体（6）

| id | 名称 | 尺寸 | 质量 | 外观方块 |
|---|---|---|---|---|
| `skip_stone` | 打水漂 | 0.4 × 0.15 × 0.4 | 5 | `STONE_BUTTON` |
| `roll_head` | 滚头 | 0.25 立方 | 17 | `JACK_O_LANTERN` |
| `impulse_lamp` | 大懒灯 | 0.25 立方 | 17 | `GLOWSTONE` |
| `throwable_tnt` | 可投掷 TNT | 1.0 立方 | 17 | `TNT` |
| `windmill` | 风车 | 0.4 立方 | 30 | `IRON_BLOCK` |
| `piston` | 活塞 | 0.35 立方 | 30 | `PISTON` |

[详细参数 →](fun-objects.md)

!!! note "尺寸的单位约定不统一"
    骰子、趣味物体给的是**半边长**（`halfExtent`），载具与连锁物理给的是**半长三元组**
    或**全尺寸**（多米诺那一行的 `1.0 × 0.1 × 2.0` 是构造器里写的三个数，语义是半长）。

    照着抄进 `SpawnOptions.halfExtents(...)` 时按半长理解。

---

## 惯量不需要你算

`SpawnOptions` 只要求给**尺寸与质量**，惯性张量由引擎的 `MassProperties` 从盒集合解析地算出来 ——
包括非对角的惯性积。

!!! important "这一点比看起来重要"
    不少体素物理实现会把惯性张量简化成球形近似。对细长的柱子、薄板、骨牌来说，
    绕长轴与绕短轴的转动惯量差着一个数量级 —— 球形近似会让骨牌像哑铃一样绕自己的长轴翻滚。

    详见[质量与惯性张量](../../engine/mass.md)。

---

## 生成流程

```
SpawnOptions（位置 + 外观方块 + 尺寸 + 质量 + 类型）
        ↓  api.bodies().spawn(options)
主线程：分配虚拟实体 id，排队到物理线程
        ↓
物理线程：BoxMerge 合盒 → BodyShape 采样 → MassProperties → 加入 ObjectPhysicsWorld
        ↓  body.broadcastTo(world)
表现层：按距离逐玩家发生成包，之后每 broadcast-interval-ticks 发一次位姿
```

!!! warning "别忘了 `broadcastTo`"
    不广播的物体在物理世界里**存在、会碰撞、能被查询到，但没有任何玩家看得见**。

---

## 性能特征

| 模板类型 | 刚体数 | 虚拟实体数 | 说明 |
|---|---|---|---|
| 单体（骰子 / 趣味物体） | 1 | 1 根 + 1 乘客 | 平移 1 个包，旋转 1 次 metadata |
| 连锁（多米诺一排） | N | N 组 | 每块独立，连锁效应由接触求解自然产生 |
| 载具（多部件） | 1 车身 | 1 根 + 车身 + 每轮各 1 | 轮子位姿由载具控制器单独给 |
| 机关（风车 / 活塞） | 1 + 1 约束 | 1 根 + 1 乘客 | 马达驱动，见[约束系统](../../engine/constraints.md) |

所有独立物体共享**同一个** `ObjectPhysicsWorld`。
不同 Minecraft 世界的物体互不碰撞、互不可见 —— 靠碰撞分组隔离，每个世界分到一对层（静态 + 动态）。

带宽闸门在 `view.yml` 的 `objects` 段，与坍塌那套分开配 ——
坍塌是几秒钟的一次性事件，独立物体是**常驻**的，同样的限额累计代价大得多。
见[表现层配置](../../guide/config/view.md)。

---

## 相关

- [接入 API · 刚体](../../api/bodies.md) —— `SpawnOptions` 完整用法
- [物理材质](../materials.md) —— 外观方块决定物理参数
- [引擎总览](../../engine/index.md) —— 两种运动模型
- [载具 addon](../../addons/vehicle.md) —— 一个完整的物体玩法系统长什么样
