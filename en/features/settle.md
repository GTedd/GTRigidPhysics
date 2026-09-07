# 落地规则系统

## 概述

落地是倒塌**真正改变世界**的一步。没有它，整套物理就只是一段华丽的特效：碎块翻滚一阵然后凭空消失，地形毫发无损。有了它，废墟才会真的堆在那里。

落地是一次**有损还原**——碎块休眠时的位姿是连续的（位置带小数、姿态是任意四元数），而方块只能待在整数格上。`SettlePlanner` 处理取整、撞车、占用三件麻烦事；`SettleService` 负责分帧写入，防止一次性写回上万方块卡死主线程。

参考：DESIGN.md 16.1。

---

## 三种落地模式

| 模式 | 含义 | 适用场景 |
|---|---|---|
| `RESTORE` | 写回真方块，废墟留在原地 | 生存服、追求沉浸感 |
| `DROP` | 变成掉落物可以捡回 | 轻量场景、回收资源 |
| `VANISH` | 直接消失 | 小游戏地图、PVP 场景 |

### 各模式的风险与代价

- **RESTORE**：最有沉浸感，但会改动存档。需要配套回滚/清理机制，否则地图会被逐渐玩坏。
- **DROP**：零存档风险，但大规模倒塌会产生大量实体，反而可能比虚拟碎块更伤 TPS——因此有 `max-drops-per-collapse` 上限。
- **VANISH**：零风险零开销。

---

## 逐方块判定的优先级

落地模式是**逐方块**判定的，而非逐簇——一个碎块簇完全可能横跨生存区与小游戏区的边界，跨过边界的部分该各自遵守所在区域的规则。

优先级（高到低）：

```
regions（后声明的覆盖先声明的）> worlds > default-mode
```

### 后声明覆盖先声明

这一条的设计意图是允许"大区域设一种模式、中间挖一小块例外"：

```yaml
regions:
  - world: world
    from: [-500, 60, -500]
    to: [500, 120, 500]
    mode: RESTORE       # 大部分区域写回
  - world: world
    from: [-50, 60, -50]
    to: [50, 120, 50]
    mode: VANISH        # 中间的小游戏区直接消失
```

后声明的 `VANISH` 覆盖了先声明的 `RESTORE`。中间的小游戏区内的方块直接消失，不写回地形。

### 配置示例

```yaml
settle:
  default-mode: RESTORE
  blocks-per-tick: 150
  max-drops-per-collapse: 200

  worlds:
    world_nether: VANISH

  regions:
    - world: world
      from: [-100, 60, -100]
      to: [100, 120, 100]
      mode: DROP
```

---

## SettlePlanner 处理的三件麻烦事

碎块是刚体，休眠时的位姿是**连续的**——位置带小数、姿态是任意四元数。而 Minecraft 的方块只能待在整数格上。落地必然是一次有损还原。

### 问题一：取整

旋转后的方块中心落在一个连续的 3D 坐标上。取整的做法：

```java
int gx = (int) Math.floor(centerX + rotated[0] + 0.5);
int gy = (int) Math.floor(centerY + rotated[1] + 0.5);
int gz = (int) Math.floor(centerZ + rotated[2] + 0.5);
```

`+ 0.5` 做四舍五入：方块中心偏哪边就靠近哪边的整数格。

### 问题二：撞车

两个碎块的方块可能取整到同一格——后写的会覆盖先写的，凭空少掉方块。

解法：跨簇共享的 `reserved` 集合（`Set<Long>`）。每确定一个格就被标记为已占用，后续方块遇到已占用格时必须另找。

### 问题三：占用

目标格可能本来就有方块（地面、没塌的墙）。

解法：沿 `+Y` 方向逐格上探最多 4 格。找到第一个既没有被世界占用、也没有被本次落地预定的格子。

```java
private static int findFreeY(int x, int startY, int z,
                             Set<Long> reserved, OccupancyTest occupancy) {
    for (int dy = 0; dy <= MAX_STACK_SEARCH; dy++) {
        int y = startY + dy;
        if (!reserved.contains(key(x, y, z)) && !occupancy.isOccupied(x, y, z)) {
            return y;
        }
    }
    return Integer.MIN_VALUE;   // 实在找不到位置
}
```

找不到位置的方块计入 `displacedCount`，由调用方决定是转成掉落物还是丢弃——**不静默吞掉**。

---

## 为什么只往上找

只沿 `+Y` 方向找空位。不往旁边找：

- 碎块本来就是落下来的，往上堆才符合"废墟越堆越高"的直觉
- 横向蔓延会让废墟诡异地沿着地面铺开，看起来像贴图错误而不是倒塌
- 往下找则会穿进地面

让路最多 4 格。超过 4 格的堆叠大概率意味着碎块卡进了不合理的结构，此时计入丢失比强行堆到半空中更合理。

---

## 写回限流

`setBlockData` 会触发光照更新与区块标脏，一次性写上万个足以让主线程卡死几秒。

**限流：每 tick 最多 150 个方块（可配置）。**

实现方式：将所有待写回的方块放入队列（`Deque<PendingBlock>`），用 `scheduleSyncRepeatingTask` 每 tick 消费固定数量。

```java
private void drain() {
    int budget = blocksPerTick;
    while (budget > 0 && !queue.isEmpty()) {
        PendingBlock pending = queue.poll();
        budget--;
        applyOne(pending);
    }
    if (queue.isEmpty() && taskId != -1) {
        // 全部写完，取消定时任务
        plugin.getServer().getScheduler().cancelTask(taskId);
        taskId = -1;
    }
}
```

### 执行期的二次确认

从规划到执行之间隔了若干 tick，格子可能已被其他玩家占用。因此执行期必须再次检查目标格是否可放置：

```java
case RESTORE -> {
    Block block = pending.world().getBlockAt(pending.x(), pending.y(), pending.z());
    if (isPlaceable(block.getType())) {
        block.setBlockData(pending.blockData(), false);   // false = 不触发方块物理
    }
}
```

**注意判据必须与规划期一致**：规划时把水/岩浆算作可放置并占了位，执行时若只认空气，那批方块就既不写回也不掉落地凭空消失——护城河边、岩浆湖边的建筑损失率接近 100%。

不触发方块物理（`setBlockData(data, false)`）是因为：写回方块本身可能触发新一轮坍缩分析，导致连锁反应。

---

## 落地是一次有损还原

碎块休眠时的位姿是连续的、精确的，但方块只能待在整数格上。这意味着：

- **旋转过的碎块**写回后，方块会落在最靠近的整数格，而非它精确"悬停"的位置。
- **碎块的相对内部结构被保留**，但绝对位置被四舍五入到网格。
- **原本一个碎块可能覆盖多格**（旋转后），写回后每个方块各自占据一个整数格，可能比原来稀疏。

这是有损还原，不是精度缺陷——Minecraft 方块网格的分辨率就是这个粒度，无法做得更细。

---

## 使用边界与注意事项

- **没有 RESTORE 时，坍塌只是特效**。碎块翻滚一阵后凭空消失，地形毫发无损。
- **写回必须限流**。每 tick 150 个方块。不加限流的话，一次大型倒塌的写回足以让主线程卡死几秒。
- **执行期必须二次确认**。规划到执行之间有若干 tick 的窗口，世界可能已变。
- **规划期与执行期的可放置判据必须一致**。否则会出现"规划占了位、执行又不写"的方块凭空消失。
- **掉落物有上限**（`max-drops-per-collapse`，默认 200）。大规模倒塌中放入几千个掉落物实体会比虚拟碎块更伤 TPS。
- **被挤掉的方块不静默丢弃**。计入 `displacedCount` 并在日志留痕。
- **不触发方块物理**（`setBlockData(data, false)`）。写回方块本身不应引发新一轮坍缩分析。
- **未加载区块中的目标格视为已占用**。不能在这里 `getBlockAt`——它会同步加载区块（含磁盘 IO 与地形生成），主线程上的一次大坍塌可能发起上万次探测，足以卡死服务器。
