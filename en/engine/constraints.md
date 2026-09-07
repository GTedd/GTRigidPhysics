# 约束系统

> 源码：`engine/Constraint.java`、`engine/Constraints.java`、`physics/MechanismHandle.java`

约束是接触之外的另一类「该等于零的量」：铰链、滑轨、球铰、关节限位。
机关（门、活塞、风车、转盘）与布娃娃的关节全部由它们搭出来。

---

## 为什么 XPBD 做约束特别顺

约束在位置基求解器里**就是它本来的样子** —— 一个该等于零的量。

- 铰链 = 「两个锚点重合 + 两根轴共线」
- 滑轨 = 「锚点差只允许落在一根轴上 + 姿态相同」

冲量法要先把这些几何条件**微分成速度约束**，再解一个线性互补问题。
位置法直接把它们投影掉 —— 写出来几乎就是几何定义本身。

!!! tip "驱动也一样直接"
    铰链马达按「目标角速度」驱动，实现方式是每个子步把两侧的相对角度朝目标推进 `targetSpeed × h`。
    位置法里驱动就是这么一句话，不需要马达冲量、力矩上限、弹簧刚度这一整套间接层。

---

## 约束走顺序求解，接触走雅可比

这是一个刻意的不对称，理由值得说清楚。

接触必须雅可比平均，是因为**一个平面落地会同时产生九个共面且对称的接触**，
顺序求解的方向偏置会把刚体转起来（详见 [XPBD 求解器](xpbd.md#为什么必须雅可比平均)）。

约束**没有这个形态**：

- 一根铰链就是一条约束
- 一个机关上也不过三五条
- 布娃娃一个关节一条

没有「大量共面对称约束」这回事，顺序求解反而收敛更快。

---

## 四种约束

所有角度约束都化归成同一个原语 ——**一个旋转误差向量**，由 `Constraint.projectRotation` 统一投影掉。

### 点约束（球铰）`Constraints.Point`

把两个锚点拉到一起。**三个平动自由度全锁，转动完全自由。**

用途：吊灯、吊桥、锁链。

```java
// anchorA 是 A 上相对质心的局部坐标
// B 传 null 时，anchorB 那三个数是世界坐标（锚在世界固定点上）
new Constraints.Point(a, b, ax, ay, az, bx, by, bz);
```

### 铰链 `Constraints.Hinge`

锚点重合 + 两根轴共线，**只剩绕轴一个自由度**。

用途：门、转盘、风车、摆锤。

可选：

| 能力 | 说明 |
|---|---|
| 马达 | 按**目标角速度**驱动 |
| 角度限位 | 上下限，超出即拉回 |

### 滑轨 `Constraints.Slider`

锚点差只允许落在一根轴上，**姿态完全锁死**。

用途：活塞、升降台、抽屉。

可选：

| 能力 | 说明 |
|---|---|
| 马达 | 按**目标线速度**驱动 |
| 行程限位 | 上下限 |

轴向 `axisX/Y/Z` 是 **A 的局部坐标**。

### 摆动扭转 `Constraints.SwingTwist`

点约束 + 一个**圆锥**限位。布娃娃的每个关节都是它。

!!! success "锥内完全自由是关键"
    只在超出锥角时才施加修正。于是四肢在自然摆动范围内不受任何干扰，
    只有被扭到不该有的角度时才被拉回来。

    这正是布娃娃「像人而不像木偶」的分水岭 —— 木偶感来自关节被持续修正，
    哪怕修正量很小，也会让运动显得有阻滞。

`coneRadians` 是相对 A 的扭转轴允许的最大摆角。

---

## 平台层看到的：`MechanismHandle`

铰链与滑轨在引擎里是两个不同的类，各有各的马达语义（一个角速度、一个线速度）。
但平台层要做的只有三件事：**驱动它、读当前值、拆掉它**。

```java
public interface MechanismHandle {
    /** speed：铰链是 rad/s，滑轨是 格/s。0 表示松开，任其自由 */
    void motor(double speed);

    /** 铰链返回转过的角度（弧度），滑轨返回行程（格） */
    double value();

    void limit(double min, double max);
    void remove();
}
```

!!! note "为什么要收成一个接口"
    这样 `paper` 层就**不必也无法**看见 `physics.engine` 包 —— 构建里有 forbidden-import 检查守着这条线。

    它顺带解决了一个真实的耦合：从前 `paper` 层为了驱动马达要 `instanceof` 出具体约束类型再调各自的 setter，
    于是「机关有哪几种」这件事在两个模块里各写了一遍，加一种就要改两处。

创建入口在 `ObjectPhysicsWorld`：

```java
MechanismHandle addHinge(int id, ...);
MechanismHandle addSlider(int id, double axisX, double axisY, double axisZ);
Constraint addSwingTwistConstraint(int parentId, ...);   // 布娃娃用，不走 handle
void removeConstraint(Constraint constraint);
```

---

## 失效与清理

约束持有两侧刚体的引用。任一侧被移除时，约束标记为 `broken`，**下一帧由世界统一清理**。

不立刻清理是因为移除可能发生在求解过程中 —— 边遍历边删是最容易写出并发缺陷的地方。

---

## 相关

- [XPBD 求解器](xpbd.md) —— 位置投影的通用机制
- [布娃娃](ragdoll.md) —— `SwingTwist` 的主要消费方
- [载具](vehicle.md) —— 悬挂不走约束，走力（见 `ForceGroup.SUSPENSION`）
- [接入 API](../api/vehicles.md) —— `MechanismService` 的对外契约
