# `impact.yml` —— 撞击后果

物理方块高速撞上真实方块 / 生物时的后果。

系统说明见[撞击后果](../../features/impact.md)。

---

## 两条链路

任何被物理化的方块（法杖操控的独立物体、坍塌碎块）高速撞上真实方块时，按材质产生后果：

| 材质类型 | 判据 | 后果 |
|---|---|---|
| **脆**（`fracture-speed` 配得低，如玻璃 / 树叶） | 撞击速度超过**自己的**阈值 | 自己碎 |
| **硬**（`fracture-speed` 不配 = 永不碎，如石头） | 撞击速度超过 `min-break-speed` | **砸坏被撞的方块** |

材质侧的 `fracture-speed` 在 [`materials.yml`](materials.md) 配；本文件只控制「碰撞后果」这个机制。

---

## 键表

```yaml
enabled: true
min-break-speed: 9.0
blocks-per-tick: 4
object-cooldown-ticks: 5
max-crater-per-collapse: 96
```

| 键 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 关闭后碰撞不产生任何后果（物体照常碰撞、停下、弹开，但不破坏任何东西） |
| `min-break-speed` | 9.0 | 砸坏被撞方块的最低撞击速度（m/s） |
| `blocks-per-tick` | 4 | 主线程每 tick 最多破坏多少格 |
| `object-cooldown-ticks` | 5 | 同一物体两次撞击处理的最短间隔（tick）。5 tick = 0.25 秒 |
| `max-crater-per-collapse` | 96 | 每场坍塌最多砸出多少个坑 |

### `min-break-speed` 与重力绑定

换算式 `v = √(2gh)`，`g` 取 [`physics.yml`](physics.md) 的 `gravity`（默认 9.81）：

| 落差 | 着地速度 |
|---|---|
| 1 格 | ≈ 4.4 |
| 2 格 | ≈ 6.3 |
| 3 格 | ≈ 7.7 |
| 4 格 | ≈ 8.9 |
| 5 格 | ≈ 9.9 |

默认 9.0 意味着「**从 4 格多摔下来**」才砸地 —— 日常投掷不误伤地形。
骰子轻轻滚到脚边不该砸出坑。

!!! danger "改重力要跟着改这里"
    把重力改成原版尺度的 `-16` 之后，同样的落差有 **1.28 倍**的着地速度，
    本项要跟着乘 1.28（`9.0 → 11.5`），否则日常投掷就开始砸坑。

### 三道限流各拦什么

| 键 | 拦什么 |
|---|---|
| `blocks-per-tick` | 破坏（`setBlock`）触发光照与区块标脏。不限流一次大撞击就能卡住主线程 |
| `object-cooldown-ticks` | 高速物体连续多帧接触触发重复破坏 |
| `max-crater-per-collapse` | 坍塌碎块成百上千，全砸地会把地面挖成筛子 |

`max-crater-per-collapse` 设为 `0` 可以**单独关掉坍塌的硬砸地**，独立物体的撞击不受影响。

---

## 废墟砸伤生物

```yaml
crush:
  enabled: true
  damage-per-block: 2.0
  max-damage: 40.0
  min-fall-blocks: 1.0
```

碎块走的是 packet 虚拟实体（[`view.yml`](view.md) 的 `root-entity-type` 默认 `BLOCK_DISPLAY`，
**零碰撞箱**），所以在此之前一整栋楼砸在玩家头上，玩家会毫发无损地从碎块中间穿过去。

### 判据是「真的被埋了」

生物的碰撞箱与废墟的**最终落点**重叠。

**不判「下落途中擦身而过」**：那要每帧对所有簇做实体查询，代价高一个数量级，
而擦身而过本来也不该造成多少伤害。

### 伤害量按原版的口径

原版对落体伤害一律用「掉了几格」表达（铁砧 2 点/格、上限 40），玩家对这套数值有肌肉记忆。

所以这里先把撞击速度还原成落差（`h = v² / 2g`），再套同一个公式。

| 键 | 默认 | 说明 |
|---|---|---|
| `damage-per-block` | 2.0 | 每格落差造成多少点伤害。与原版铁砧一致 |
| `max-damage` | 40.0 | **单场坍塌**对同一个生物的伤害上限。与原版铁砧一致 |
| `min-fall-blocks` | 1.0 | 落差不足这么多格不造成伤害。废墟在脚边挪一格不该扣血 |

!!! note "伤害是逐簇结算的"
    一栋楼由许多簇组成，压在你身上的每一簇各算一次 ——
    所以**大坍塌天然比小坍塌疼**，不需要额外的体积系数。

    `max-damage` 才是真正的天花板。

---

## 相关

- [撞击后果](../../features/impact.md) —— 系统说明
- [`materials.yml`](materials.md) —— `fracture-speed` 决定谁是脆的
- [`physics.yml`](physics.md) —— 重力与本表的绑定
- [`collision.yml`](collision.md) —— 让玩家能**主动打**碎块是另一套机制
