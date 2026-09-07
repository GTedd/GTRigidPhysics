# 力场

引力井（黑洞）与磁力场（磁极）。两者共用同一个施力通道，区别只在语义。

---

## 引力场（黑洞）

```java
GravityFieldService fields = api.gravityFields();

// 在 (100, 64, 100) 造一个黑洞：半径 12 格，强度 2.0
GravityField blackHole = fields.createField(
        new Location(world, 100, 64, 100), 2.0, 12.0);

blackHole.strength();       // 2.0
blackHole.radius();         // 12.0
blackHole.setStrength(3.0); // 临时加强（钳到 [0, 20]）

fields.activeFieldCount();  // 当前黑洞数

blackHole.remove();         // 移除（幂等）
fields.removeAll();         // 清空所有黑洞
```

黑洞会把半径内的**独立刚体**（骰子、载具、木板）持续吸向中心，足够靠近时被
**吞噬**（销毁并移除）。不同质量刚体获得不同吸力 —— 轻骰子被吸入快、
重载具被吸入慢，观感上「质量越大越难逃脱」。

黑洞自带视觉（黑色脉动方块 + 中心冒烟），创建后全世界的玩家都能看到。

> ⚠ 只作用于独立刚体，不作用于建筑坍塌的碎块（那是另一套物理世界）。

---

---

## 磁力场（磁极）

```java
MagneticFieldService magnetics = api.magnetics();

// 吸引磁极（北极，红色）：强度 3，半径 10
MagneticField attract = magnetics.createField(
        new Location(world, 10, 64, 10), 3.0, 10.0);

// 排斥磁极（南极，蓝色）：强度 -3
MagneticField repel = magnetics.createField(
        new Location(world, -10, 64, 10), -3.0, 10.0);

repel.strength();            // -3.0（正吸负斥）
repel.setStrength(-5.0);     // 调强排斥（钳到 [-20, 20]）

magnetics.activeFieldCount();  // 当前磁极数
magnetics.removeAll();         // 清空所有磁极
```

磁力与黑洞的区别：**强度符号决定极性**（正 = 吸引，负 = 排斥），且**永不吞噬刚体**
—— 被排斥的物体飞出去后可以再回来。这让磁力适合做「推拉机关」「磁轨引导」这类
需要可逆交互的玩法。

> ⚠ `setStrength` 改符号只改物理行为，不改变创建时定好的视觉颜色
> （红 = 北极，蓝 = 南极）。想换极性视觉就重建一个场。

---

---

## 相关

- [力系统](../engine/forces.md) —— 场力属于 B 类
- [力记账](../engine/force-ledger.md) —— 场力归 `ForceGroup.FIELD`
