# 刚体

生成、施力、查询、移除。`api.bodies()` 是最常用的一个服务。

---

## 刚体：生成与施力

```java
PhysicsBodyService bodies = api.bodies();
```

### 3.1 生成

最简单的形态：

```java
PhysicsBody die = bodies.spawnCube(
        loc,                    // 生成位置（质心）
        Material.GOLD_BLOCK,    // 外观方块
        0.25,                   // 半边长（格）→ 0.5 格大小
        17.0);                  // 质量
```

需要非正方体、初速度或分类时用 `SpawnOptions`：

```java
SpawnOptions options = SpawnOptions.builder(loc, Material.OAK_SLAB)
        .templateId("my_domino")
        .type(PhysicsBodyType.DOMINO)
        .halfExtents(0.5, 1.0, 0.1)   // 薄立板
        .mass(8.0)
        .velocity(0, 0, -3)            // 向 -Z 推出
        .build();

PhysicsBody plank = bodies.spawn(options);
```

`SpawnOptions` 在 `build()` 时校验参数，非法值当场抛 `IllegalArgumentException`
（比如半边长小于 0.05 —— 低于接触半径的形状会导致刚体穿地）。

### 3.2 施力

```java
// 对质心施加冲量：只改线速度，不转
body.applyImpulse(0, 17, 0);          // 质量 17 的物体 → 约 1 m/s 起跳

// 力偶矩：只转，不动
body.applyTorque(0, 5, 0);

// 径向冲量：从某点推开，同时产生翻滚（爆炸该有的观感）
body.applyRadialImpulse(explosionCenter, 50.0);

// 批量：推开半径内所有刚体，按距离线性衰减
int affected = bodies.applyExplosion(center, 4.0, 1.0);

// 对玩家准星所指的刚体施力
bodies.applyImpulse(player, 2.0);
bodies.applyTorque(player, 1.0);
```

> `applyExplosion` **只推刚体** —— 不破坏方块、不伤害实体、不出粒子音效。
> 要完整的爆炸表现，自行叠加 `World#createExplosion` 与
> `CameraEffectService#explosionAt`。

### 3.3 查询与移除

```java
for (PhysicsBody body : bodies.activeBodies()) {   // 返回快照副本
    if (!body.isAlive()) continue;                  // 快照里可能已有失效句柄
    if (body.isSleeping()) continue;                // 求解器挂起了它以省 CPU
    ...
}

int count = bodies.activeBodyCount();               // 比 activeBodies().size() 便宜
bodies.removeNear(center, 10.0);
bodies.removeAll();
body.remove();                                       // 幂等
```

### 3.4 刚体不是实体

刚体在服务端**没有对应的 `Entity`**，外观是直接发给客户端的虚拟 BlockDisplay。所以：

- 拿不到 `Entity`，`World#getEntities()` 也找不到；
- 不占实体计数，不写进世界存档；
- `/kill @e` 清不掉；
- 服务器重启后不恢复 —— 刚体是进程内状态，不做持久化。

完整朝向请读 `rotationX/Y/Z/W()` 四元数分量。`location()` 只能表达 yaw/pitch，
而刚体是可以绕任意轴翻滚的。

---

---

## 相关

- [物体模板](../features/objects/index.md) —— 标定过的参数，照着填能复现同样手感
- [事件](events.md) —— `PhysicsBodySpawnEvent` / `RemoveEvent` / `GrabbedEvent`
- [载具 · 机关 · 角色](vehicles.md)
- [质量与惯性张量](../engine/mass.md) —— 为什么只用给尺寸和质量
