# 载具 · 机关 · 角色

三种在通用刚体之上搭出来的专用运动模型。

---

## 车辆（真实驱动）

`VEHICLE` 类型的刚体自动装配载具控制器 —— 射线悬挂 + 轮胎受力、
引擎扭矩、自动变速箱、差速器。`vehicles()` 提供驾驶控制：

```java
VehicleService vehicles = api.vehicles();

// 生成真实车辆（VEHICLE 类型自动装配载具控制器）
PhysicsBody body = api.bodies().spawn(SpawnOptions.builder(loc, Material.GREEN_WOOL)
        .type(PhysicsBodyType.VEHICLE)
        .templateId("green_car")
        .halfExtents(0.6, 0.4, 1.0)
        .mass(50)
        .build());
// 不需要做任何「让玩家看到」的事：附近的玩家会在 100 毫秒内自动看到它。
// 可见性由引擎的带宽闸门按距离逐玩家裁决，详见 PhysicsBody.broadcastTo 的说明。

// 拿到车辆句柄手动驾驶（油门/转向/刹车/手刹）
vehicles.vehicle(body).ifPresent(v -> {
    v.setThrottle(1.0f);   // 全油门
    v.setSteer(-0.5f);     // 左转
    v.setBrake(0.0f);
    v.speedKmh();          // 当前速度（km/h）
});

// 或让玩家上车，用内置「视角驾驶」（右键上车、Shift 下车）
vehicles.drive(player, body);
vehicles.isDriving(player);
vehicles.stopDriving(player);
```

车辆与伪驾驶的区别：真实车辆有悬挂压缩、轮子滚动、起步换挡与过弯侧倾。
详见[车辆系统](../engine/vehicle.md)。

### 12.1 拼装外观：让它看起来像辆车

刚体的默认外观是**一个方块**，够骰子和木板用；一辆车是几十块台阶、栅栏、
头颅拼出来的，只能逐部件描述。`SpawnOptions.model(...)` 接受一份
`BodyModel` —— 一组 `ModelPart`，每个是「一件物品 + 一份相对质心的局部变换」：

```java
BodyModel model = BodyModel.builder()
        // 车身零件：跟着刚体翻滚
        .add(ModelPart.builder(new ItemStack(Material.QUARTZ_SLAB),
                        ItemDisplay.ItemDisplayTransform.HEAD)
                .offset(0f, 0.2f, 0.4f)
                .rotation(0f, 0.7071f, 0f, 0.7071f)   // 局部朝向（四元数）
                .scale(0.625f)
                .build())
        // 轮子零件：跟着第 0 个物理轮子走
        .add(ModelPart.builder(wheelHead, ItemDisplay.ItemDisplayTransform.HEAD)
                .offset(0f, 0f, 0f)
                .scale(1.1875f)
                .wheel(0)
                .build())
        .build();

PhysicsBody body = api.bodies().spawn(SpawnOptions.builder(loc, Material.IRON_BLOCK)
        .type(PhysicsBodyType.VEHICLE)
        .vehicleSettings(settings)
        .model(model)             // ← 外观改由部件表决定
        .build());
```

两点值得注意：

- **给了模型之后 `material` 不再决定外观**，它退化成纯物理属性来源
  （密度 / 摩擦 / 碰撞音效的查表键）。也因此不再要求它是方块。
- **`wheel(index)` 是这套东西最有意思的地方**：绑上去的零件不跟车身，
  而跟第 N 个物理轮子 —— 悬挂压缩、转向角、滚动角全由载具控制器每帧算出，
  模型照着转。上马路牙子时轮子真的被顶上去，漂移时真的横过来，
  这不是动画播放。

部件数就是每个观众的虚拟实体数：一辆 128 部件的车比 34 部件的贵四倍带宽。
引擎会按距离逐玩家裁决可见性并对姿态更新设配额，但部件数仍然是
「外观精度 ↔ 带宽」之间最直接的那个旋钮。

部件还可以**自转**（直升机旋翼、螺旋桨、雷达）：

```java
ModelPart.builder(blade, ItemDisplay.ItemDisplayTransform.HEAD)
        .offset(0f, 1.2f, 0f)
        .spin(0f, 1f, 0f, 780f)   // 绕局部 +Y，每秒 780 度
        .build();
```

轴是局部坐标的，会跟着刚体一起翻滚 —— 直升机侧倾时旋翼跟着倾，
而不是固执地绕世界 Y 轴转。相位由绝对时间算出，所有观众看到的一致，
也不受发包频率影响。转速有个实际上限：姿态每隔几 tick 才广播一次，
客户端在两次广播之间走最短路径插值，单次间隔内转过 180° 以上会看起来倒着转
（默认广播间隔下安全上限约 1800 度/秒）。

完整的用法见源码仓库的 `examples/vehicle-addon`
—— 它把一套盔甲架格式的车辆模型换算成了 `BodyModel`，十一种载具全都在用。

### 12.2 运动状态：读得到速度，才写得出控制律

只有施力接口的话，能做的只是「一直推」。想让一架直升机悬停、让一条船不打滑、
让飞机不翻过来，都得先知道它现在多快、转多快：

```java
// 读
double vx = body.velocityX(), vy = body.velocityY(), vz = body.velocityZ();
double wy = body.angularVelocityY();          // 绕 Y 的角速度（rad/s）

// 写。setVelocity 是覆盖而不是叠加，绕过了动量守恒 ——
// 日常推进请优先用 applyImpulse，这个留给「限速」「立刻停住」
body.setVelocity(0, 0, 0);
body.setAngularVelocity(0, desiredYawRate, 0);

// 悬浮载具用它省掉「每帧施加一份抵消重力的冲量」
body.setGravityFactor(0);                      // 完全失重
```

⚠ `setGravityFactor` **会被浮力系统覆盖**：刚体一旦浸入水或岩浆，引擎按浸没比例
与密度接管重力系数，离开流体后还原成 `1.0`（而不是你设的值）。所以这个旋钮只在
「不下水的载具」上稳定 —— 要在水里做浮沉，靠材质密度而不是这里。

---

---

## 机关（铰链 / 滑块）

机关是「带约束马达的刚体」—— 铰链让刚体绕轴旋转、滑块让刚体沿轴平移。
`mechanisms()` 提供马达控制：

```java
MechanismService mechanisms = api.mechanisms();

// 机关由模板生成（windmill 风车 / piston 活塞），API 只做控制
api.bodies().activeBodies().stream()
    .filter(b -> b.templateId().equals("windmill"))
    .findFirst()
    .flatMap(api.mechanisms()::mechanism)
    .ifPresent(m -> {
        m.setTargetVelocity(3.0f);   // 加速旋转（速度马达）
        // 或 m.setTargetPosition(0.5f);  // 活塞推到行程中点（位置马达）
        // 或 m.disableMotor();           // 停住
        m.currentValue();              // 当前角 / 位置
    });

mechanisms.activeMechanisms();  // 所有存活机关
```

详见[机关系统](../engine/constraints.md)。

---

---

## 虚拟角色

角色是 `CharacterVirtual` 驱动的**运动学胶囊** —— 不占刚体预算，沿地面行走、
爬台阶、被刚体 / 地形阻挡。`characters()` 提供角色控制：

```java
CharacterService characters = api.characters();

// 生成一个角色（半径 0.3，高 2.0）
Character npc = characters.spawn(loc, 0.3, 2.0);
if (npc != null) {
    npc.setWalkVelocity(1.0, 0, 0);   // 向东走 1 m/s
    npc.position();                    // 当前位置
    npc.isOnGround();                  // 是否着地
    npc.teleport(x, y, z);             // 瞬移
    npc.remove();                      // 移除
}

characters.activeCharacterCount();  // 当前角色数
characters.removeNear(center, radius);
```

详见[角色系统](../engine/character.md)。

---

---

## 相关

- [载具模板](../features/objects/vehicle.md) —— 内置车型与驾驶
- [载具实现](../engine/vehicle.md) —— 射线悬挂，以及 `VehicleSettings` 哪些字段已不生效
- [约束系统](../engine/constraints.md) —— 机关背后的四类约束
- [虚拟角色](../engine/character.md) · [布娃娃](../engine/ragdoll.md)
- [载具 addon](../addons/vehicle.md) —— 一个完整玩法系统的写法
