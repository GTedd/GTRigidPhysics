# 接入 API

GTRigidPhysics 作为**前置插件**对外提供刚体物理能力。本文写给要接入它的插件开发者。

!!! tip "两套文档，别找错地方"
    这一组页面讲**怎么用**（用法、语义、约定、坑）。
    每个接口 / 方法 / 参数的精确签名在
    [Javadoc](https://gtedd.github.io/GTRigidPhysics/javadoc/)。

<div class="grid cards" markdown>

-   [:octicons-arrow-right-24: **刚体**](bodies.md)

    生成、施力、查询、移除、射线检测

-   [:octicons-arrow-right-24: **坍塌与碎屑**](collapse.md)

    主动触发坍塌、承重诊断、爆炸碎屑

-   [:octicons-arrow-right-24: **事件**](events.md)

    可取消语义与十一个事件

-   [:octicons-arrow-right-24: **材质 · 效果 · 仿真**](materials.md)

    物理材质查询、视角效果、全局时间与重力

-   [:octicons-arrow-right-24: **力场**](fields.md)

    引力井（黑洞）与磁力场（磁极）

-   [:octicons-arrow-right-24: **载具 · 机关 · 角色**](vehicles.md)

    真实驱动的车、铰链滑块机关、虚拟角色

-   [:octicons-arrow-right-24: **完整示例**](examples.md)

    一个能跑的最小插件

</div>

---

## 接入

### 1.1 加依赖

**Gradle (Kotlin DSL)**

```kotlin
repositories {
    maven("https://gtedd.github.io/GTRigidPhysics/")
}

dependencies {
    compileOnly("cn.gtedd:gtrigidphysics-api:1.0.0")
}
```

**Maven**

```xml
<repositories>
  <repository>
    <id>gtrigidphysics</id>
    <url>https://gtedd.github.io/GTRigidPhysics/</url>
  </repository>
</repositories>

<dependency>
  <groupId>cn.gtedd</groupId>
  <artifactId>gtrigidphysics-api</artifactId>
  <version>1.0.0</version>
  <scope>provided</scope>
</dependency>
```

> ⚠ **必须是 `compileOnly` / `provided`。**
> 用 `implementation` 会把 API 类打进你自己的 jar，运行时与服务器上插件提供的那份
> 冲突，报错通常是莫名其妙的 `LinkageError` 或 `ClassCastException`。

`gtrigidphysics-api` 只有几十 KB，不含 native、不含 packetevents。

### 1.2 声明加载顺序

`paper-plugin.yml`：

```yaml
dependencies:
  server:
    GTRigidPhysics:
      load: BEFORE
      required: true    # 软依赖写 false
```

不写这段的后果：你的 `onEnable()` 可能比 GTRigidPhysics 早跑，取 API 必然拿到空。

### 1.3 取得 API

两条路，指向同一个实例，挑一个用：

```java
// 路线 A：静态获取器
RigidPhysicsAPI api = RigidPhysicsProvider.get();                // 硬依赖，取不到就抛
RigidPhysicsProvider.getIfPresent().ifPresent(api -> { ... });    // 软依赖

// 路线 B：Bukkit 服务管理器
RegisteredServiceProvider<RigidPhysicsAPI> rsp =
        Bukkit.getServicesManager().getRegistration(RigidPhysicsAPI.class);
RigidPhysicsAPI api = rsp == null ? null : rsp.getProvider();
```

**在你自己的 `onEnable()` 里取，不要在 `onLoad()`。**

---

---

## 三条通用约定

先读这三条，能省掉大部分踩坑。

### ① 只在主线程调用

除非某个方法的 Javadoc 明确写了线程安全（目前只有材质查询），一律视为**仅限主线程**。
内部的物理线程调度由实现方负责，你不需要也不应该自己派发。

### ② 返回 `null` / `0` 是正常的

预算耗尽、物理运行时不可用、功能被服主关闭，都会让调用**静默失败**。
这些是服务器的正常状态而不是异常，因此用返回值而非抛异常来表达。

```java
PhysicsBody die = api.bodies().spawnCube(loc, Material.GOLD_BLOCK, 0.25, 17.0);
if (die == null) {
    // 预算满了，或者物理没起来。不是 bug。
    return;
}
```

想区分「没装插件」和「装了但物理没起来」，查 `api.isPhysicsAvailable()`。

### ③ 不要缓存句柄和注册表

| 对象 | 能否长期持有 |
|---|---|
| `RigidPhysicsAPI` | ✅ 跨热重载存活，可以放静态字段 |
| `PhysicsBody` | ❌ 刚体落地或被移除后即失效 |
| `MaterialRegistry` | ❌ `/gtrp admin reload` 会整体换掉实例 |
| `PhysicsBodyService` 等子服务 | ✅ 但每次从 `api` 现取更省心 |

缓存失效**不会报错**，只会静默指向一个已经拆掉的旧世界 —— 这是最难查的一类问题。
收到 `RigidPhysicsReloadEvent` 时把缓存丢掉重取。

---

---

## 版本与稳定性

API 遵循[语义化版本](https://semver.org/lang/zh-CN/)：

- 没有标注的类型与方法是**稳定契约**，主版本号内不会有破坏性改动；
- `@ApiStatus.Experimental` 可能在任何次版本中调整；
- `@ApiStatus.Internal` **不要用** —— 它们只是因为 Java 的可见性限制而不得不 public；
- 废弃成员会先标 `@Deprecated` 并保留至少一个次版本，再于下个主版本移除。

`api.apiVersion()` 是契约版本，跟着 api 模块走；
`api.implementationVersion()` 是插件实现版本。**能力判断用前者**，后者只用于日志诊断。

`cn.gtedd.rigidphysics.paper.*` 下的一切都是实现细节，不在契约范围内，随时可能改。

---

---

## 排查清单

| 现象 | 先查这个 |
|---|---|
| `RigidPhysicsProvider.get()` 抛异常 | 是否在 `onLoad()` 里取；`paper-plugin.yml` 有没有声明依赖 |
| 生成方法一直返回 `null` | `api.isPhysicsAvailable()`；服务器 CPU 架构是否受支持；预算是否已满 |
| 视角效果没反应 | 玩家装资源包了吗；`cameraEffects()` 是不是 `empty()` |
| 坍塌请求返回 `false` | 该世界是否被禁用；是否在冷却期；`runningAnalysisCount()` 是否贴着上限 |
| 重载后行为异常 | 是不是缓存了 `PhysicsBody` 或 `MaterialRegistry` |
| 运行时 `LinkageError` | 依赖是不是误写成了 `implementation` |
| 启动报 native access 警告 | 服务器启动参数加 `--enable-native-access=ALL-UNNAMED` |

---

## 相关

- [addon 是什么](../addons/index.md) —— 官方三个 addon 就是接入范例
- [写自己的 addon](../addons/writing.md) —— 骨架与常见坑
- [Javadoc](https://gtedd.github.io/GTRigidPhysics/javadoc/)
