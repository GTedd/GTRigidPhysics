# 写自己的 addon

三个官方 addon（[面板](panel.md) / [工具腰带](toolbelt.md) / [载具](vehicle.md)）本身就是模板。
这一页把它们的共同骨架抽出来。

---

## 一条铁律

!!! danger "addon 只能依赖 `gtrigidphysics-api`"
    不 import 引擎的任何内部类（`cn.gtedd.rigidphysics.paper.*`、`...physics.*`、`...common.*` 的实现细节）。

    违反的代价不是「不优雅」——引擎内部重构时你的 addon 会**在运行时**炸掉，
    而编译期什么都发现不了。

依赖方向：

```
你的 addon  ──►  gtrigidphysics-api  ──►  common（值类型）
```

`api` 以 **MIT** 授权，闭源插件也可以依赖它编译。

---

## 骨架

### 1. `paper-plugin.yml`

```yaml
name: MyAddon
version: 1.0.0
main: com.example.myaddon.MyAddonPlugin
api-version: '1.21'

dependencies:
  server:
    GTRigidPhysics:
      load: BEFORE
      required: true
```

`required: true` 让未安装引擎时本插件**拒绝加载** —— 于是 `onEnable` 里取 API 一定拿得到。

!!! warning "`paper-plugin.yml` 不读取 `commands` 段"
    写了会被**静默忽略**。命令必须用 Brigadier 注册，见官方 addon 的 `registerCommand()`。

### 2. 取 API 实例

```java
public static Optional<RigidPhysicsAPI> api() {
    return RigidPhysicsProvider.getIfPresent();
}
```

!!! important "每次现取，不要缓存"
    ```java
    // ❌ 在 onEnable 里缓存
    this.api = RigidPhysicsProvider.get();
    ```

    引擎热重载会换新实例 —— 缓存住的是**空壳**，调用它不会抛异常，只是什么也不发生。

### 3. 判空

物理能力可能被服主关掉、预算可能耗尽、事件可能被别的插件挡下。
这些都是**正常返回值**，不是异常：

| 调用 | 「没做成」的表达 |
|---|---|
| `bodies().spawn(...)` | `null` |
| `collapses().requestCollapse(...)` | `false` |
| `bodies().applyExplosion(...)` | `0` |
| `cameraEffects()` | `Optional.empty()`（功能被关掉时） |
| `vehicles()` / `mechanisms()` / `characters()` | 系统关闭时返回 disabled 实现，调用无副作用 |

把它们当异常处理会在预算吃紧时刷屏日志。

### 4. 构建

```kotlin
repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
    // 引擎 api 的静态仓库
    maven("https://gtedd.github.io/GTRigidPhysics/")
}

dependencies {
    compileOnly("cn.gtedd:gtrigidphysics-api:1.0.0")
    compileOnly("io.papermc.paper:paper-api:...")
}
```

`compileOnly` —— 运行时由服务器上的引擎提供，**不要**把 api 打进自己的 jar。

本地开发时先把 api 发到暂存仓库：

```bash
./gradlew :api:publishMavenPublicationToStagingRepository
```

---

## 你能拿到什么

`RigidPhysicsAPI` 的全部子服务：

| 服务 | 干什么 |
|---|---|
| `bodies()` | 生成 / 查询 / 施力 / 移除刚体，射线检测 |
| `collapses()` | 主动触发结构坍塌 |
| `structure()` | 承重结构诊断：载荷、容量、薄弱点 |
| `settle()` | 落地规则查询 |
| `debris()` | 把实心方块炸成飞溅碎块 |
| `materials()` | 查询方块的物理材质 |
| `simulation()` | 全局时间倍率与重力 |
| `gravityFields()` / `magnetics()` | 引力井与磁力场 |
| `cameraEffects()` | 镜头震动与视角滚转（`Optional`） |
| `vehicles()` / `mechanisms()` | 载具与机关的马达控制 |
| `characters()` / `ragdolls()` | 虚拟角色与布娃娃 |
| `interaction()` | 抓取 / 释放 / 抛掷 / 冻结的状态机 |
| `systems()` | 各功能系统的开关 |
| `tnt()` | 物理 TNT 发射与生成 |
| `terrain()` | 地形碰撞体固化 |
| `admin()` | 热重载与语言切换 |

外加一组事件：`PhysicsBodySpawnEvent` / `RemoveEvent` / `GrabbedEvent` / `ReleasedEvent`、
`StructureCollapseStartEvent` / `FinishEvent`、`ExplosionDebrisLaunchEvent`、
`PhysicsBlockHitEvent`、`SystemToggledEvent`、`RigidPhysicsReloadEvent`、
`PhysicsSimulationSettingsChangeEvent`。

详见[接入 API](../api/index.md)与 [Javadoc](https://gtedd.github.io/GTRigidPhysics/javadoc/)。

---

## 你拿不到什么（以及为什么）

| 想做的事 | 现状 |
|---|---|
| 直接读写刚体的位姿数组 | 不暴露。位姿在物理线程上，裸传引用必然出竞态。用 `PhysicsBody` 的 getter |
| 换掉求解器 / 加一种约束类型 | 不暴露。这是引擎内核，改它请提 PR |
| 自己发碎块的位姿包 | 不暴露。表现层要守五道带宽闸门，绕过它会让预算失效 |
| 对物理体做射线检测拿到精确命中点 | `bodies().raycast()` 有，但玩法级的「上车判定」这类归 addon 自己写 |

!!! note "不暴露的判据"
    **暴露它会不会让引擎的某条不变式失效？** 会 → 不暴露。

    带宽预算、线程纪律、求解器稳定性都属于不变式。

---

## 常见坑

### 系统被关掉时服务仍然可调

`systems.yml` 关掉某个系统后，对应服务会换成 disabled 实现 —— 方法照常能调，只是什么也不做。

这是刻意的：让 addon 不必到处写 `if (enabled)`。但也意味着**「调了没反应」时先查系统开关**。

### 生成的物体默认不广播

```java
PhysicsBody body = api.bodies().spawn(options);
body.broadcastTo(world);   // ← 别忘了这一句
```

不广播的物体在物理世界里存在、会碰撞、会被查询到，但**没有任何玩家看得见**。

### 内置驾驶要让位

如果你的 addon 自己处理上车，在你的 listener 里**取消**那次 `PlayerInteractEvent` ——
引擎的 `VehicleController.onInteract` 是 `ignoreCancelled = true`，认这个信号。

不取消的话两套驾驶会同时把玩家往各自算的座位上拽，人在车上抖成一团。

---

## 相关

- [addon 是什么](index.md) —— 核心 / 外围的划分依据
- [接入 API](../api/index.md) —— 契约详解
- [模块架构](../engine/module-architecture.md) —— 引擎内部为什么也这么分层
- [贡献指南](../dev/contributing.md) —— 想改引擎本身而不是写 addon
