# `systems.yml` —— 功能系统开关

十个功能系统的独立开关，默认全部启用。

---

## 关掉即零开销

```yaml
systems:
  collapse: true
  debris: true
  objects: true
  impact: true
  tnt: true
  settle: true
  materials: true
  character: true
  ragdoll: true
  camera-roll: true
```

!!! important "关闭是在装配层裁掉服务与监听器"
    不是运行时逐次判断 `if (enabled)`。稳态开销**真的是零**。

---

## 十个系统

| 键 | 关掉之后 |
|---|---|
| `collapse` | 挖掘 / 爆炸不再判定失去支撑的方块，什么都不塌 |
| `debris` | 爆炸弹坑外那圈不再被冲击波掀起（弹坑本身照原版处理，不受影响） |
| `objects` | 骰子、载具、机关、多米诺都生成不出来 |
| `impact` | 物理方块高速撞真方块不再有后果（照常碰撞、停下、弹开，但不破坏任何东西） |
| `tnt` | 物理 TNT 不可用 |
| `settle` | 坍塌碎块不再写回真方块 / 掉落物 / 消失 |
| `materials` | 方块密度 / 摩擦 / 弹性不再从配置解析，全部吃默认值 |
| `character` | 虚拟角色不可用 |
| `ragdoll` | 布娃娃不可用 |
| `camera-roll` | 爆炸 / 坍塌不再引起镜头效果 |

---

## addon 可以统一开关

面板 addon 的「系统管理」页调 `RigidPhysicsAPI#systems()`，切换**即时生效并写回本文件**。

切换会触发 `SystemToggledEvent`，其它 addon 可以监听它同步自己的状态。

!!! note "系统关掉时对应服务仍然可调"
    服务会换成 disabled 实现 —— 方法照常能调，只是什么也不做。

    这是刻意的：让 addon 不必到处写 `if (enabled)`。
    但也意味着写 addon 时「调了没反应」要先查这里。

---

## 相关

- [配置总览](index.md)
- [addon 是什么](../../addons/index.md)
- [写自己的 addon](../../addons/writing.md#系统被关掉时服务仍然可调)
