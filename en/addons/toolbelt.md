# 工具腰带 addon

> 源码：`examples/toolbelt-addon` · 命令 `/gtrptools`

用快捷栏工具直接操控物理刚体。**只通过 `RigidPhysicsAPI` 访问物理能力** ——
想在自己的插件里做物理枪 / 法杖，照这里的调用抄即可。

---

## 十一件工具

覆盖 `RigidPhysicsAPI` 的全部子服务。

| 工具 | id | 用到的 API |
|---|---|---|
| **物理枪** | `physics_gun` | `bodies().raycast()` · `interaction().grab()/release()/throwBody()/freeze()/unfreeze()` · `applyImpulse()` |
| 模拟法杖 | `simulation_wand` | `simulation()` —— 时间倍率 / 重力循环档位 |
| 材质法杖 | `material_wand` | `bodies().raycast()` · `materials()` · `PhysicsBody.material()` |
| 坍塌法杖 | `collapse_wand` | `collapses()` —— 选角框区 → 结构完整性判定 |
| 爆炸法杖 | `explosion_wand` | `bodies().applyExplosion()` · `cameraEffects()` |
| 场法杖 | `field_wand` | `gravityFields()` · `magnetics()` —— 造黑洞 / 磁极，F 清空全部场 |
| TNT 法杖 | `tnt_wand` | `tnt()` —— 发射 / 生成物理 TNT |
| 车辆遥控器 | `vehicle_remote` | `vehicles()` —— 上车视角驾驶 / 下车 |
| 机关遥控器 | `mechanism_remote` | `mechanisms()` —— 驱动 / 停止风车、活塞的马达 |
| 角色法杖 | `character_wand` | `characters()` —— 生成行走 NPC / 清空周围 NPC |
| 破坏法杖 | `debris_wand` | `debris()` —— 把实心方块炸成飞溅物理碎块 |

事件方面监听 `PhysicsBodyGrabbedEvent` / `PhysicsBodyReleasedEvent` 可做 HUD 与联动（示例见物理枪）。

---

## 物理枪的键位

```
右键            抓取准星刚体 / 已抓着则原地放下
左键            抛掷（抓着时）/ 沿准星推一下（没抓时）
潜行 + 右键     冻结 / 解冻准星刚体
潜行 + 左键     移除准星刚体
滚轮            调整抓取距离（抓取中滚轮被消费，不切槽）
切走物品        自动放下（防止工具状态残留）
```

### 抓取的语义

抓取期间刚体被引擎切换为**运动学**并跟随准星：

- 不受重力
- 不被碰撞弹开
- **但会推动其它刚体**

观感是「被一道力场钉在半空」，对应 GMod physics gun 的刚性抓取。

!!! note "状态机在引擎里，addon 只负责调用"
    这是 `InteractionService` 提供的能力。addon 不需要自己维护「谁抓着什么」。

---

## 命令

| 命令 | 说明 |
|---|---|
| `/gtrptools` | 打开工具面板（点击发放） |
| `/gtrptools give <工具id>` | 发放单个工具，带 Tab 补全 |
| `/gtrptools kit` | 发放全部工具到背包 |

---

## 安装

1. 先装 [GTRigidPhysics](../guide/quick-start.md)（必须前置依赖，`required: true`）
2. 把 `GTRP-Toolbelt-Addon-1.0.0.jar` 放进 `plugins/`
3. 重启服务器，`/gtrptools kit` 发放整套工具

---

## 它同时是一份 API 覆盖率测试

这个 addon 的设计目标之一就是**把每个子服务都用上一遍**。

如果哪天新增了一个 API 服务而工具腰带里没有对应的工具，那基本说明这个服务
要么没想清楚用途，要么用起来太别扭 —— 这是一条相当有效的自检。

---

## 相关

- [addon 是什么](index.md)
- [管理面板 addon](panel.md) —— 与工具互补的另一半
- [写自己的 addon](writing.md)
- [接入 API](../api/index.md)
