# 管理面板 addon

> 源码：`examples/panel-addon` · 命令 `/gtrpaddon`（别名 `/gtrpa`）

一个独立的管理面板插件。**只通过 `RigidPhysicsAPI` 访问物理能力**，不碰引擎的任何内部类 ——
想在自己的插件里生成骰子、触发坍塌、调节重力，照这里的调用抄即可。

---

## 安装

1. 先装 [GTRigidPhysics](../guide/quick-start.md)。本 addon 是**必须前置依赖**：
   `paper-plugin.yml` 声明了 `required: true`，未安装主插件时它会拒绝加载。
2. 把 `GTRP-Panel-Addon-1.0.0.jar` 放进 `plugins/`
3. 重启服务器，游戏内执行 `/gtrpaddon`

---

## 十一个功能页

| 页 | 干什么 | 用到的 API |
|---|---|---|
| **运行状态** | 把只读查询集中展示：物理是否可用、活跃刚体数、进行中的坍塌数、时间倍率 | `isPhysicsAvailable()` · `bodies().activeBodyCount()` · `collapses().activeCollapseCount()` · `simulation().timeScale()` |
| **生成物体** | 先选材质（第一行），再选形态，生成到面前 2 格 | `bodies().spawn(SpawnOptions.builder(...))` |
| **物理交互** | 对刚体施加力，以及清理刚体 | `bodies().applyExplosion()` · `applyImpulse()` · `applyTorque()` · `removeNear()` · `removeAll()` |
| **物理材质** | 列出常见方块的密度 / 摩擦 / 弹性 / 空气阻力 | `materials().materialFor(Material)` |
| **全局仿真** | 时间倍率与重力的预设档位 | `simulation().setTimeScale()` · `setGravity()` |
| **视角效果** | 镜头震动与爆炸视角 | `cameraEffects().ifPresent(fx -> ...)` |
| **建筑坍塌** | 主动触发结构完整性判定 | `collapses().requestCollapse()` |
| **功能系统** | 列出各系统的独立开关，点击切换 | `systems()` |
| **地形工具** | 把脚下真实地形固化为碰撞体 | `terrain().spawnHeightField()` |
| **物理 TNT** | 沿准星发射 / 面前原地生成一颗物理 TNT | `tnt().launch()` · `tnt().spawn()` |
| **服务管理** | 热重载配置、切换界面语言 | `admin().reload()` · `admin().setLocale()` |

---

## 值得照抄的四条 API 惯例

这几条不是风格偏好，每一条都对应一类真实故障。

### 每次现取 API 实例，不要缓存

```java
// ✅
RigidPhysicsProvider.getIfPresent().ifPresent(api -> ...);

// ❌ 在 onEnable 里缓存一份
this.api = RigidPhysicsProvider.get();
```

GTRigidPhysics 热重载会换新实例 —— 缓存住的是**空壳**。

### 返回值必须判空

| 调用 | 「失败」的表达 |
|---|---|
| `bodies().spawn(...)` | 返回 `null` |
| `collapses().requestCollapse(...)` | 返回 `false` |
| `bodies().applyExplosion(...)` | 返回 0 |

!!! important "这些都是正常表达，不是异常"
    它们意味着「预算耗尽 / 物理不可用 / 被事件挡下」。
    把它们当异常处理（比如打 ERROR 日志）会在预算吃紧时刷屏。

### 必须前置依赖用 `required: true`

`paper-plugin.yml`：

```yaml
dependencies:
  server:
    GTRigidPhysics:
      load: BEFORE
      required: true
```

这样未安装主插件时本插件**拒绝加载**，于是 `onEnable` 里取 API 一定拿得到。

### 命令用 Brigadier 注册

`paper-plugin.yml` **不读取 `commands` 段**（写了会被静默忽略）。
见 `PanelAddonPlugin.registerCommand()`。

---

## 构建

```bash
# 1. 先把主项目的 api 发布到本地暂存仓库
cd <仓库根>
./gradlew :api:publishMavenPublicationToStagingRepository

# 2. 构建 addon
cd examples/panel-addon
./gradlew build
# 产物：build/libs/GTRP-Panel-Addon-1.0.0.jar（约 30 KB）
```

产物**不含 api** —— 运行时由服务器上的引擎提供。

仓库配置同时指向本地暂存仓库与远程静态仓库，所以拿到 `examples/panel-addon` 这个目录之后，
即使没有主项目源码也能直接 `./gradlew build`。

---

## 相关

- [addon 是什么](index.md)
- [工具腰带 addon](toolbelt.md) —— 与面板互补的另一半
- [写自己的 addon](writing.md)
- [接入 API](../api/index.md)
