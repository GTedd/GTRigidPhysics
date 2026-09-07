# 配置总览

**14 个配置文件，全部支持热重载。**

```
plugins/GTRigidPhysics/
├── config.yml           统筹项：语言、禁用世界
├── analysis.yml         结构完整性分析（区域、邻接、簇）
├── structure.yml        承重结构（载荷、构件、连锁、濒危预警）
├── view.yml             表现层（虚拟实体、广播、扬尘、遮挡剔除）
├── collision.yml        真实碰撞箱与交互判定
├── physics.yml          物理线程（重力、刚体上限、超时）
├── budget.yml           碎块预算（五道安全带）
├── materials.yml        方块物理材质总表（1113 个方块）
├── settle.yml           落地规则（写回 / 掉落物 / 消失）
├── impact.yml           撞击后果（脆的自碎、硬的砸坏、废墟砸伤）
├── tnt.yml              物理 TNT 尺寸
├── systems.yml          各功能系统的独立开关
├── camera-roll.yml      着色器视角滚转
├── resource-pack.yml    资源包下发
└── lang/                zh_CN.yml · en_US.yml
```

首次启动时自动从 jar 释放。**升级不会覆盖你已有的文件** ——
新增条目请自行从 jar 内同名文件补入。

```
/gtrp admin reload
```

一条命令重载全部。已经在玩家屏幕上的物体会按新限额自然收敛，不会残留也不会闪烁。

---

## 按目的找

=== "我想调倒塌的手感"

    | 想要 | 改哪里 |
    |---|---|
    | 更容易塌 / 更不容易塌 | [`structure.yml`](structure.md) 的 `strength-scale` —— **这是总旋钮** |
    | 拆断了却不塌 | [`analysis.yml`](analysis.md) 的 `border-expansion-passes` 与 `radius-xz` |
    | 塌下来碎得太散 / 想整根倒 | [`structure.yml`](structure.md) 的 `clusters.coherent-members` |
    | 废墟堆的形状（能堆多陡） | [`materials.yml`](materials.md) 的 `friction` |
    | 碎块落地留不留废墟 | [`settle.yml`](settle.md) 的 `default-mode` |
    | 塌之前有没有预告 | [`structure.yml`](structure.md) 的 `critical` 段 |

=== "我想调轻重快慢"

    | 想要 | 改哪里 |
    |---|---|
    | 整体重力 | [`physics.yml`](physics.md) 的 `gravity` |
    | 羊毛飘 / 铁块砸 | [`materials.yml`](materials.md) 的 `density` 与 `air-drag` |
    | 什么材质会摔碎 | [`materials.yml`](materials.md) 的 `fracture-speed` |
    | 弹性 | [`materials.yml`](materials.md) 的 `bounciness` |
    | 慢镜头 | `/gtrp sim timescale`（运行时，不落盘） |

=== "服务器卡了"

    先跑 `/gtrp status` 看哪个指标满了，再对照[性能与预算](../performance.md)。

    | 指标满了 | 改哪里 |
    |---|---|
    | 虚拟实体 | [`budget.yml`](budget.md) 的 `max-global-virtual-entities` |
    | 并发坍塌 | [`budget.yml`](budget.md) 的 `max-concurrent-collapses` |
    | 带宽（玩家掉线 / 卡顿） | [`view.yml`](view.md) 的 `broadcast-interval-ticks` 与 `distance` |
    | 主线程卡 | [`settle.yml`](settle.md) 与 [`impact.yml`](impact.md) 的 `blocks-per-tick` |
    | 分析吃 CPU | [`analysis.yml`](analysis.md) 的 `radius-xz` / `height-down` |

=== "我只想关掉某个功能"

    [`systems.yml`](systems.md)。关掉的系统**服务不再装配、监听器不再注册** ——
    稳态零开销，而不是运行时逐次判断。

---

## 分册

<div class="grid cards" markdown>

-   **[`config.yml`](config.md)** —— 统筹

    语言、禁用世界。只有两项。

-   **[`analysis.yml`](analysis.md)** —— 结构完整性分析

    区域范围、邻接判定、自适应扩范围、锚定方块、冷却。

-   **[`structure.yml`](structure.md)** —— 承重结构

    载荷与强度、构件识别、簇切分、濒危预警、连锁倒塌。

-   **[`view.yml`](view.md)** —— 表现层

    距离与配额、扬尘、撞击反馈、遮挡剔除、告示牌文字、唱片机。

-   **[`collision.yml`](collision.md)** —— 真实碰撞箱

    碰撞箱实体类型、两档激活半径、攻击与右键。

-   **[`physics.yml`](physics.md)** —— 物理

    重力、刚体总数上限、模拟超时、并行度。

-   **[`budget.yml`](budget.md)** —— 碎块预算

    五道安全带：全局实体、并发场数、区域池、可见簇、旋转配额。

-   **[`materials.yml`](materials.md)** —— 物理材质

    八个字段 × 1113 个方块，三层查找。

-   **[`settle.yml`](settle.md)** —— 落地规则

    三种模式、按世界 / 按区域覆盖、写回限流。

-   **[`impact.yml`](impact.md)** —— 撞击后果

    砸坏方块的门槛、限流、废墟砸伤生物。

-   **[`tnt.yml`](tnt.md)** —— 物理 TNT

    只有一个键。

-   **[`systems.yml`](systems.md)** —— 系统开关

    十个功能系统的独立开关。

-   **[`camera-roll.yml`](camera-roll.md)** —— 视角滚转

    爆炸 / 坍塌 / 跟随三种来源，以及降级兜底。

-   **[`resource-pack.yml`](resource-pack.md)** —— 资源包下发

    URL、SHA-1、强制模式。

</div>

---

## 三条通用约定

### 世界名支持三种写法

`config.yml` 的 `disabled-worlds` 与 `settle.yml` 的 `worlds` / `regions` 都认这三种：

```yaml
world_the_end       # 精确名（大小写不敏感）
"arena_*"           # glob 通配：* 任意多字符，? 单个字符
"/^arena_\d+$/"     # 正则：前后加斜杠
```

通配是给**临时世界**用的 —— 竞技场、副本这类世界往往每局新建、名字带 UUID，精确名根本没法写。

优先级：**精确名 > 通配式**（通配式之间后声明覆盖先声明）。
所以想给某一个特定世界开例外，直接补一行精确名即可，不用管顺序。

### 缺项一律退回默认值

文件被删掉某一项、或整个文件缺失，都退回默认值，**不会抛异常导致插件加载失败**。

### 改重力要连带改两处

`materials.yml` 的 `fracture-speed` 与 `impact.yml` 的 `min-break-speed` 都是
「落 N 格的着地速度」，换算式 `v = √(2gh)` 里的 `g` 就是 `physics.yml` 的 `gravity`。

!!! danger "只改重力不改那两处"
    把重力改成原版尺度的 `-16` 之后，同样的落差有 **1.28 倍**的着地速度。
    表现是「什么都一摔就碎」。

---

## 相关

- [命令参考](../commands.md) —— `/gtrp admin reload` 与运行时旋钮
- [性能与预算](../performance.md) —— 五道闸门怎么配
- [快速开始](../quick-start.md)
