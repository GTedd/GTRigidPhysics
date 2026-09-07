# 事件

全部在 `cn.gtedd.rigidphysics.api.event` 包下。

---

## 事件

全部在**主线程同步触发**，可以在监听器里直接操作世界。

| 事件 | 时机 | 可取消 |
|---|---|---|
| `StructureCollapseStartEvent` | 结构分析完成、刚体尚未创建 | ✅ |
| `StructureCollapseFinishEvent` | 碎块全部落定、世界已改写 | ❌ |
| `PhysicsBodySpawnEvent` | 独立刚体创建前 | ✅ |
| `PhysicsBodyRemoveEvent` | 独立刚体已释放后 | ❌ |
| `RigidPhysicsReloadEvent` | 配置重载完成 | ❌ |
| `ExplosionDebrisLaunchEvent` | 爆炸碎块被物理化接管前 | ✅ |
| `PhysicsSimulationSettingsChangeEvent` | 时间倍率 / 重力变化后 | ❌ |
| `PhysicsBlockHitEvent` | 玩家攻击 / 右键了一个物理化方块 | ✅ |

### `PhysicsBlockHitEvent`：领地插件唯一的拦截点

物理化的方块**不在世界上** —— 它只是一批发给客户端的虚拟实体，服务端的方块表里那个坐标是空气。
所以原版的 `PlayerInteractEvent` / `BlockBreakEvent` 永远不会为它触发，领地插件、日志插件也都看不见它。
本事件补的正是这个缺口。

```java
@EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
public void onHit(PhysicsBlockHitEvent event) {
    if (!myRegionApi.canBuild(event.getPlayer(), event.getHitPoint())) {
        event.setCancelled(true);       // 打不动别人领地里的废墟
        return;
    }
    // 也可以只改力度：0 = 判定成立但打不动，
    // 适合做「需要特定工具才能击碎」这类玩法
    if (event.getPlayer().getInventory().getItemInMainHand().getType() != Material.IRON_PICKAXE) {
        event.setSpeed(0);
    }
}
```

`getSpeed()` 的语义是「这一击给**单个方块**带来的速度增量（m/s）」。真正施加的冲量按方块质量折算，
所以打一整面墙时它会被自动摊薄 —— 插件不需要自己关心质量。

坍塌碎块**不发逐个刚体事件**：一场坍塌可以一次生成几百个刚体，逐个发事件会让事件总线
成为瓶颈。碎块只在「场次」粒度上有事件，`PhysicsBodySpawnEvent` 只覆盖通过 API
或命令显式生成的独立刚体。爆炸碎屑同理 —— 它唯一的拦截点是
`ExplosionDebrisLaunchEvent`，也是场次粒度。

### 6.1 拦截坍塌（领地保护的典型用法）

```java
@EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
public void onCollapse(StructureCollapseStartEvent event) {
    if (myRegionApi.isProtected(event.getOrigin())) {
        event.setCancelled(true);
        return;
    }
    // 也可以按规模做性能保护
    if (event.getBlockCount() > 500) {
        event.setCancelled(true);
    }
}
```

取消后：碎块不生成、世界**保持原样**（失去支撑的方块继续悬空）、不会有 Finish 事件。

触发坍塌的那次方块破坏或爆炸本身**不受影响** —— 那是原版行为，
要拦请去拦 `BlockBreakEvent` / `EntityExplodeEvent`。

可以从 `getCause()` 区分来源：`BLOCK_BREAK`、`EXPLOSION`、`PLUGIN`、`COMMAND`、`TOOL`，
以及 1.1.0 新增的两个：

| Cause | 含义 |
|---|---|
| `CHAIN_COLLAPSE` | **连锁倒塌** —— 上一场坍塌的碎块砸坏了这里的结构。塔吊压垮旁边整栋楼的那一环 |
| `STRUCTURAL_OVERLOAD` | **濒危到期** —— 之前判定超载的方块，预警时间走完后垮塌。这一场没有任何新的破坏动作 |

`getCrushedBlockCount()`（1.1.0）给出其中因**承重不足被压垮**的方块数。
做保护插件时它比总方块数更有判断力：

```java
// 只拦「结构性垮塌」，放行普通的掉渣
if (event.getCrushedBlockCount() > 0 && myRegionApi.isProtected(event.getOrigin())) {
    event.setCancelled(true);
}
```

承重分析被服主关闭时恒为 0。

`getTrigger()` 给出触发玩家，非玩家来源为 `null`（爆炸路径**刻意不做归因** ——
跨 TNTPrimed 回溯点火者要经过红石、发射器、连锁引爆，结果既不可靠也不便宜；
需要归因请自己在 `EntityExplodeEvent` 里记账）。

### 6.2 坍塌结束

```java
@EventHandler
public void onFinish(StructureCollapseFinishEvent event) {
    event.getSettleMode();       // RESTORE / DROP / VANISH，三层规则解析后的结果
    event.getSettledBlocks();    // 可能小于 Start 事件的 blockCount
    event.getDurationMillis();   // 墙钟时间，含空中飞行时间，不等于 CPU 开销
}
```

> **Finish 事件不保证一定会来。** 服务器关闭、`/gtrp admin reload` 中止坍塌、
> 碎块全部掉出世界底部，这三种情况都不会触发。按「开始事件」配对记账时，
> `RigidPhysicsReloadEvent` 是被重载掐掉那批的唯一收尾信号。

### 6.3 重载

```java
@EventHandler
public void onReload(RigidPhysicsReloadEvent event) {
    myCachedRegistry = null;            // 丢弃缓存
    event.getAbortedCollapses();        // 被这次重载中止的坍塌场次数
}
```

`RigidPhysicsAPI` 实例本身**不会**在重载中失效，不需要重新获取。

---

---

## 相关

- [刚体](bodies.md)
- [坍塌与碎屑](collapse.md)
- [写自己的 addon](../addons/writing.md)
