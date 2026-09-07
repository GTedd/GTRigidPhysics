# 性能与预算

## 先看瓶颈在哪

**物理很便宜，带宽算不起。**

实测 1000 刚体单步 1.07 ms（40 Hz 下约占 4.3% 单核）。
而 100 人服每玩家 50 KB/s 的物理带宽预算下，同屏可见簇只有百来个 ——
一次没有上限的大规模倒塌足以打满整台服务器的出口。

所以调优的顺序是：

```
① 跑 /gtrp status，看哪个指标满了
        ↓
② 带宽满   → view.yml 的 broadcast-interval-ticks 与 distance
   实体满   → budget.yml 的 max-global-virtual-entities
   主线程卡 → settle.yml / impact.yml 的 blocks-per-tick
   分析吃 CPU → analysis.yml 的 radius-xz / height-down
        ↓
③ 改完再跑一次 status 对比
```

!!! warning "别一上来就调大预算上限"
    那几个数调大会让**更多东西同时发出去**。
    如果玩家已经在掉线或卡顿，调大只会更糟。

预算系统通过**三条硬规则** + **区域独立预算池**，确保无论触发多大的坍塌带宽都不会失控。

---

## R1 旋转配额制

### 规则描述

每玩家同时只有**最近的若干个簇**享受完整旋转关键帧；更远的簇姿态冻结在初始随机角度，只做平移。

### 设计原因

旋转的价格是 O(方块数)，而平移是 O(1)：

| 操作 | 每簇每帧 | 备注 |
|---|---|---|
| 平移 | 1 个 teleport 包 | 只发包给根实体 |
| 旋转 | N 个 metadata 包 | 每个乘客重发 translation + left_rotation |

一个 64 方块的簇，旋转一次就是 64 个包，比平移贵约 10 倍（DESIGN.md 2.2 推算：纯平移约 300 B/s/簇，带旋转约 2800 B/s/簇）。

### 实现位置

`ActiveCollapse.updateViewer()` 的第四步：簇按距离排序后，用一个方块配额（而非簇配额）从近向远填满。

**配额以方块为单位而不是以簇为单位，这一点很重要**：同样 8 个名额，8 个 64 方块的簇比 8 个 8 方块的簇贵 8 倍——按簇计的话带宽会随建筑结构随机浮动，根本无法预算。

### 远处真的看不到吗

远处碎块是否在翻滚视觉上无法分辨。关键帧更新频率只有 5~10 Hz，加上客户端插值的平滑效果，在 20+ 格之外基本看不出姿态变化。而带宽却差一个数量级——**此规则不实现则 100 人服必炸**。

---

## R2 单事件观众上限

### 规则描述

一次倒塌事件的高保真表现只发给**最近的 N 名玩家**（默认 12），其余玩家收 L2 粒子版。

### 设计原因

30 人围观一次倒塌 = 30 倍带宽。无上限则单次事件即可将出口打满。

### 关键细节：不只是"不再更新"

被挤出观众名额的玩家，必须**主动发销毁包**，而不能只是"不再更新"。否则那些虚拟实体会永久僵在他的客户端上——客户端不知道服务端已经"放弃"了这些实体，它们会一直渲染在原来的位置。

`ActiveCollapse.broadcast()` 中，被挤出名额的玩家走 `despawnAllFor()` 路径，直接清掉其全部已生成的虚拟实体。

---

## R3 区域独立预算池

### 规则描述

预算池按区域划分（默认 256 格边长），**不共用全服单池**。

### 设计原因

单池会导致 A 区的战斗饿死 B 区的正常游玩。同样，单池也意味着一次大型倒塌就能把全服所有区域的配额一并耗光——一个玩家在主城炸楼，生存区就再也不会塌了。

### 实现

```java
private long regionKey(int blockX, int blockZ) {
    int size = settings.regionSize();
    long rx = Math.floorDiv(blockX, size);
    long rz = Math.floorDiv(blockZ, size);
    return (rx << 32) | (rz & 0xFFFFFFFFL);
}
```

用 `Math.floorDiv` 而非 `blockX / size`：Java 的 `/` 对负数向零取整，会产生不对称的区域边界。`floorDiv` 保证负坐标也被正确地归入一致的池。

---

## BudgetManager 实现

### 线程安全

所有方法 `synchronized`。争用极低：只在坍塌开始/结束时调用（`tryAcquire` / `release`），不在每帧的热路径上。

### 申请流程

```java
public synchronized Decision tryAcquire(int blockX, int blockZ,
                                        int clusterCount, int entityCount) {
    // 1. 并发坍塌数上限
    // 2. 全服虚拟实体总数上限
    // 3. 该区域的活跃刚体上限（R3）
    // 全部通过才批准，一并扣减三项配额
}
```

### 归还流程

```java
public synchronized void release(int blockX, int blockZ,
                                 int clusterCount, int entityCount) {
    // 参数必须与当初 tryAcquire 传入的完全一致
}
```

### 不静默截断

申请失败时返回明确的 `Decision(approved, limitKind)`，调用方据此决定"降级"还是"放弃并记录"。绝不允许悄悄少塌一半——那会在世界里留下悬空方块。

`Decision` record 的工厂方法不能叫 `approved()`/`limitKind()`——record 已经为同名组件生成了无参访问器，重名会直接编译冲突。已改名为 `allow()` / `deny()`。

---

## 预算泄漏防护

配额的申请与归还必须严格配对，否则预算池缓慢缩水，表现为"服务器跑一段时间后就再也不塌了"——这种故障极难排查。

防护措施：

1. **`tryAcquire` 的返回值必须消费**。批准了的配额必须由某个代码路径归还。
2. **建物理世界途中抛异常时，catch 里同时释放 native 资源和配额**。不要因为异常跳过了 `release`。
3. **`shutdown()` 遍历归还全部在途配额**。关服或 reload 时不能假设所有坍塌都优雅结束了。
4. **归还时做下限保护**。`Math.max(0, current - delta)` 防止因重复归还将计数器打到负数。

---

## 四个预算指标

| 指标 | 作用域 | 初始值 | 配置键 |
|---|---|---|---|
| 活跃刚体数 | 按区域 | 600 | `budget.max-active-bodies-per-region` |
| 虚拟实体总数 | 全服 | 20,000 | `budget.max-global-virtual-entities` |
| 每玩家可见簇数 | 每玩家 | 150 | `budget.max-visible-clusters-per-player` |
| 每玩家旋转方块数 | 每玩家 | 256 | `budget.max-rotating-blocks-per-player` |

此外还有：

| 指标 | 初始值 | 配置键 |
|---|---|---|
| 单事件观众数（R2） | 12 | `budget.max-viewers-per-collapse` |
| 同时进行的坍塌场数 | 8 | `budget.max-concurrent-collapses` |

初始值的依据：DESIGN.md 2.2 推算，每玩家 50 KB/s 预算下纯平移约 166 簇、带旋转约 18 簇。各项均留了余量。

---

## 使用 `/gtrp status` 观察运行时预算占用

`/gtrp status` 命令实时展示：

- 当前活跃坍塌场数
- 全服虚拟实体总数
- 当前所在区域的活跃刚体数
- 有震动在身的玩家数
- 队列中待落地的方块数

!!! note "带宽推算值尚未在真实负载下抓包验证"
    上面那些初始值是按协议字段**估算**的。真机跑起来之后应当据此校准 `budget.*` 各项限额。

---

## 五道闸门，不止三条

三条硬规则之外还有两道，它们在别的配置文件里：

| # | 闸门 | 在哪配 |
|---|---|---|
| R1 | 旋转配额（按**方块**计） | [`budget.yml`](config/budget.md) |
| R2 | 单事件观众上限 | [`budget.yml`](config/budget.md) |
| R3 | 区域独立预算池 | [`budget.yml`](config/budget.md) |
| R4 | 距离剔除与 LOD | [`view.yml`](config/view.md) 的 `distance` / `distant-effect-distance` |
| R5 | **遮挡剔除** | [`view.yml`](config/view.md) 的 `occlusion` 段 |

R5 是最容易被忽略的一道：被墙挡住的碎块玩家反正看不见，位置包、旋转包、生成包都是白发的流量。
从玩家眼睛向簇质心打一条射线就能省掉这一整份。

另有两套**独立**的预算，不共享上面的额度：

- [`collision.yml`](config/collision.md) 的 `budget-per-viewer` / `max-viewers` —— 真实碰撞箱
- [`view.yml`](config/view.md) 的 `objects` 段 —— 独立物体（常驻，所以单独配）

---

## 常见调优配方

=== "100 人生存服"

    ```yaml
    # view.yml
    distance: 32.0              # 从 48 压下来
    broadcast-interval-ticks: 3 # 10 Hz → 6.7 Hz
    occlusion:
      enabled: true

    # budget.yml
    max-visible-clusters-per-player: 100
    max-rotating-blocks-per-player: 160
    ```

    优先压距离与广播频率 —— 它们对带宽是**线性**的，对观感的损失最小。

=== "小型演出服（十几人，追求效果）"

    ```yaml
    # view.yml
    distance: 64.0
    broadcast-interval-ticks: 2

    # budget.yml
    max-rotating-blocks-per-player: 512
    max-viewers-per-collapse: 16

    # structure.yml
    clusters:
      max-member-cluster-size: 512   # 整根塔吊倒下来
    ```

=== "主线程掉 TPS"

    ```yaml
    # settle.yml
    blocks-per-tick: 80        # 从 150 压下来

    # impact.yml
    blocks-per-tick: 2
    max-crater-per-collapse: 32

    # analysis.yml
    radius-xz: 10
    height-down: 16
    max-concurrent: 2
    ```

    这几处全都在**主线程**上，与带宽无关。

---

## 使用边界与注意事项

- **配额必须严格配对归还**。一次申请对应一次归还，参数一致。忘记归还会让预算池永久缩水。
- **R2 被挤出的观众必须发销毁包**，不能只是停止更新。否则虚拟实体会永久僵在客户端。
- **旋转配额以方块为单位**而不是以簇为单位。按簇计的话，带宽会随建筑结构（簇里多少方块）随机浮动，无法预算。
- **`Decision.deny()` 必须被处理**。不能静默丢弃——悬空方块会留在世界里。
- **区域池用 `floorDiv`**，不要用 `/`（Java 的 `/` 对负数向零取整）。
- 预算管理器不负责 per-player 的可见包络（那是 `ActiveCollapse` 的事）。`BudgetManager` 只管"能不能开新坍塌"，不管"已经在跑的坍塌向谁发包"。
