# 构建指南

## 前置要求

| 要求 | 版本 | 说明 |
|------|------|------|
| JDK | **25** | 全部模块的 toolchain 都是 Java 25（`buildSrc` 的 `rigidphysics-java` 约定插件） |
| Gradle | **9.6.1**（使用项目自带的 wrapper） | 项目使用阿里云镜像源，无需额外配置 |

> Gradle wrapper 已配置为阿里云镜像：`distributionUrl=https\://mirrors.aliyun.com/macports/distfiles/gradle/gradle-9.6.1-bin.zip`

## 项目结构

```
GTRigidPhysics/
├── api/          对外发行的稳定契约（零物理实现、零 packetevents、MIT）
│                 接口 / 事件 / 值对象
├── common/       纯逻辑（零 Bukkit 依赖，可单元测试）
│                 结构完整性分析 / 簇切分 / 预算管理 / LOD 决策 / 材质 / 落地规则
├── physics/      自研 XPBD 引擎（零 Bukkit、engine 子包零第三方依赖）
│                 求解器 / 碰撞形状 / 地形场 / 约束 / 位姿快照
├── paper/        Paper 26.2 + packetevents 发包表现层
│                 事件接入 / 三档表现层 / packet 虚拟实体 / 配置 / 命令
├── examples/     三个独立 addon（面板 / 工具腰带 / 载具），各自是独立 Gradle 项目
├── ResourcePack/ 客户端资源包（着色器视角滚转）
└── docs/         文档
```

依赖方向与各模块的铁律见[模块架构](../engine/module-architecture.md)。

## 构建命令

### 全量构建

```bash
./gradlew build
```

等价于执行：`common` 编译 + `physics` 编译 + `paper` shadowJar + 资源包打包 + SHA-1 计算。

### 仅构建插件 jar

```bash
./gradlew :paper:shadowJar
```

### 构建资源包 + SHA-1

```bash
./gradlew packResourcePack
./gradlew resourcePackSha1
```

### 运行测试

```bash
./gradlew test
```

测试分模块运行（约 350 个 `@Test`，**全部无需 native**）：

| 模块 | 测试类 | 覆盖什么 |
|---|---|---|
| `common` | 30 | 结构分析、承重、预算、材质、落地规则、着色器协议、表现层元数据 |
| `physics` | 9 | XPBD 求解器、物体世界、摩擦标定、重力系数、撞击记录、地形对齐 |
| `api` | 4 | 契约形状、`VehicleSettings` 预设与防御性拷贝 |
| `paper` | 1 | |

!!! success "求解器测试在普通 JVM 里跑"
    不需要服务器、不需要原生库、不需要 mock。这是 `physics/engine` 那条
    「零第三方依赖」铁律换来的直接收益。

### 复制到本地测试服

```bash
./gradlew :paper:shadowJar -PpluginOutputDir=D:/我的测试服/plugins
```

配置了 `-PpluginOutputDir` 后，jar 会在 shadowJar 完成后自动复制到指定目录。

同理复制资源包：

```bash
./gradlew build -PresourcePackOutputDir=D:/我的测试服/resourcepacks
```

## 产物路径与大小

| 产物 | 路径 | 大小 |
|------|------|------|
| 插件 jar | `paper/build/libs/GTRigidPhysics-1.0.0.jar` | **约 840 KB** |
| 源码 jar | `paper/build/libs/GTRigidPhysics-1.0.0-sources.jar` | |
| 资源包 zip | `build/distributions/GTRigidPhysics-RP-1.0.0.zip` | 含着色器 |
| 资源包 SHA-1 | `build/distributions/GTRigidPhysics-RP-sha1.txt` | 40 位十六进制 |

!!! success "jar 里零 native 二进制"
    早期版本约 11 MB，因为要带三平台的 jolt-jni native（Windows64 / Linux64 / Linux ARM64）。
    换成自研纯 Java 引擎之后只剩几百 KB，**平台限制也一并消失**。

    packetevents 同样不内嵌 —— 它由服务器上单独安装的 packetevents 插件提供。

## 构建关键配置

### 字符编码

```kotlin
tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
}
```

源码中包含中文注释，必须设为 UTF-8。同时 `gradle.properties` 中已标注**不要加** `-Dfile.encoding=UTF-8`——在中文路径项目中给 Gradle daemon 加该参数会破坏 classpath 解析。

### Deprecation 警告

```kotlin
options.compilerArgs.add("-Xlint:deprecation")
```

开启后能定位到具体使用废弃 API 的调用点。当前全模块 deprecation 警告为零。

### packetevents 前置依赖（不内嵌）

```kotlin
dependencies {
    compileOnly(libs.packetevents.spigot)  // 编译期引用，运行时由 packetevents 插件提供
}
```

packetevents 以 `compileOnly` 引用、**不 shade 进 jar**。它由服务器上单独安装的
packetevents 插件提供（2.13.0+），并在 `paper-plugin.yml` 里声明为 `required: true`
的硬前置。之所以不内嵌：内嵌时本插件要自己 build/init packetevents，与独立插件共存
会形成「双实例抢 API」的错位；改为前置后，生命周期由 packetevents 插件本体统一管理。

### 可复现资源包构建

```kotlin
isPreserveFileTimestamps = false
isReproducibleFileOrder = true
```

刻意配成可复现构建：同样的输入必须产出逐字节相同的 zip。因为 SHA-1 要填进 config.yml 作为客户端缓存键——若每次构建 hash 都变，服主每次升级都得回来改一次配置。

## 模块约束

| 约束 | 说明 |
|------|------|
| `common` 不得引 `org.bukkit` | 纯逻辑，零 Bukkit 依赖，可独立单元测试 |
| `physics` 不得引 `org.bukkit` | 自研引擎，不认 Minecraft。`engine` 子包更严：零第三方依赖 |
| `paper` 可引所有 | 唯一允许 import Bukkit 和 packetevents 的模块 |

这三个模块的依赖方向是 tree-shakable（usable by others）：

```
common <── physics <── paper
```

`common` 不依赖任何其他模块，`physics` 仅依赖 `common`，`paper` 依赖两者。

## 开发调试技巧

### 本地测试服部署

推荐在 `paper/build.gradle.kts` 中配置 `pluginOutputDir`：

```
./gradlew :paper:shadowJar -PpluginOutputDir=D:/我的测试服/plugins
```

### 查看单元测试报告

```bash
# 浏览器打开
start physics/build/reports/tests/test/index.html
start common/build/reports/tests/test/index.html
```

### 日志关键行

插件启动后在控制台日志中应看到：

```
[GTRigidPhysics] 物理引擎已就绪（纯 Java XPBD，无需 native）。
[GTRigidPhysics] 物理物体服务已就绪（骰子/载具/机关/角色/布娃娃/冲量交互）。
[GTRigidPhysics] 结构坍塌判定已启用（刚体 + packet 虚拟实体）。
[GTRigidPhysics] 物理材质：15 条方块规则、6 条后缀组规则。
```

如果缺少任何一行，说明对应功能加载失败。

### 常见构建问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `BUILD FAILED` + 中文乱码 | javac 使用了系统默认 GBK 编码 | 确认 `gradle.properties` 中 `org.gradle.jvmargs` **不要**含 `-Dfile.encoding=UTF-8` |
| `cannot find symbol: EngineWorld` 之类 | `physics` 模块未编译 | 先执行 `./gradlew :physics:build` |
| `Cannot resolve packetevents-spigot:2.13.0` | 缓存里只有旧版 2.11.2 | 需要从 JitPack 拉取：`./gradlew :paper:dependencies` 触发下载 |
| native 加载失败 | 平台不支持或 /tmp 挂 noexec | native 提取到插件数据目录而非 /tmp；确认使用 Windows x86-64 / Linux x86-64 / Linux aarch64 |

### 源代码位置

| 模块 | 源码路径 |
|------|----------|
| common | `common/src/main/java/mc/GTedd/cn/rigidphysics/common/` |
| physics | `physics/src/main/java/mc/GTedd/cn/rigidphysics/physics/` |
| paper | `paper/src/main/java/mc/GTedd/cn/rigidphysics/paper/` |
| 资源包 | `ResourcePack/` |
