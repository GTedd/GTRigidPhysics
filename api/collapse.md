# 坍塌与碎屑

主动触发结构坍塌、查询承重结构、把方块炸成飞溅碎块。

---

## 建筑坍塌

```java
StructureCollapseService collapses = api.collapses();

// 按服主配置的分析范围触发
boolean queued = collapses.requestCollapse(origin);

// 自定义范围（慎用，见下）
collapses.requestCollapse(origin, 12, 24, 8);

// 查询
collapses.isEnabled(world);
collapses.activeCollapseCount();     // 进行中的坍塌「场次」
collapses.runningAnalysisCount();    // 进行中的异步分析任务
```

返回 `true` 只表示**分析任务已排队**，不代表真的会塌 —— 结构本来就稳固时，
分析结束后什么都不会发生。

返回 `false` 有三种原因，都是刻意的保护：并发分析数达上限、区域仍在冷却期、该世界被禁用。

> ⚠ 自定义范围时注意分析体积是三次方增长的：
> 格子数 = `(2·radiusXZ+1)² × (heightUp+heightDown+1)`。
> 半径从 12 调到 24 会让工作量涨到约 4 倍，队列更容易积压，
> 进而让后续请求被并发上限挡掉。

---

---

## 承重结构：看它会不会塌

`collapses()` 让建筑塌，`structure()` **看**建筑会不会塌 —— 不改变世界
（区域标注除外）。做结构扫描仪、AI 选点、关卡验收用这个。

```java
StructuralIntegrityService structure = api.structure();

// 承重分析是否启用（服主可在 structure.yml 整体关掉）
structure.isEnabled();
```

### 4A.1 评估结构

分析要抓几万格快照、跑载荷传播与连锁迭代，放主线程是几十毫秒的卡顿。
所以它是**异步**的，而 **future 在主线程完成** —— 拿到结果可以直接操作世界：

```java
structure.analyze(location, 10).thenAccept(report -> {
    // 这里已经在主线程
    if (report.hasStructuralFailure()) {
        // 有承重构件被压垮 —— 楼在垮，不只是掉渣
        Bukkit.broadcast(Component.text("结构失效 " + report.crushedCount() + " 格！"));
    }

    WeakPoint weakest = report.weakest();
    if (weakest != null) {
        player.sendMessage("最薄弱处 " + weakest.toLocation()
                + " 载荷率 " + Math.round(weakest.utilization() * 100) + "%"
                + "（" + weakest.memberType() + "）");
    }
});
```

`StructureReport` 是**摘要**而非完整数据：一次分析要为几万格各算一份载荷，
合起来好几 MB。原样交出去等于让每个持有报告的插件都拖着几 MB 不放。
所以只保留汇总数字与一份按载荷率降序的薄弱点列表（长度由 `weakLimit` 控制）。

| 字段 | 含义 |
|---|---|
| `crushedCount()` | 因承重不足被**压垮**的方块数。`> 0` 意味着结构性失效 |
| `detachedCount()` | 会掉下来的方块总数（含被连累失去支撑的） |
| `clusterCount()` | 会产生的坍塌簇数 |
| `converged()` | 连锁是否收敛。`false` 表示结构还在继续垮，只是分析撞上了轮数上限 |
| `weakPoints()` | 按载荷率降序的受力点 |

> `crushedCount()` 比 `detachedCount()` 更有判断力：几百块的「失去支撑」
> 可能只是拆了个大棚子，而十几块的「压垮」往往意味着一栋楼正在垮。

### 4A.2 濒危查询（廉价，可在每 tick 调用）

```java
// 一次哈希查表，不触发任何分析
if (structure.isCritical(location)) {
    // 这一格正在裂纹与呻吟，即将垮塌
}
structure.criticalBlockCount();
```

数据来自**最近一次经过该区域的结构评估**，所以它反映的是
「上一次算的时候这里很危险」，不是实时状态。预警被关掉时恒为 `false`。

### 4A.3 区域模板：让关键建筑的倒塌完全可控

几何推断能回答「这根石砖柱是承重柱」，但回答不了「这栋楼是本局地图的核心建筑」——
后者是**设计意图**，不在方块里。对固定竞技地图这一层尤其值钱：

```java
// 出生点平台永不垮
structure.defineZone("spawn-platform", corner1, corner2, ZoneMode.IMMUNE);

// 这片街区一碰就碎
structure.defineZone("slums", a, b, ZoneMode.FRAGILE);

// 介于预设之间：大体易碎，但强度回调到 0.4
structure.defineZone("mid", a, b, ZoneMode.FRAGILE, 0.4, 0.5);

structure.removeZone("slums");
structure.zoneNames();      // 顺序即优先级，后者覆盖前者
```

| 模式 | 语义 |
|---|---|
| `NORMAL` | 只应用倍率，不改变语义 |
| `LOAD_BEARING` | 强制视为可承重材质，强度 ×2 |
| `IMMUNE` | 永不失效，且始终为上方结构提供支撑（比「强度调到极高」更彻底 —— 后者仍会因悬挑过长而弯折） |
| `FRAGILE` | 强度 ×0.25、跨度 ×0.5 |

返回 `false` 表示**写入 `zones.yml` 失败**，但区域**仍然已在内存中生效** ——
只是重启后会丢失。

---

---

## 爆炸碎屑

```java
ExplosionDebrisService debris = api.debris();

// 在 EntityExplodeEvent 里，把被炸掉的方块交给物理接管
@EventHandler(priority = EventPriority.HIGHEST)
public void onExplode(EntityExplodeEvent event) {
    List<Block> destroyed = new ArrayList<>(event.blockList());
    event.blockList().clear();
    int taken = debris.launch(event.getLocation().getWorld(),
            event.getLocation(), destroyed, 4.0f);   // 4.0 ≈ 一颗 TNT
    event.blockList().addAll(destroyed);             // 没被接管的交回原版
}
```

坍塌管的是「爆炸后失去支撑」的那批，碎屑管的是「被爆炸直接炸碎」的那批 ——
后者在原版里只会原地消失，本服务让它们一块一飞、四散开来。

> ⚠ `launch` 会**就地修改**传入的集合：被接管的方块会从中移除。
> 接管带过滤（跳过非实心方块、受 `maxDebrisBlocks()` 上限约束），
> 所以**不要**按「返回了 N 块」去推断集合前 N 项被拿走 —— 直接读集合剩余内容即可。
>
> 调用时机必须在原版抹掉方块**之前**（还在处理 `EntityExplodeEvent` 时）：
> 本服务拍快照依赖方块仍然存在于世界上。

---

---

## 相关

- [建筑坍塌](../features/collapse.md) —— 系统说明
- [爆炸飞溅](../features/explosion.md)
- [事件](events.md) —— `StructureCollapseStartEvent` 可取消
- [`structure.yml`](../guide/config/structure.md) —— 承重分析的参数
