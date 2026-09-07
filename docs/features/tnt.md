# 物理 TNT

一颗**真正的刚体** TNT：出膛带自旋翻滚、落地弹跳、斜面滚动，引信到期在它**当时滚到的位置**爆炸。

配置在 [`tnt.yml`](../guide/config/tnt.md)，开关在 [`systems.yml`](../guide/config/systems.md) 的 `tnt`。

---

## 与原版 TNT 的区别

原版的 `TNTPrimed` 是一个实体，它有速度但**没有姿态** —— 不会翻滚、不会沿斜面滚下去、
落地是软软地停住而不是弹一下。

物理 TNT 走的是完整刚体：

| | 原版 TNT | 物理 TNT |
|---|---|---|
| 旋转 | 无 | 完整 6 自由度 |
| 落地 | 停住 | 按材质弹跳 |
| 斜面 | 停在坡上 | 滚下去 |
| 被推 | 只能靠爆炸 | 能被冲量、被玩家攻击、被其它刚体撞 |
| 碰撞箱 | 实体碰撞箱 | 接近一格立方，走隐形潜影贝，**真的挡人** |

---

## 两种引爆方式

`TntService.Detonation`：

=== "`IMPACT` —— 落地即爆"

    接触真实方块立即引爆。

    引信时间退化为「掉进虚空」这类情形的兜底。

    适合：手雷式玩法、定点爆破。

=== "`TIMED` —— 定时弹跳"

    落地反弹、滚动，**引信到期才炸**，期间不破坏被碰到的方块。

    适合：滚进洞里、弹过墙角这类需要「让它先滚一会儿」的玩法。

---

## 尺寸

```yaml
# tnt.yml
block-size: 1.0
```

**碰撞盒、客户端渲染、质量都随它缩放。**

| 值 | 效果 |
|---|---|
| `1.0` | 默认，原版 TNT 大小 |
| `2.0` | 巨型，质量按体积 **×8** |
| `0.5` | 小型 |

下限 0.25。

!!! tip "质量随边长的立方缩放"
    越大越重、**抛得越近**。想要「又大又飞得远」得在发射力度上补回来。

---

## 引擎不内置任何玩家交互

TNT 法杖、面板上的 TNT 按钮都在 addon 里 ——
[工具腰带](../addons/toolbelt.md)的 `tnt_wand`，[管理面板](../addons/panel.md)的「物理 TNT」页。

引擎只通过 `TntService` 暴露发射能力。

---

## API

```java
// 沿玩家视线发射
PhysicsBody tnt = api.tnt().launch(
        world,
        eye.getX(), eye.getY(), eye.getZ(),
        dir.getX(), dir.getY(), dir.getZ(),
        80,                              // 引信 tick（80 = 4 秒）
        4.0f,                            // 爆炸威力（原版 TNT 是 4）
        true,                            // 爆炸时把被破坏方块物理化飞溅
        TntService.Detonation.TIMED);

// 原地生成（零初速度）
PhysicsBody t2 = api.tnt().spawn(world, x, y, z, 80, 4.0f, true,
        TntService.Detonation.IMPACT);
```

返回 `null` 表示 **TNT 系统被关闭或物理不可用** —— 这是正常返回值，不是异常。

`collapseDebris` 为 `true` 时，爆炸被破坏的方块会走[爆炸飞溅](explosion.md)那条链路，
被冲击波掀起并物理化。

---

## 相关

- [`tnt.yml`](../guide/config/tnt.md)
- [爆炸飞溅](explosion.md) —— `collapseDebris` 那条链路
- [工具腰带 addon](../addons/toolbelt.md) —— TNT 法杖
- [接入 API](../api/index.md)
