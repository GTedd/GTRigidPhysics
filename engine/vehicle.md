# 载具

> 源码：`physics/VehicleController.java`、`paper/object/PhysicsObjectService#spawnVehicle`、
> `paper/object/ModelRender.java`

**射线悬挂 + 轮胎受力**，作用在一个普通刚体上。轮子不是刚体。

想知道怎么开、有哪些车型，看[载具模板](../features/objects/vehicle.md)；这一页讲它怎么实现。

---

## 为什么是射线悬挂

把每个轮子做成独立刚体、再用铰链接到车身上，物理上更「正确」，但代价极高：

- 轮子与地面之间是**滚动**接触，求解器要在极小的接触斑上解出巨大的法向力 —— 稍有不慎就是抖动或陷地
- 轮子刚体在**体素世界的接缝**上会不停被绊住

射线悬挂是所有游戏载具的通行做法：轮子是一条**向下的射线**。
射线打到地面就按压缩量给车身一个弹簧-阻尼力，轮胎的驱动力与侧向抓地力直接施加在接触点上。

于是：

| 现象 | 从哪来 |
|---|---|
| 加速抬头、刹车点头 | 四个悬挂力的不均衡 —— **自然涌现** |
| 过弯侧倾 | 侧向力作用在接触点，力臂到质心 —— **同样涌现** |
| 没有任何滚动接触数值噩梦 | 因为压根没有滚动接触 |

---

## 标定取向：街机而非仿真

!!! important "不做传动比、差速器、轮胎滑移曲线"
    方块世界里的车，玩家要的是「开起来跟手」，不是扭矩曲线正确。

    所有参数都直接以「加速度」「抓地力上限」表达。

| 常量 | 值 | 含义 |
|---|---|---|
| `DEFAULT_STIFFNESS` | 24.0 | 悬挂弹簧刚度，单位是「每格压缩量产生多少个 g 的加速度」 |
| `DEFAULT_DAMPING` | 0.35 | 悬挂阻尼（相对临界阻尼的比例）。过弯不晃、过坎不跳 |
| `LATERAL_GRIP` | 1.6 | 轮胎侧向抓地力上限，相对该轮承受的法向力 |
| `LONGITUDINAL_GRIP` | 1.2 | 轮胎纵向抓地力上限（驱动与刹车共用） |

---

## `VehicleSettings` 里有一半字段不再生效

这是一处**已知且刻意保留**的不一致，必须说清楚，否则调参的人会白花时间。

`VehicleSettings` 是 `api` 模块的公开契约，它成型于引擎还基于通用物理库的时期，
带着完整的引擎 / 变速箱 / 差速器 / 防倾杆模型。现在的射线悬挂实现只读其中一部分：

=== "仍然生效"

    | 字段 | 用途 |
    |---|---|
    | `wheels` | 轮子布局（位置 / 半径 / 转向 / 驱动角色） |
    | `wheelWidthFactor` | 轮宽 = 半径 × 系数（只影响外观） |
    | `suspensionMinLength` / `suspensionMaxLength` | 取两者均值作为悬挂静止长度 |
    | `engine.maxTorque` | 换算成 `enginePower = clamp(maxTorque / 60, 4, 24)` |
    | `maxBrakeTorque` | 换算成 `brakePower = clamp(maxBrakeTorque / 60, 6, 30)` |
    | `massRatio` | 最终质量 = 车身质量 × 系数 |

=== "被忽略"

    | 字段 | 说明 |
    |---|---|
    | `transmission`（齿比 / 换挡点 / 离合） | 没有挡位这个概念了 |
    | `differentials` | 驱动力直接给到标记为驱动轮的轮子 |
    | `antiRollBars` | 侧倾由悬挂力自然产生，不再单独抑制 |
    | `springFrequency` / `springDamping` | 用固定的 `DEFAULT_STIFFNESS` / `DEFAULT_DAMPING` |
    | `maxHandBrakeTorque` | 手刹与刹车共用一套 |
    | `longitudinalFriction*` / `lateralFriction*` / `frictionFalloffSpeed` | 用固定的 `LONGITUDINAL_GRIP` / `LATERAL_GRIP` |
    | `maxPitchRollAngle` | 不再夹角度 |
    | `engine` 的其余字段（`maxRpm` / `minRpm` / `inertia` / `torqueCurve`） | 只取 `maxTorque` |

!!! question "为什么不把它们删掉"
    删掉会让**所有既有配置报错**。而它们留在那里被忽略是无害的 ——
    调大 `maxTorque` 车确实更猛，只是不再有挡位。

    源码里 `PhysicsObjectService` 那一段有同样的注释，两处说的是一回事。

    如果哪天要恢复这些能力，正确的做法是在 `VehicleController` 里实现它们，
    而不是改 `VehicleSettings` 的形状。

---

## 输入与激活

```java
controller.setInput(throttle, steer, brake, handBrake);
```

主线程写 volatile 输入，物理线程每步读。`MAX_STEER_ANGLE` 由装配时给定。

可读回的状态：

```java
double  wheelAngle(int i);        // 轮子转过的角度（渲染滚动用）
double  wheelCompression(int i);  // 悬挂压缩量
boolean wheelGrounded(int i);     // 该轮是否触地
double  steerAngle();
double  forwardSpeed();
void    wheelWorldPose(int i, double[] outPos, float[] outRot);
```

!!! warning "有输入必须唤醒刚体"
    车身落地后会进入休眠，休眠体不积分。驾驶期间只要有任一输入非零就应激活刚体，
    否则「给油不走」。

---

## 轮子几何的红线

显式轮子坐标是**绝对局部坐标**：以车身质心为原点，+X 右、+Y 上、+Z 车头方向。

!!! danger "轮子必须伸出车身侧面"
    ```
    |x| > halfX     轮子伸出车身侧面
    |z| < halfZ     z 收在车头内侧
    ```

    轮子若与车身盒齐平或嵌在里面，向下的悬挂射线**从车身内部出发**，
    第一个命中的就是车身自己 —— 车会悬空、给油不走。

    改轮子布局之前先跑 `physics` 模块的载具测试。

`wheels` 为空列表时按车身半长自动推导四个轮子（下标 0/1 后轮、2/3 前轮可转向）。

---

## 拼装外观模型（`BodyModel`）

车辆默认渲染成「一个车身方块 + 每轮一个方块」，够验证物理，但不像车。

`SpawnOptions.model(...)` 让外观改由**部件表**决定：一组 `ModelPart`，
每个是「一件物品 + 一份相对质心的局部变换（位移 + 四元数 + 缩放）」。

### 两条并行的渲染路径

| | 无模型 | 有模型 |
|---|---|---|
| 车身 | 1 个 `BlockDisplay` 乘客 | N 个 `ItemDisplay` 乘客，各带自己的局部旋转与缩放 |
| 轮子 | 每轮 1 个 `BlockDisplay` | 每轮 N 个 `ItemDisplay`（轮胎 / 轮毂 / 挡泥板可分开） |
| 姿态 | `left_rotation` = 车身四元数 | `left_rotation` = 车身四元数 **×** 部件局部四元数 |
| `material` | 决定外观 | 只查物理参数，不决定外观 |

按 `modelRender != null` 分叉。

### `ModelRender` 是编译产物

`ItemStack` 在生成时转一次 packetevents 形式并存下来，之后每帧只是把同一个不可变对象塞进包里。

!!! note "现转的代价"
    一辆 128 部件的车、20 个观众、每 tick 一次 —— 现转的话是**每秒五十万次 NBT 编解码**。

轮子实体从一维数组改成了 `wheelPartIds[轮子][部件]`，并新增 `wheelCount` 独立记录轮子数：
模型声明的轮子槽位可能比物理轮子少（只给前轮建了模），那时两者不是一回事。

### `ItemDisplay` 的两个 metadata 索引

`ItemDisplay` 与 `BlockDisplay` 是 `Display` 的两个**平级子类**，各自从父类占满的 8~22 之后接着数：

| 字段 | 索引 | 所属 |
|---|---|---|
| `BLOCK_STATE` | 23 | `BlockDisplay` |
| `ITEM` | 23 | `ItemDisplay` |
| `ITEM_DISPLAY`（渲染上下文） | 24 | `ItemDisplay` |

23 重复**不是笔误** —— 同一个实体只可能是其中一种。
`DisplayMetadataTest` 为此单独放行了这三个字段，同时断言「两个子类的第一个自有字段索引必须相同」，
不同就说明其中一张表数错了。

### 生成瞬间的四元数

生成包可能在物理线程算出第一帧位姿**之前**就发出去。

零四元数写进 `left_rotation` 会被客户端当成**零缩放**，整个模型消失 ——
所以 `rotW` 与 `wheelRotW` 都初始化成 1。

轮子位置同理：物理没跑过时数组全是 0，直接用会把轮子扔到世界原点。
因此有 `wheelsKnown` 标志，未初始化时退回车身位置，第一帧到达后自然被 teleport 修正。

### 部件自旋

给了自旋参数的部件（直升机旋翼、螺旋桨）会绕指定的**局部轴**匀速转。

渲染姿态是 `车身四元数 × 自旋四元数 × 部件局部四元数`，偏移也过一次自旋 ——
于是旋翼支架末端的桨叶会绕轴划圈，而不是原地打转。

!!! important "相位由 `System.nanoTime()` 直接算，不是每帧累加"
    累加有两个问题：

    1. 每个观众收到包的频率不同（LOD 给远处的人降频），同一副旋翼在不同人屏幕上的相位慢慢分岔
    2. 服务器卡一下之后旋翼会**永久地**慢半圈

    算角度前先对一整圈取模 —— `nanoTime` 跑几小时后乘上角速度得到的弧度值会大到
    `float` 分辨不出「转了多少度」，旋翼开始抖。

`ModelRender.hasSpin()` 让 `isViewActive()` 对有旋翼的物体恒为真：
直升机悬停时车身几乎不动，姿态本来不用发，可旋翼必须一直转 —— 停下来的旋翼比抖动的更出戏。

!!! warning "转速有实际上限"
    姿态每隔几 tick 才广播一次，客户端在两次广播之间走**最短路径**插值。
    单次间隔内转过 180° 以上会看起来倒着转。默认广播间隔下安全上限约 **1800 度/秒**。

### 内置驾驶要让位

`VehicleController.onInteract` 的 `ignoreCancelled` 是 `true`。

内置视角驾驶只是兜底实现，下游插件可能要用自己模型里的座位锚点。
它们的做法是在自己的 listener 里取消这次交互 —— 引擎认这个信号，
否则两套驾驶会同时把玩家往各自算的座位上拽，人在车上抖成一团。

---

## 非轮式载具在 addon 侧

引擎只提供**轮式车**的动力学。船、飞机、直升机、飞碟不装载具控制器 ——
它们是普通刚体，力学写在 `examples/vehicle-addon` 的控制律里，用的全是公开 API。

!!! quote "这个分工是刻意的"
    **引擎不该内置一套飞行手感。**

    飞行手感是玩法的一部分，不同服务器要的完全不同（拟真 / 街机 / 竞速），
    做进引擎等于替所有人做了决定 —— 而这些东西用公开 API 全都写得出来，addon 本身就是证明。

引擎为此补的只有两样**通用**能力：运动状态读写与重力系数、部件自旋。
两样都不是「为飞机而加」，任何需要写控制律或做旋转机械的下游插件都用得上。

详见 [载具 addon](../addons/vehicle.md)。

---

## 相关

- [载具模板](../features/objects/vehicle.md) —— 车型、驾驶、撞击伤害
- [力记账](force-ledger.md) —— `SUSPENSION` / `TIRE` / `PROPULSION` 分组就是为标定载具而设
- [表现层发包](view-packets.md) —— `ItemDisplay` 与骑乘组
- [接入 API](../api/vehicles.md) —— `VehicleService` / `VehicleSettings`
