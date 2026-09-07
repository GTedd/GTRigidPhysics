# 命令参考

引擎命令只有**五组**，全部是运维用途。

!!! info "生成物体、法杖、面板的命令不在引擎里"
    引擎瘦身后，`spawn` / `impulse` / `mechanism` / `terrain` / `character` / `ragdoll` /
    `vehicle` / `test` / `shader` / `wand` / `panel` 全部迁到了独立 addon。

    看 [addon 是什么](../addons/index.md)，或直接看
    [管理面板](../addons/panel.md) / [工具腰带](../addons/toolbelt.md) / [载具](../addons/vehicle.md)。

主命令 `/gtrigidphysics`，别名 `/gtrp`（下文一律用别名）。

---

## 命令树

```
/gtrp
├─ status                       运行状态与预算占用
├─ sim                          模拟参数
│  ├─ timescale <倍率>           时间倍率（慢放 / 快放）
│  ├─ gravity <数值>             重力加速度
│  └─ reset                     还原为默认
├─ material                     物理材质
│  ├─ info <方块名>              查询某方块的物理材质
│  ├─ audit [export]            审计覆盖率，找出吃默认值的方块
│  ├─ apply <方块名> [玩家]       把材质应用到实体
│  └─ reset [玩家]               还原实体属性
├─ structure                    承重结构
│  ├─ info                      准星所指方块的载荷 / 容量 / 构件类型
│  ├─ scan [数量]                扫描周围，列出最吃紧的几个点
│  └─ zone                      区域标注
│     ├─ list                   列出全部区域
│     ├─ add <名字> <模式> [半径]  新增区域
│     └─ remove <名字>            删除区域
└─ admin                        插件自身
   ├─ reload                    热重载全部配置
   └─ locale <语言>              切换界面语言
```

---

## `status` —— 运行状态

```
/gtrp status
```

一屏看完运行时状态，调参前后各跑一次对比最有用：

| 行 | 含义 |
|---|---|
| 并发坍塌 | 当前 / 上限，带百分比 |
| 虚拟实体 | 当前 / 上限，带百分比 |
| 活跃刚体 | 数量 @ 物理频率（40 Hz） |
| 时间倍率 / 重力 | 当前生效值 |
| 表现中的坍塌 | 正在向玩家广播的场数 |
| 落地队列 | 等待写回的方块数 |
| 邻接模式 | `FACE_ONLY` / `FACE_AND_EDGE` / `FULL_26` 及邻居数 |
| 视图校准 | 原点偏移与乘客 Y 补偿 |
| 碰撞箱 | 模式 / 半径 / 客户端在线数 / 已登记数 / ID 余量 |
| 结构分析 | 运行中 / 上限、挂起补跑数、扩范围次数与半径上限 |
| 语言 | 当前语言与条目数 |

---

## `sim` —— 模拟参数

**运行时临时覆盖，不落盘。** 服务器重启或 `/gtrp admin reload` 后回到配置文件里的值。

| 命令 | 参数 | 说明 |
|---|---|---|
| `/gtrp sim timescale <倍率>` | 倍率，夹在 [0.05, 4.0] | `0.2` 即五分之一慢放。演出与调试用 |
| `/gtrp sim gravity <数值>` | m/s²，负值向下 | 地球 `-9.81`（**默认**）、月球 `-1.62`、原版落沙 `-16` |
| `/gtrp sim reset` | 无 | 两项都还原为默认 |

!!! danger "改重力等于改整套速度量纲"
    `materials.yml` 的 `fracture-speed` 与 `impact.yml` 的 `min-break-speed` 都是
    「落 N 格的着地速度」，换算式 `v = √(2gh)` 里的 `g` 就是这个值。

    把重力改成 `-16` 却不改那两处，表现是「什么都一摔就碎」——
    同样的落差有 1.28 倍的着地速度，那两处要跟着乘 1.28。

    详见 [`physics.yml`](config/physics.md)。

---

## `material` —— 物理材质

| 命令 | 参数 | 说明 |
|---|---|---|
| `/gtrp material info <方块名>` | Material 名，Tab 补全 | 查询密度 / 摩擦 / 弹性 / 空气阻力，以及换算到求解器后的值 |
| `/gtrp material audit [export]` | 可选 `export` | 审计覆盖率：多少方块走精确规则、多少走后缀组、多少在吃默认值 |
| `/gtrp material apply <方块名> [玩家]` | 方块名 + 可选目标 | 把该材质的三个原版属性写到实体上 |
| `/gtrp material reset [玩家]` | 可选目标 | 还原实体属性 |

### `audit` 是一条值得定期跑的命令

它的存在源于一次真实事故：2026-08-22 的审计发现 **284 个方块（25.5%）静默地吃着默认值**，
其中包括圆石、砂岩、砖块、花岗岩、陶瓦这些最主力的建材。

配置文件表面上写得满满当当，看不出任何异常。

现在有 `MaterialCoverageTest` 在构建期守着这条线，但改过 `materials.yml` 之后跑一次 `audit` 仍然是好习惯。

---

## `structure` —— 承重结构

诊断是只读的，区域标注会改变倒塌行为。

| 命令 | 参数 | 说明 |
|---|---|---|
| `/gtrp structure info` | 无，瞄准一个方块 | 看该方块的载荷、容量、构件类型（柱 / 梁 / 墙 / 楼板 / 填充） |
| `/gtrp structure scan [数量]` | 可选，默认列前几个 | 扫描周围，列出**最吃紧**的几个点 |
| `/gtrp structure zone list` | 无 | 列出全部区域标注 |
| `/gtrp structure zone add <名字> <模式> [半径]` | 模式见下 | 以自己为中心新增一个区域 |
| `/gtrp structure zone remove <名字>` | 名字 | 删除 |

### 四种区域模式

| 模式 | 效果 |
|---|---|
| `NORMAL` | 默认行为 |
| `LOAD_BEARING` | 按承重结构规则严格判定 |
| `IMMUNE` | 区域内永不坍塌 |
| `FRAGILE` | 更容易垮 |

!!! tip "载荷的单位是「方块自重当量」"
    不是牛顿。一个 `density = 1.0` 的方块贡献 1.0 载荷，
    于是 `compressive-strength: 120` 可以直接读成「能扛 120 个基准方块压在头上」。

    详见 [`structure.yml`](config/structure.md)。

---

## `admin` —— 插件自身

| 命令 | 参数 | 说明 |
|---|---|---|
| `/gtrp admin reload` | 无 | 热重载**全部** 14 个配置文件，不重启服务器 |
| `/gtrp admin locale <语言>` | `zh_CN` / `en_US` / `lang/` 下的任意文件 | 切换界面语言 |

`reload` 会触发 `RigidPhysicsReloadEvent`，addon 可以监听它同步自己的缓存。

已经在玩家屏幕上的物体会按新限额**自然收敛** —— 超出可见上限的由远及近销毁，
新进入距离的按配额补上，不会残留也不会闪烁。

---

## 权限

三层模型，从粗到细：

```
gtrigidphysics.admin                  （default: op）
├─ gtrigidphysics.category.diagnostic   只读诊断
├─ gtrigidphysics.category.admin        管理操作
├─ gtrigidphysics.category.material     改动实体属性
└─ gtrigidphysics.category.testing      会改动世界
```

每条命令另有独立节点 `gtrigidphysics.command.<点分路径>`，例如
`gtrigidphysics.command.sim.timescale`、`gtrigidphysics.command.structure.zone.add`。

判定顺序：`gtrigidphysics.admin` → 分类节点 → 单条节点，任一命中即放行。

!!! tip "给运维放一条 `category.diagnostic` 就够"
    只读诊断不改动任何东西。想让他们能调时间倍率再加 `category.admin`。

!!! warning "`paper-plugin.yml` 里有一批过期的权限声明"
    `gtrigidphysics.command.panel`、`command.shader.*`、`category.testing` 下的
    `command.spawn` / `command.test.*` / `command.wand.*` 等节点仍然声明着，
    但对应的命令**已经不在引擎里**。

    它们不会造成故障（无人检查的权限节点是惰性的），但会让权限插件的补全列表出现不存在的命令。

---

## 帮助菜单只列出用得了的东西

`/gtrp` 不带参数时按分类展示，且**只含发送者有权使用的节点**。

列出一堆点了就报「无权限」的命令，对管理员是纯粹的噪音。

---

## 相关

- [快速开始](quick-start.md)
- [配置总览](config/index.md)
- [性能与预算](performance.md) —— `status` 那几个数怎么读
- [addon 的命令](../addons/index.md) —— 生成、法杖、面板都在那边
