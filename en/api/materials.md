# 材质 · 效果 · 仿真

三个相对独立的小服务：查材质、放镜头效果、调全局仿真参数。

---

## 物理材质

```java
MaterialService materials = api.materials();

PhysicsMaterial ice = materials.materialFor(Material.ICE);
ice.density();      // 质量倍数
ice.friction();     // 摩擦修正
ice.bounciness();   // 弹性 [0, 1]
ice.airDrag();      // 空气阻力修正
```

三层规则（精确方块名 → 后缀组如 `*_WOOL` → 默认值）已经在返回值里合并完毕，
调用方不需要自己做回退。查询是只读且线程安全的，可以从异步任务调用。

---

---

## 视角效果

```java
api.cameraEffects().ifPresent(fx -> {
    fx.explosionAt(center, 4.0);        // 爆炸：单次冲击 + 快速衰减
    fx.collapseAt(center, blockCount);  // 坍塌：持续低频晃动
    fx.shake(player, 8.0, 2.0, 3.0);    // 自定义：角度 / 频率(Hz) / 衰减
    fx.clear(player);                   // 立刻扳回水平
});
```

返回 `Optional` 是因为这个功能**可以被服主整体关掉**（关掉时整个服务不创建，
稳态零开销）。这与「物理不可用」是两回事，所以用类型区分开。

> ⚠ **效果依赖客户端资源包。** 服务端只发一颗编码过的粒子，真正让画面转起来的是
> 资源包里的着色器。玩家没装资源包时，调用一切正常、返回 `true`，但那个玩家
> **什么都看不到**。排查顺序应该是「先确认玩家装了资源包」而不是「先怀疑 API 没生效」。

> ⚠ 演出结束时**务必 `clear()`**。客户端不知道服务端发生了什么，它只是维持着
> 最后收到的那个角度 —— 不归零的话玩家会一直歪着，只能重进服务器恢复。

频率别超过 5 Hz：服务端发包频率不足会把它混叠成缓慢漂移，观感是「画面莫名其妙地慢慢歪」
而不是「震得更快」。

---

---

## 全局仿真参数

```java
SimulationSettingsService sim = api.simulation();

sim.timeScale();          // 当前时间倍率，1.0 为正常
sim.setTimeScale(0.2f);   // 五分之一慢放

sim.gravity();            // 当前竖直重力，m/s²，向下为负
sim.setGravity(0f);       // 关闭重力（太空关卡）
```

这两个旋钮**同时作用于**坍塌碎块与独立刚体两套物理世界 —— 只调其中一个的话
会出现「碎块慢放了而骰子还是原速」的欺骗性半生效，所以本服务刻意只提供统一入口。

值传入后会被钳到安全区间（时间倍率 `0.05 ~ 4.0`），不会抛异常。设置成功
（值真的变了）后会触发 `PhysicsSimulationSettingsChangeEvent`：

```java
@EventHandler
public void onSimChange(PhysicsSimulationSettingsChangeEvent event) {
    // TIME_SCALE / GRAVITY
    event.getOldValue();   // 旧值
    event.getNewValue();   // 新值
}
```

物理运行时不可用时 getter 返回默认值（时间倍率 `1.0`、重力 `-16`），setter 静默无效。

---

---

## 相关

- [物理材质](../features/materials.md) —— 八个字段各是什么
- [视角滚转](../features/camera-roll.md) —— 客户端前置条件
- [`materials.yml`](../guide/config/materials.md)
