# `camera-roll.yml` —— 着色器视角滚转

爆炸与坍塌引起的镜头效果。

系统说明与协议细节见[视角滚转](../../features/camera-roll.md)。

---

## 客户端前置条件

通过发一颗**颜色被精确编码过的粒子**，由资源包着色器解码出角度、把画面绕屏幕中心旋转。

必须配合资源包，且客户端需满足：

1. 开启「Improved Transparency」（旧称 Fabulous!）画质选项
2. **没有加载 Iris 光影包**
3. Sodium 版本 ≥ 0.9.0（26.2 对应版本线）

!!! note "精度上限"
    协议只有 **8 位角度**，256 刻度均分 360°，每刻度 1.40625°。

资源包的下发在 [`resource-pack.yml`](resource-pack.md)。

---

## 总开关

```yaml
enabled: true
max-degrees: 25.0
```

`max-degrees` 是**所有来源叠加后**的角度上限。

---

## 降级兜底

```yaml
fallback: auto
fallback.invert: false
fallback.min-degrees: 4.0
```

平滑滚转依赖资源包着色器，而它在很多情况下会**静默失效**：
没配置资源包 / 玩家拒绝或下载失败 / 没开 Improved Transparency / 装了 Iris。

此时改用原版受击倾斜动画（`hurt_animation`）表达冲击 —— 幅度固定、方向可控、约 0.5 秒衰减，
附带一小段受击红色渐变。**表达不了平滑滚转**，但比什么都没有强。

| `fallback` | 行为 |
|---|---|
| `none` | 不降级，维持「没资源包就完全没有效果」的旧行为 |
| `auto` | **默认**。仅在能确认着色器不可用时降级 |
| `hurt` | 无条件降级，忽略着色器通道（确知着色器失效时用） |

| 键 | 默认 | 说明 |
|---|---|---|
| `fallback.invert` | `false` | 方向取反。若实测发现震源在右侧、画面却往左歪，改成 `true` |
| `fallback.min-degrees` | 4.0 | 只对「本该有至少这么多度滚转」的震动兜底，防止远处微弱冲击在客户端被放成完整幅度的倾斜 |

---

## 爆炸冲击

```yaml
explosion:
  enabled: true
  degrees: 14.0
  radius: 20.0
  frequency: 2.4
  decay: 0.7
```

猛地滚一下再震荡回正。

| 键 | 默认 | 说明 |
|---|---|---|
| `degrees` | 14.0 | 爆心处的初始振幅，会再按爆炸威力**开方**缩放（TNT 威力 4 为基准 1.0 倍） |
| `radius` | 20.0 | 影响半径（格），同样按威力缩放 |
| `frequency` | 2.4 | 震荡频率（Hz）。接近真实爆炸冲击后的晃动节奏 |
| `decay` | 0.7 | 振幅衰减时间常数（秒）。0.7 意味着约 2 秒后彻底看不见 |

---

## 大型坍塌震感

```yaml
collapse:
  enabled: true
  degrees: 6.0
  radius: 40.0
  frequency: 1.1
  decay: 1.6
  min-blocks: 40
  full-blocks: 400
```

持续而轻微的摇晃，刻意远小于爆炸。

!!! important "坍塌不会自动触发它"
    碎块本身与落地音效就是坍塌的表现。再叠一层画面滚转既不还原
    （塌一堵墙不该让十米外的人天旋地转），又会和爆炸的震感混淆 ——
    **玩家分不清刚才是炸了还是塌了**。

    本节配的是**显式调用**那条路径：`CameraEffectService#collapseAt`，
    以及面板 addon 的自测入口。

    想让坍塌自动震屏，在自己的插件里监听 `StructureCollapseStartEvent` 再调 `collapseAt`。

| 键 | 默认 | 说明 |
|---|---|---|
| `degrees` | 6.0 | 基准振幅，会再按坍塌规模缩放 |
| `radius` | 40.0 | 影响半径，比爆炸大得多 |
| `frequency` | 1.1 | 比爆炸低，是「沉重的晃动」 |
| `decay` | 1.6 | 衰减时间常数（秒） |
| `min-blocks` | 40 | 低于这个方块数的坍塌完全不产生震感 |
| `full-blocks` | 400 | 达到这个方块数即为满幅，超过不再增强 |

---

## 跟随碎块翻滚

```yaml
follow:
  enabled: true
  radius: 3.5
  strength: 0.75
  invert: false
```

画面跟着身边正在翻滚的巨块一起歪。

| 键 | 默认 | 说明 |
|---|---|---|
| `radius` | 3.5 | 多近才跟随（格）。约等于「碎块就在身边擦过去」 |
| `strength` | 0.75 | 跟随强度。1.0 = 完全复制碎块姿态；0.75 保留一点「我还站得住」的余地 |
| `invert` | `false` | 方向取反。若实测发现碎块往左倒、画面却往右歪，改成 `true` |

---

## 怎么自测

!!! warning "`/gtrp shader test` 已经不在引擎里"
    引擎瘦身把 shader 命令一起迁出了。现在的自测入口是
    [管理面板 addon](../../addons/panel.md) 的「视角效果」页，
    或在自己的插件里调 `api.cameraEffects()`。

    按设计，`shader` 包整体应当迁出为「视觉体验材质包」addon，
    但**这一步尚未完成** —— 效果本身仍由引擎提供。

---

## 相关

- [视角滚转](../../features/camera-roll.md) —— 协议、四种字节的分工、发包节流
- [`resource-pack.yml`](resource-pack.md) —— 资源包怎么发
- [`systems.yml`](systems.md) —— 整体关掉 `camera-roll`
