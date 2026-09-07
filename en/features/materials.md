# 材质系统

## 概述

GTRigidPhysics 的物理材质系统定义了方块在刚体模拟中的物理行为：多重、多滑、多弹、多飘。材质模型刻意与 Minecraft 26.2 新增的三个物理属性语义对齐，使得同一份配置既能驱动物理刚体、又能通过原版 Attribute API 应用到实体上。查找采用三层覆盖机制，尤其支持按名称后缀批量配置——一行 `_WOOL` 替代 16 行精确配置。

参考：DESIGN.md 15。

---

## PhysicsMaterial record 的五字段

```java
public record PhysicsMaterial(
    double density,        // 密度倍数，1.0 为基准
    double friction,       // 摩擦修正系数
    double bounciness,     // 弹性，绝对值 [0, 1]
    double airDrag,        // 空气阻力修正系数
    double fractureSpeed)  // 落地破碎阈值（m/s）
```

| 字段 | 含义 | 默认值 | 对物理的影响 |
|---|---|---|---|
| `density` | 密度倍数 | 1.0 | 质量 = 体积 x 密度，碰撞时谁推动谁 |
| `friction` | 摩擦系数 | 1.0 | 碎块滑行距离、斜坡能否站稳 |
| `bounciness` | 弹性 | 0.0 | 0 = 完全不回弹，1 = 完全弹性 |
| `airDrag` | 空气阻力 | 1.0 | 影响下落速度与翻滚减速 |
| `fractureSpeed` | 破碎阈值 | 永不破碎 | 落地冲击超过它就碎掉而不是原样写回 |

构造时自动夹范围，防止极端值：

- density: `[0.001, 1000]`
- friction: `[0, 2048]`
- bounciness: `[0, 1]`
- airDrag: `[0, 2048]`
- fractureSpeed: `<= 0` 一律视为「永不破碎」

---

## 落地破碎（`fractureSpeed`）

树叶从高处摔在地上还完好如初，这不符合常识。破碎阈值就是用来消除这类违和感的。

**这条机制现在有两条应用路径**，共用一个「撞击后果」语义（`impact.yml` 控制开关与限流）：

| 路径 | 谁触发 | 判定时机 |
|------|--------|----------|
| 坍塌碎块落地 | 碎块写回前，`SettleService` 逐方块判定 | 峰值速度（沿途记录的最大速度） |
| 物理枪/法杖独立物体 | 高速撞上真实地形，`CollisionImpactHandler`（ContactListener） | 接触瞬间的实时速度 |

两种材质的后果：

- **脆**（撞击速度 > `fractureSpeed`）→ **自己碎**：玻璃、树叶落地即碎，因为撞不坏地面
- **硬**（`fractureSpeed` = 永不碎，速度 > `impact.min-break-speed`）→ **砸坏被撞方块**：石头从高处落下把地面砸出坑

### 判据是「峰值速度」而不是落地那一刻的速度

落地写回发生在刚体**休眠之后**，那一刻速度恒为 0——读当前速度永远得到「轻轻放下」的结论，从 30 格高摔下来的树叶和原地放置的树叶毫无区别。

所以由物理线程沿途记录每个刚体达到过的**最大**线速度，随 `PoseSnapshot` 一起发布给主线程：

```
CollapseSimulation.captureInto()  →  peakSpeeds[i] = max(peakSpeeds[i], readSpeed(bodyId))
                                   →  PoseSnapshot.peakSpeed(slot)
                                   →  SettleService 逐方块比对 fractureSpeed
```

### 破碎时走原版破坏流程

碎掉的方块不是「凭空消失」，而是**先放上去再 `breakNaturally()`**。这样才走得到方块自己的掉落表：

- 树叶碎掉 → 按概率掉树苗/木棍，多数时候什么都不掉
- 玻璃碎掉 → 什么都不掉
- 矿石碎掉 → 掉原矿

顺带白拿原版的破碎粒子与音效。代价是两次方块更新，但只有真正碎掉的那一小部分会走到这里。

### 阈值怎么定

想的应该是「从几格高摔下来该碎」，再按自由落体反查速度，而不是直接拍一个数：

| 落差 | 速度 ≈ √(2·16·h) |
|---|---|
| 1 格 | 5.7 m/s |
| 2 格 | 8.0 m/s |
| 3 格 | 9.8 m/s |
| 5 格 | 12.6 m/s |
| 10 格 | 17.9 m/s |
| 20 格 | 25.3 m/s |
| 30 格 | 31.0 m/s |

其中的 16 是 `physics.yml` 的 `gravity` 默认值（原版落沙的尺度，见
[物理配置](../guide/config/physics.md#11-重力)）。**改了重力这张表就要重算**，
表里所有 `fracture-speed` 也要跟着乘同样的比例，否则会变成「什么都摔不碎」。

刚体速度上限是 `MAX_BLOCK_SPEED = 35 m/s`，所以任何大于它的阈值都等价于永不破碎。

`materials.yml` 里已配的默认值：

| 方块组 | `fracture-speed` | 约等于 |
|---|---|---|
| `_GLASS_PANE` / `_STAINED_GLASS_PANE` | 4.0 | 落 0.8 格 |
| `_GLASS` / `_STAINED_GLASS` | 5.0 | 落 1.3 格 |
| `_LEAVES` | 6.0 | 落 1.8 格 |
| `_ICE` | 7.0 | 落 2.5 格 |
| `_CARPET` | 8.0 | 落 3.3 格 |
| `_SAPLING` / `_MUSHROOM` | 3.5 | 一碰就散 |
| `_FLOWER` / `_FUNGUS` / `_DECORATED_POT` | 3.0 | 一碰就散 |

其余方块不配，即永不破碎。

> **不填 = 永不破碎，`0` 与负数也是。** 漏填是最常见的配置失误，而反过来的后果是玩家的建筑一碰就整片消失。`FractureTest` 专门锁了这条语义。

### 与落地规则的关系

破碎只在该方块的落地模式是 `RESTORE` 时才判定。区域规则已经是 `DROP` 或 `VANISH` 的，说明服主本来就不想让废墟留下来，再叠一层破碎没有意义。

---

## 与 Minecraft 26.2 新增 Attribute 的语义对齐

26.2 给原版新增了 5 个 Attribute，其中**三个与物理直接相关**（另外两个 `NAME_TAG_DISTANCE` / `BELOW_NAME_DISTANCE` 是 UI 用途）。

| 材质字段 | 原版属性 | 原版默认 / 范围 | 引擎里对应什么 |
|---|---|---|---|
| `friction` | `FRICTION_MODIFIER` | 1.0 / [0, 2048] | 接触约束的切向系数 `contactFriction()` |
| `bounciness` | `BOUNCINESS` | 0.0 / [0, 1] | 恢复系数 `contactRestitution()` |
| `airDrag` | `AIR_DRAG_MODIFIER` | 1.0 / [0, 2048] | **二次空气阻力** `dragCoefficient()`，外加量级很小的线性 / 角阻尼 |
| `density` | —（无对应） | 1.0 | 质量 = 方块数 × 1000 × density；同时反比地进入空气阻力 |

### 对齐带来的收益

同一份材质配置有两个出口：

- **碎块** 走刚体参数（`contactFriction()` / `contactRestitution()` / `dragCoefficient()`）
- **实体** 走原版 Attribute API（`EntityMaterialApplier` 写入 `FRICTION_MODIFIER` / `BOUNCINESS` / `AIR_DRAG_MODIFIER`）

把 `ICE` 配成 `friction: 0.05`，冰做的碎块会打滑，站在冰上的实体同样打滑——玩家在两边看到的物理表现一致。

### 刻意不统一语义

`bounciness` 是绝对值（0 = 不弹），`friction` 和 `airDrag` 是修正系数（1.0 = 与原版一致）。这与原版三个属性各自的定义一致。强行统一会让配置数值与玩家的原版直觉对不上——例如把摩擦和弹性都统一成系数之后，配置里写 `bounciness: 1.0` 在直觉上是"很弹"还是"正常"就不明确了。

---

## 三层查找的优先级

```
精确方块名（blocks）> 名称后缀组（groups，取最长匹配）> 默认值（defaults）
```

每层都是**部分覆盖**——只写想改的字段，其余继承上一层。

### 精确方块名（最高优先级）

```yaml
blocks:
  ICE:
    friction: 0.05
  SLIME_BLOCK:
    bounciness: 0.85
    friction: 1.6
    density: 0.4
  OBSIDIAN:
    density: 3.5
```

### 名称后缀组

```yaml
groups:
  _WOOL:
    density: 0.25
    air-drag: 2.5
  _LOG:
    density: 0.7
  _PLANKS:
    density: 0.6
  _CONCRETE_POWDER:
    density: 1.6
    friction: 1.3
  _LEAVES:
    density: 0.1
    air-drag: 4.0
```

### 后缀组的优势

原版有 16 种羊毛、11 种原木。没有后缀组这一层，把羊毛调轻要写 16 行；有了它只需一行 `_WOOL`。

最长匹配保证 `_CONCRETE_POWDER` 正确地优先于 `_POWDER`：

```java
// 后缀组取最长匹配
for (Map.Entry<String, PhysicsMaterial> entry : bySuffix.entrySet()) {
    String suffix = entry.getKey();
    if (key.endsWith(suffix) && suffix.length() > bestLength) {
        best = entry.getValue();
        bestLength = suffix.length();
    }
}
```

---

## 换算到求解器时的夹范围规则

原版允许 `FRICTION_MODIFIER` 高达 2048，但把这个数直接交给求解器会让它行为异常。
因此换算时以求解器的合理区间为准 —— **换算只改基准，不改材质之间的相对关系**：
冰依然远滑于石头，蜂蜜块依然远黏于石头。

| 转换方法 | 换算式 | 输出范围 | 说明 |
|---|---|---|---|
| `contactFriction()` | `0.75 × friction` | [0, 2] | 0.75 是「friction 1.0 对应多大摩擦」的基准 |
| `contactRestitution()` | 直接映射 | [0, 1] | 语义与范围都一致 |
| `linearDamping()` | `0.02 × airDrag` | [0, 1] | **不是空气阻力**，只压掉数值残余 |
| `angularDamping()` | `0.05 × airDrag` | [0, 1] | 两倍多一点，让翻滚比平移更快停下，观感更「重」 |
| `dragCoefficient()` | `0.0064 × airDrag ÷ density` | — | **真正的空气阻力**，二次模型 `a = −k·\|v\|·v` |

### 空气阻力才是「轻飘飘」的来源

`0.0064` 这个基准不是凑的：二次阻力下终速 `v∞ = √(g/k)`，
令基准密度（1.0）的方块终速恰好落在原版落体终速 39.2 m/s 附近，反解得 `k ≈ 9.81/39.2² ≈ 0.0064`。

于是「什么都不配」的方块下落手感与原版接近，配了密度的方块自动分化：

| 材质 | 密度 | k | 终速 |
|---|---|---|---|
| 羊毛 | 0.25 | 0.026 | ≈ 19 m/s |
| 基准方块 | 1.0 | 0.0064 | ≈ 39 m/s |
| 石头 | 2.5 | 0.0026 | ≈ 62 m/s（先撞上速度上限 39.2） |

除以密度不是为了好看而凑的公式 —— 空气阻力是**力**，加速度还要再除以质量：
`a = ½ρC_dA·v²/m`。同样一格大小的方块迎风面积相同，于是 `a ∝ 1/m ∝ 1/密度`。

### 摩擦真正决定的是「废墟能堆多陡」

碎石堆的休止角 θ 满足 `tan θ = μ`，`PhysicsMaterial.angleOfRepose()` 就是这一步换算：

| `friction` | μ | 休止角 | 参照 |
|---|---|---|---|
| 0.05 | 0.04 | 2° | 冰，堆不起来，全摊平 |
| 1.0 | 0.75 | 37° | 默认。真实碎砖 / 碎混凝土是 35°~45° |
| 1.2 | 0.90 | 42° | 沙砾 |
| 2.0 | 1.50 | 56° | 蜂蜜块，几乎垂直堆着不倒 |

「塌成一堆是什么形状」是玩家判断塌得像不像的主要依据，比任何单块碎石的运动都显眼。

!!! warning "实测有效摩擦低于配置值"
    配置 μ = 0.75 时实测有效 μ ≈ 0.52，源于雅可比平均是欠松弛的。
    **相对关系是正确的**（冰 32.8 格 / 石 3.6 格 / 蜜 2.6 格），调参时按相对关系调。

    详见[性能与上限](../engine/limits.md#动摩擦偏低)。

---

## 簇的主导材质选择

一个刚体只能有一套材质参数，而簇内可能混着多种方块（例如石头墙上嵌着几格玻璃）。

取**出现次数最多的方块**的材质，而非平均值。理由：平均出来的材质往往两头不像——一个主要由石头砌成、夹了两格羊毛的碎块，表现得像石头才符合直觉。少数方块不改变碎块的整体手感。

地形材质的处理同理：取整个快照中占比最高的方块。

---

## 材质缓存机制

`MaterialRegistry` 的查表结果带缓存——一次大规模倒塌要为上万个方块查材质，每次都走后缀匹配的字符串比较太浪费。

```java
private final Map<String, PhysicsMaterial> resolved = new HashMap<>();

public PhysicsMaterial materialFor(String blockName) {
    String key = blockName.toUpperCase(Locale.ROOT);
    PhysicsMaterial cached = resolved.get(key);
    if (cached != null) {
        return cached;
    }
    PhysicsMaterial result = resolve(key);
    resolved.put(key, result);
    return result;
}
```

缓存不设过期——方块名到材质的映射在整个插件生命周期内不会变化。

---

## EntityMaterialApplier

`EntityMaterialApplier` 负责将材质写入实体的原版 Attribute：

```java
public static int apply(Entity entity, PhysicsMaterial material) {
    if (!(entity instanceof Attributable attributable)) {
        return 0;
    }
    int applied = 0;
    applied += setBaseValue(attributable, Attribute.FRICTION_MODIFIER, material.friction()) ? 1 : 0;
    applied += setBaseValue(attributable, Attribute.BOUNCINESS, material.bounciness()) ? 1 : 0;
    applied += setBaseValue(attributable, Attribute.AIR_DRAG_MODIFIER, material.airDrag()) ? 1 : 0;
    return applied;
}
```

### registerAttribute 的必要性

并非所有实体默认都带这三个属性——对没有的实体，`getAttribute` 返回 `null`。此时必须先 `registerAttribute` 把属性挂上去再设值，否则就会**静默失败**，表现为"配置写了但没效果"，极难排查。

```java
private static boolean setBaseValue(Attributable attributable, Attribute attribute, double value) {
    AttributeInstance instance = attributable.getAttribute(attribute);
    if (instance == null) {
        try {
            attributable.registerAttribute(attribute);
        } catch (IllegalArgumentException e) {
            return false;   // 少数实体类型不接受某些属性，属正常情况
        }
        instance = attributable.getAttribute(attribute);
        if (instance == null) {
            return false;
        }
    }
    instance.setBaseValue(value);
    return true;
}
```

---

## 配置示例

```yaml
materials:
  defaults:
    density: 1.0
    friction: 1.0
    bounciness: 0.0
    air-drag: 1.0

  groups:
    _WOOL:
      density: 0.25
      air-drag: 2.5
    _GLASS:
      density: 0.9
      bounciness: 0.0

  blocks:
    ICE:
      friction: 0.05
    SLIME_BLOCK:
      bounciness: 0.85
      friction: 1.6
      density: 0.4
    STONE:
      density: 2.5
    OBSIDIAN:
      density: 3.5
```

---

## 使用边界与注意事项

- **bounciness 是绝对值，friction 和 airDrag 是修正系数**。不要擅自统一语义——它们各自的定义与原版一致，配置值才能与玩家直觉对齐。
- **换算时必须夹范围**。原版的摩擦范围 [0, 2048] 远超求解器的合理区间，直接映射会让它异常。
- **簇的主导材质取众数而非平均值**。平均出来的材质两头不像，少数方块不该改变整体的物理手感。
- **`registerAttribute` 不能省**。缺少这一步会导致 Attribute 写入静默失败，日志里看不出任何问题。
- **查表缓存不设过期**。如果热加载配置的需求变得强烈，需要增加 `invalidate` 方法。
- **后缀组的 key 包含前缀下划线**（如 `_WOOL`）。这是定界手段——`_WOOL` 只匹配 `BLACK_WOOL`，不会误匹 `WOOL` 开头的方块（虽然原版不存在这种方块，但加下划线是防御性习惯）。
