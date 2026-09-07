# 载具模板

引擎内置六个载具模板，其中四个是**真轮式载具**（射线悬挂 + 轮胎受力）。

想要完整的载具玩法（车库、蓝图搭建、飞机 / 直升机 / 船），看[载具 addon](../../addons/vehicle.md)。
想知道悬挂怎么算的，看[载具实现](../../engine/vehicle.md)。

!!! info "生成入口的现状"
    见[物体模板总览](index.md)顶部的说明。

---

## 参数表

| id | 名称 | 半长 (x, y, z) | 质量 | 外观方块 | 装配 |
|---|---|---|---|---|---|
| `test_car` | 测试车 | 0.5 × 0.3 × 1.0 | 50 | `OAK_PLANKS` | 自动四轮 |
| `green_car` | 绿车 | 0.6 × 0.4 × 1.0 | 50 | `GREEN_WOOL` | 自动四轮 |
| `truck` | 卡车 | 0.85 × 0.4 × 1.3 | 70 | `IRON_BLOCK` | `VehicleSettings.truck()` —— **六轮**，中后双驱动轴 |
| `motorcycle` | 摩托 | 0.3 × 0.35 × 1.2 | 20 | `RED_WOOL` | `VehicleSettings.motorcycle()` —— **两轮**，前轮转向后轮驱动 |
| `test_boat` | 测试船 | 0.5 × 0.3 × 1.0 | 50 | `OAK_BOAT` | 多部件伪载具，**无轮子** |
| `lite_vehicle` | 轻量载具 | 0.4 × 0.25 × 0.8 | 35 | `SPRUCE_PLANKS` | 简化碰撞，性能优先 |

`test_boat` 与 `lite_vehicle` 不装载具控制器 —— 它们是普通多部件刚体。

---

## 三个预设

| 预设 | 轮子 | 手感 |
|---|---|---|
| `VehicleSettings.standard()` | 自动四轮 | 引擎内置默认 |
| `VehicleSettings.truck()` | 6 轮（前轴转向 + 中后双驱动轴） | 重载起步慢、稳定 |
| `VehicleSettings.motorcycle()` | 2 轮（前轮转向 + 后轮驱动） | 轻快、低速不稳、容易翻 |

!!! danger "改轮子布局前先读这一条"
    显式轮子坐标是**绝对局部坐标**（车身质心为原点，+X 右、+Y 上、+Z 车头）。

    ```
    |x| > halfX    轮子必须伸出车身侧面
    |z| < halfZ    z 收在车头内侧
    ```

    轮子与车身盒齐平或嵌在里面时，向下的悬挂射线从车身内部出发，第一个命中的是车身自己 ——
    **车会悬空、给油不走**。

    详见[载具实现 · 轮子几何的红线](../../engine/vehicle.md#轮子几何的红线)。

---

## `VehicleSettings` 有一半字段不再生效

| 仍然生效 | 被忽略 |
|---|---|
| `wheels` · `wheelWidthFactor` | `transmission`（挡位 / 换挡点 / 离合） |
| `suspensionMinLength` / `MaxLength` | `differentials` · `antiRollBars` |
| `engine.maxTorque` | `springFrequency` / `springDamping` |
| `maxBrakeTorque` | `maxHandBrakeTorque` |
| `massRatio` | 摩擦曲线四项 · `maxPitchRollAngle` |

引擎换成射线悬挂的街机模型之后，变速箱 / 差速器 / 防倾杆这些不再有对应物。
字段保留是因为删掉会让所有既有配置报错。

完整说明与换算式见[载具实现](../../engine/vehicle.md#vehiclesettings-里有一半字段不再生效)。

---

## 内置的视角驾驶

右键上车、Shift 下车。驾驶时**玩家的视角就是方向盘**：

| 视角相对车头 | 输入 |
|---|---|
| 正前方 | 油门 1.0，转向 0 |
| 偏左 / 偏右 30° | 油门 cos(30°)，转向 ±0.5 |
| 偏 ±60° | 转向打满，油门降至 0.5 |
| 正后方（±150° 以上） | 刹车 1.0，油门 0 |

驾驶期间玩家位置每帧被吸附到车顶（`worldY + 1.1`），并按油门 / 车速播放引擎声音。

!!! tip "下游插件可以接管"
    `VehicleController.onInteract` 的 `ignoreCancelled` 是 `true` ——
    在自己的 listener 里取消那次 `PlayerInteractEvent`，引擎就让位。

    不取消的话两套驾驶会同时把玩家往各自算的座位上拽，人在车上抖成一团。

---

## 撞击伤害

车速超过 25 km/h 时会撞伤车体包围盒内的**非玩家生物**：

- 伤害随超速比例增加，约每超 10 km/h 多 1 点，**封顶 8 点**
- 每个目标 1 秒冷却，避免「车压着怪」每秒十几跳
- 触发时播放红色方块粒子 + 爆炸音

由 `VehicleImpactHandler` 在主线程每 tick 轮询实现 ——
接触求解只报告刚体之间的接触，生物不是刚体，所以用 `getNearbyEntities` 查询。

这与[撞击后果](../impact.md)（物理方块砸坏真方块 / 砸伤生物）是两套独立机制。

---

## 用 API 生成

```java
PhysicsBody car = api.bodies().spawn(
        SpawnOptions.builder(loc, Material.GREEN_WOOL)
                .type(PhysicsBodyType.VEHICLE)      // ← 必须
                .templateId("green_car")
                .halfExtents(0.6, 0.4, 1.0)
                .mass(50)
                .vehicleSettings(VehicleSettings.standard())
                .build());
if (car != null) {
    car.broadcastTo(loc.getWorld());
    api.vehicles().vehicle(car).ifPresent(v -> {
        v.setThrottle(1.0f);
        v.setSteer(-0.5f);
        v.wheelCount();     // 标准 4 / 卡车 6 / 摩托 2
    });
}
```

`type(PhysicsBodyType.VEHICLE)` 不给的话 `vehicleSettings` 不生效，生成出来的是普通刚体。

---

## 相关

- [载具实现](../../engine/vehicle.md) —— 射线悬挂、模型渲染管线
- [载具 addon](../../addons/vehicle.md) —— 11 种载具、蓝图搭建、五种驱动方式
- [接入 API · 载具与机关](../../api/vehicles.md)
