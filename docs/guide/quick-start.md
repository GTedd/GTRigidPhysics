# 快速开始

从下载到看见第一次坍塌，大约五分钟。

---

## 前置要求

| | 要求 |
|---|---|
| 服务端 | **Paper 26.2** 或更高（用到 26.2 的协议特性，不兼容低版本） |
| Java | **25**（插件以 Java 25 字节码构建） |
| 前置插件 | **[packetevents](https://modrinth.com/plugin/packetevents) 2.13.0+** —— 必须，不内嵌 |
| 客户端 | **无要求**。纯服务端插件，玩家不需要装任何 mod |

!!! success "不需要 `--enable-native-access`"
    引擎是**纯 Java** 的，jar 里零 native 二进制。
    macOS、Windows-ARM 这些平台现在都能跑。

    如果你在别处读到需要加这个启动参数，那是旧版本（基于 jolt-jni）的说法。

---

## 安装

1. 先把 **packetevents** 放进 `plugins/`（它会先于本插件加载）
2. 把 `GTRigidPhysics-1.0.0.jar` 放进 `plugins/`
3. 启动服务器

!!! warning "packetevents 是硬依赖"
    没装的话本插件**直接拒绝加载**并给出明确报错，而不是带着半初始化状态跑起来事后 NPE 满天飞。

---

## 验证安装

启动后控制台应该出现这几行：

```
[GTRigidPhysics] 物理引擎已就绪（纯 Java XPBD，无需 native）。
[GTRigidPhysics] 物理物体服务已就绪（骰子/载具/机关/角色/布娃娃/冲量交互）。
[GTRigidPhysics] 对外 API 已注册：契约版本 ...
[GTRigidPhysics] 结构坍塌判定已启用（刚体 + packet 虚拟实体）。
[GTRigidPhysics] 物理材质：N 条方块规则、M 条后缀组规则。
[GTRigidPhysics] 落地规则：默认 RESTORE，...
[GTRigidPhysics] 重力已按 physics.yml 设为 -9.81 m/s²。
[GTRigidPhysics] 全部功能系统已启用（systems.yml）。
```

缺哪一行，对应功能就没加载起来，控制台上方会有具体错误。

再跑一条命令确认：

```
/gtrp status
```

---

## 看见第一次坍塌

**不需要任何命令。** 坍塌是自动的：

1. 用方块搭一座两三层高的房子，或者一根 6 格以上的柱子撑着一片平台
2. 把承重的那部分挖掉
3. 失去支撑的部分整片塌下来，碎块会旋转、互相碰撞、顺着地形滚

!!! tip "没反应？"
    最常见的原因是**这栋建筑还连着别的支撑**。

    先试最简单的场景：一根柱子顶着一块 3×3 的平台，挖掉柱子中间那一格。

    再不行看[故障排查](troubleshooting.md)。

### 调一下手感

```yaml
# structure.yml —— 这是调整倒塌手感的总旋钮
strength-scale: 0.5     # 一碰就塌，场面夸张
strength-scale: 1.0     # 默认
strength-scale: 2.0     # 保守，要破坏大量承重构件才垮
```

改完 `/gtrp admin reload` 即可，不用重启。

---

## 引擎自带哪些命令

只有五组，全是运维用途：

| 命令 | 干什么 |
|---|---|
| `/gtrp status` | 运行状态与预算占用 |
| `/gtrp sim` | 时间倍率、重力（运行时临时覆盖） |
| `/gtrp material` | 查询材质、审计覆盖率 |
| `/gtrp structure` | 承重诊断、区域标注 |
| `/gtrp admin` | 热重载、切换语言 |

!!! info "生成骰子、法杖、管理面板不在引擎里"
    它们是独立的 **addon**：
    [管理面板](../addons/panel.md) · [工具腰带](../addons/toolbelt.md) · [载具](../addons/vehicle.md)

    引擎不装任何 addon 也照常工作 —— 物理化、坍塌、爆炸、撞击后果全部可用，
    只是少了操控工具。为什么这么拆见 [addon 是什么](../addons/index.md)。

`/gtrp` 不带参数会列出你**有权使用**的命令，无权限的条目不会出现。

---

## 授权

默认只有 OP 拥有 `gtrigidphysics.admin`。三种粒度：

```bash
# 全部权限（管理员）
/lp user <玩家> permission set gtrigidphysics.admin true

# 只读诊断（运维）—— 不改动任何东西
/lp user <玩家> permission set gtrigidphysics.category.diagnostic true

# 单条命令
/lp user <玩家> permission set gtrigidphysics.command.status true
```

---

## 资源包（可选）

只有[视角滚转](../features/camera-roll.md)（爆炸震屏、坍塌晃动）需要它。

构建时自动产出 `build/distributions/GTRigidPhysics-RP-<版本>.zip` 与 SHA-1，
把直链填进 [`resource-pack.yml`](config/resource-pack.md) 即可下发。

不配也能用 —— 只是玩家要自己装，或者走[降级兜底](config/camera-roll.md#降级兜底)。

---

## 下一步

<div class="grid cards" markdown>

-   [:octicons-arrow-right-24: **命令参考**](commands.md)

    五组命令的完整参数与权限

-   [:octicons-arrow-right-24: **配置总览**](config/index.md)

    14 个配置文件，按目的索引

-   [:octicons-arrow-right-24: **性能与预算**](performance.md)

    100 人服该怎么配

-   [:octicons-arrow-right-24: **addon**](../addons/index.md)

    面板、法杖、载具

-   [:octicons-arrow-right-24: **功能一览**](../features/collapse.md)

    坍塌、爆炸、材质、碰撞箱都怎么运作

-   [:octicons-arrow-right-24: **接入 API**](../api/index.md)

    在自己的插件里调用它

</div>
