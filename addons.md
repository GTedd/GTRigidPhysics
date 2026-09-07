# addon 是什么

GTRigidPhysics 的引擎 jar 里**没有面板，没有法杖，没有生成命令**。

这些东西全部是独立的插件（addon），只依赖公开的 `gtrigidphysics-api` 编译，
不碰引擎的任何内部类。

---

## 判断标准只有一句话

!!! quote "去掉它，引擎还能不能物理化一个世界？"
    能 → 外围，做成 addon。
    不能 → 核心，留在引擎里。

按这条线划出来的结果：

=== "留在引擎"

    | 职责 | 包 |
    |---|---|
    | 物理世界管理（刚体 / 地形 / 步进） | `physics`、`object` |
    | 坍塌分析与执行 | `collapse` |
    | 撞击后果 | `impact` |
    | 落地规则 | `settle` |
    | 材质表解析 | `material` |
    | 世界快照 | `capture` |
    | 力场（黑洞 / 磁极） | `field` |
    | 物理 TNT | `tnt` |
    | 对外 API 契约实现 | `api` |
    | 表现层（虚拟实体发包） | `view` |
    | 基础设施（配置 / 语言 / 调度 / 系统开关） | `config` `i18n` `scheduler` `system` |

=== "做成 addon"

    | 职责 | 去向 |
    |---|---|
    | 管理面板 | [panel-addon](panel.md) |
    | 交互工具（物理枪 / 法杖 / 魔法棒） | [toolbelt-addon](toolbelt.md) |
    | 玩家动作（生成 / 推 / 炸 / 地形 / 测试） | 随面板与工具一起移出 |
    | 玩法命令（spawn / impulse / terrain / test / wand） | 同上 |
    | 完整载具玩法（车库 / 蓝图 / 飞行控制律） | [vehicle-addon](vehicle.md) |

---

## 引擎命令因此只剩五组

```
/gtrp ├─ status                          运行状态与预算占用
      ├─ sim ─┬─ timescale <倍率>        时间倍率
      │       ├─ gravity <数值>           重力加速度
      │       └─ reset                   还原默认
      ├─ material ─┬─ info <方块>         查询材质
      │            ├─ audit               审计全表
      │            ├─ apply <方块> [玩家]  应用到实体
      │            └─ reset [玩家]         还原实体属性
      ├─ structure ─┬─ info               准星方块的载荷与容量
      │             ├─ scan               扫描周围最吃紧的点
      │             └─ zone ─┬─ list      区域标注
      │                      ├─ add
      │                      └─ remove
      └─ admin ─┬─ reload                 热重载配置
                └─ locale                 切换语言
```

全部是**运维命令**。`spawn` / `impulse` / `mechanism` / `terrain` / `character` /
`ragdoll` / `vehicle` / `test` / `shader` / `wand` / `panel` 都不在引擎里了。

完整参数见[命令参考](../guide/commands.md)。

---

## 三个官方 addon

<div class="grid cards" markdown>

-   **[管理面板](panel.md)** `panel-addon`

    ---

    12 个面板页：运行状态 / 生成物体 / 物理材质 / 坍塌 / 模拟参数 / 系统开关 /
    地形 / TNT / 冲量 / 相机效果 / 服务管理。

    命令 `/gtrpaddon`（别名 `/gtrpa`）

-   **[工具腰带](toolbelt.md)** `toolbelt-addon`

    ---

    物理枪 + 10 件法杖，覆盖 `RigidPhysicsAPI` 的全部子服务。

    命令 `/gtrptools`

-   **[载具系统](vehicle.md)** `vehicle-addon`

    ---

    11 种载具、五种驱动方式、可视化蓝图搭建、车库菜单、盔甲架模型。

    命令 `/gtrpveh`

</div>

它们的源码在仓库的 `examples/` 下，本身就是「怎么写 addon」的参考实现。

!!! info "还有一个计划中的 addon"
    视角滚转与资源包下发（`shader` 包）按设计应当迁出为「视觉体验材质包」addon ——
    它涉及资源包强制下发，不宜内置于引擎。

    **目前仍由引擎内置**，迁移未完成。见[视角滚转](../features/camera-roll.md)。

---

## 为什么要这么拆

### 1. 引擎 jar 该小

不装任何 addon，引擎照常工作 —— 物理化、坍塌、爆炸、撞击后果全部可用。
addon 缺失只是少了操控工具，不是半残。

### 2. 玩法不该由引擎替所有人决定

飞行手感、面板长什么样、法杖怎么用 —— 这些每个服务器要的都不一样。
做进引擎等于替所有人做了决定。

### 3. 契约之外的功能不该被第三方依赖

addon 只能依赖 `api`。这条约束反过来**逼着引擎把能力做成契约** ——
Phase B 补齐的 `tnt()` / `terrain()` / `admin()` 三个服务就是这么来的：
先要让 addon 能用 API 完整替代内置面板，才敢把内置面板删掉。

!!! important "顺序不能反"
    引擎删掉内置面板 / 法杖**之前**，addon 必须已经能用 API 完整替代，
    否则服务器会少功能。

---

## 依赖方向

```
addon  ──►  gtrigidphysics-api  ──►  common
                    ▲
                    │ 唯一实现方
            GTRigidPhysics.jar
```

**addon 永远不反向依赖引擎实现。** 引擎内部怎么重构都不会波及 addon。

`api` 以 **MIT** 授权（引擎本体是 GPL-3.0），所以闭源插件也可以依赖它编译。

---

## 想自己写一个

见[写自己的 addon](writing.md)。

---

## 相关

- [模块架构](../engine/module-architecture.md) —— 引擎内部的四模块划分
- [接入 API](../api/index.md) —— 契约本身
- [命令参考](../guide/commands.md) —— 引擎侧还剩什么
