# 贡献指南

## 代码风格

### Java 编码规范

- **编码**：全链路 UTF-8。所有源文件和资源文件使用 UTF-8 编码
- **缩进**：4 空格，不使用 Tab
- **命名**：
  - 类名：大驼峰（`PascalCase`），如 `RigidCollapseExecutor`
  - 方法/字段：小驼峰（`camelCase`），如 `spawnQuotaPerFrame()`
  - 常量：全大写+下划线（`UPPER_SNAKE_CASE`），如 `MAX_PENDING`
  - 包名：全小写，如 `cn.gtedd.rigidphysics.paper.collapse`
- **JavaDoc**：所有公开 API 必须有完整的 JavaDoc 文档，包含 `@param`、`@return`、`@throws` 标记
- **Deprecation 清零**：编译已开启 `-Xlint:deprecation`，不允许任何 deprecation 警告

### 注释要求

- 关键的架构决策必须写注释说明「为什么这么做」而不是「做了什么」
- 有坑的地方必须注明（如线程安全约束、调用顺序要求）
- 参考自开源项目的代码必须在注释中标注来源项目和出处
- 引用外部代码时必须注意许可证兼容性（见下文「许可证原则」）

### 代码审查清单

提交 PR 前自查：

- [ ] 是否有单元测试覆盖新增逻辑？
- [ ] 是否有 deprecation 警告？
- [ ] 新加的命令是否同时补了 `zh_CN.yml` 和 `en_US.yml` 的翻译键？（`/gtrp admin locale` 切换语言自测）
- [ ] 是否有 JavaDoc 注释？
- [ ] 是否满足了模块约束？
- [ ] 改了面向用户的行为，`docs/` 对应页面是否跟着改了？
- [ ] 改了带英文译本的 Java 文件，`bun run javadoc:check` 是否还过？（见下文）

### 关于两套「翻译」

项目里有两个各自独立的多语言体系，别混淆：

| | 插件运行时消息 | 文档与 Javadoc |
|---|---|---|
| 在哪 | `paper/src/main/resources/lang/*.yml` | `docs/*.en.md`、`i18n/javadoc/en/` |
| 谁读 | 服务器上的玩家 | 文档站与 API 参考的读者 |
| 加语言怎么做 | 新增一个 `xx_XX.yml` | 见[翻译文档](translating.md) |

改代码时只需要顾前者；文档站与 Javadoc 的译本由社区维护，但有一条会拦住你：

**如果你改的 Java 文件已经有英文译本**（`i18n/javadoc/en/` 下有同路径文件），
`bun run javadoc:check` 会失败 —— 因为译本是原文的逐字副本，代码一改就对不上了。
处理办法是把你的代码改动同样搬进译本（只搬代码，注释保持英文），或者在 PR 里说明，
让维护者来同步。CI 会告诉你具体是哪个文件。

## 模块约束

### 四模块架构

```
api/          对外契约：接口、事件、值对象。零 native、零 packetevents
common/       纯逻辑，零外部依赖
   └── physics/    自研 XPBD 引擎，仅依赖 common
          └── paper/    Paper 26.2 平台层，依赖 api + common + physics
```

### 硬性约束

| 规则 | 说明 |
|------|------|
| **`common` 不得 `import org.bukkit.*`** | 纯逻辑模块，可独立做单元测试 |
| **`common` 不得 import 任何物理实现类** | 物理相关逻辑归 `physics`；`common` 靠不声明依赖天然隔离 |
| **`physics` 不得 `import org.bukkit.*`** | 物理模拟不碰服务端 API |
| **`physics` 不得 `import com.github.retrooper.packetevents.*`** | 发包逻辑归 `paper` |
| **异步线程不得碰 Bukkit 对象** | 异步代码只处理扁平化的 int[]/float[] 快照 |
| **引擎对象不可跨线程裸传** | 物理线程产出不可变的 `PoseSnapshot`（原始数组），主线程消费。`paper` 层零 `physics.engine` import，`:paper:checkEngineIsolation` 在每次 `compileJava` 后自动校验 |

### 为什么需要模块约束

这些约束不是教条，而是有具体原因的：

- `common` 零依赖：意味着它的所有功能都可以在单元测试中验证，不需要启动 Paper 服务器
- `physics` 零 Bukkit：意味着它的性能基准可以在纯 JVM 环境下跑，不受服务器负载干扰
- 线程纪律：异步线程碰 Bukkit API 会导致 `ConcurrentModificationException` 或更隐蔽的数据损坏

在 `paper/src/main/java/cn/gtedd/rigidphysics/paper/` 下新建文件时，问自己：「这段逻辑能放到 `common` 里吗？」如果能，就挪过去并写单元测试。

## 测试要求

### 测试框架

使用 JUnit 5（`org.junit.jupiter.api`），通过 Gradle 运行。

### 测试分类

| 模块 | 测试类型 | 当前数量 |
|------|----------|----------|
| `common` | 结构分析规格测试、性能测试、预算管理测试、材质查询测试、落地规划测试、着色器协议测试 | 40 个 |
| `physics` | XPBD 求解器、物体世界、摩擦标定、重力系数、地形对齐 | 9 个测试类 |

### 编写测试的原则

- **行为规格**优先于实现细节：测试应该验证「输入什么→输出什么」，而不是验证「调了哪个方法」
- **边界条件**：必须覆盖空输入、最大值、最小值、null 情况
- **性能回归**：关键路径需要有性能基准测试（如结构分析的最坏情况、求解器单步耗时）
- 测试命名建议使用「方法名_场景_预期」的模式

### 运行测试

```bash
# 全部测试
./gradlew test

# 只跑 common 模块
./gradlew :common:test

# 只跑 physics 模块
./gradlew :physics:test
```

HTML 报告路径：
- `common/build/reports/tests/test/index.html`
- `physics/build/reports/tests/test/index.html`

## 许可证原则

### 本项目许可证

| 部分 | 许可 |
|------|------|
| `api` / `common` / `physics` 三个模块 | **MIT** —— 闭源插件也可依赖 |
| 插件本体（`GTRigidPhysics-*.jar`） | **GPL-3.0** |

分开授权是刻意的：下游插件只需要 `api` 就能编译，不该被 GPL 传染。
packetevents 是必须前置插件、不内嵌，因此 `api` 不受它的许可约束。

依赖的第三方库均为兼容许可：

| 依赖 | 许可 |
|------|------|
| packetevents | MIT |

### 引用外部代码的规则

1. **MIT 许可的代码**：可直接引用，需标注来源
2. **LGPL-3.0 代码**：只能读架构思路，不能直接抄代码（本项目不对此类代码做动态链接）
3. **GPL-3.0 代码**：不能直接抄代码，只能了解公开算法思想
4. **PolyForm Shield**（Noncompete 条款）：完全不可用

参考项目列表见 DESIGN.md 第 7 节。

### 标注格式

在注释中标注来源的格式：

```java
/**
 * 内部面剔除的思路来自 Velthoric 的 TerrainVoxelShape（LGPL-3.0）。
 * 本项目独立实现——仅借鉴算法思想，未引用其代码。
 */
```

## PR 流程

### 分支策略

- `main`：稳定分支，始终保持可构建、测试全绿
- 功能分支：从 `main` 拉出，命名 `feature/<描述>` 或 `fix/<描述>`

### 提交信息

遵循 Conventional Commits 风格：

```
feat(paper): 新增 TNT 法杖齐射功能
fix(physics): 修正浮力计算中浸没深度的错误
docs: 补充命令参考文档
docs(i18n/en): 翻译快速开始与命令参考
test(common): 添加邻接模式规格测试
```

纯翻译的改动统一用 `docs` 前缀并在括号里标语言，详见[翻译文档](translating.md)。

### PR 提交前

1. 确保所有测试通过：`./gradlew test`
2. 确保 deprecation 警告为零：检查构建输出中无 deprecation 项
3. 确保全模块能正常构建：`./gradlew build`
4. 如果新增了命令，检查 `zh_CN.yml` 和 `en_US.yml` 的键数是否对齐
5. 在本地测试服上验证功能正常（如果有可测试服）

### 代码审查重点

审查者会特别关注：

- 模块约束是否满足（common 不能引 Bukkit）
- 线程安全是否到位
- 是否有内存泄漏风险（特别是 native 资源的释放）
- 预算管理是否正确配对了申请与归还
- 语言键是否两边齐全并一致

## 开发环境设置

### 推荐 IDE

IntelliJ IDEA（Community 或 Ultimate），需要：
- Gradle 插件
- Minecraft Development 插件（可选，方便编辑 paper-plugin.yml）

### 导入项目

```bash
git clone <仓库地址>
cd GTRigidPhysics
# IDEA: File > Open > 选择项目根目录 > 以 Gradle 项目导入
```

### 构建配置说明

- Gradle wrapper 使用阿里云镜像（`gradle/wrapper/gradle-wrapper.properties`）
- `gradle.properties` 中配置了 `org.gradle.jvmargs`、`org.gradle.parallel` 等
- **不要**在 `gradle.properties` 的 `org.gradle.jvmargs` 中添加 `-Dfile.encoding=UTF-8`——在中文路径项目中会破坏 classpath 解析

## 新增命令的开发流程

1. 在 `paper/src/main/java/cn/gtedd/rigidphysics/paper/command/node/` 下创建新节点类，实现 `CommandNode` 接口（继承 `BaseNode`）
2. 在 `CommandRegistry` 的构造器中把节点挂到对应的 `CommandGroup` 下
3. 在 `paper-plugin.yml` 中补一条权限声明
4. 在 `zh_CN.yml` 和 `en_US.yml` 中补对应的 `description` 和 `usage` 键
5. `CommandRegistry.findMissingKeys()` 会在启动时自动校验——如果有遗漏会在日志 WARN
6. 编译运行，自测功能和补全
