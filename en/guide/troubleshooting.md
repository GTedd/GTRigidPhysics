# 故障排查

按症状查。每条都给出**先查什么**，而不是一上来就让你改参数。

---

## 插件根本没起来

### 控制台说找不到 packetevents

packetevents 是**硬依赖**，没装就拒绝加载。

从 [Modrinth](https://modrinth.com/plugin/packetevents) 装 **2.13.0 或更高**版本，
放进 `plugins/`，重启。

### `UnsupportedClassVersionError`

插件以 **Java 25** 字节码构建。服务器的 JVM 版本不够。

```bash
java -version
```

### API 版本不匹配

`paper-plugin.yml` 声明的是 `api-version: '26.2'`。低于 26.2 的 Paper 不会加载它。

!!! note "不需要 `--enable-native-access`"
    引擎是纯 Java 的。如果你为了这个插件加过这个启动参数，可以去掉了。

---

## 挖了承重却不塌

按这个顺序排查：

### 1. 这栋建筑是不是还连着别的支撑

先在空地上试最简单的场景：**一根柱子顶着一块 3×3 的平台，挖掉柱子中间那一格**。

这个场景不塌，说明是配置问题；这个场景塌了，说明你原来那栋楼确实还连着东西。

### 2. 邻接模式是不是 `FULL_26`

```yaml
# analysis.yml
adjacency: FACE_AND_EDGE   # 默认
```

`FULL_26` 有一个反直觉的后果：一根立在地上的柱子，拆掉它底下那一格，
柱身与周围地面仍然**体对角相连**，于是判「仍有支撑」—— 什么都不会发生。

### 3. 断口是不是落在分析区域边界上

区域侧面 / 底面被保守地当成地基。一座横跨边界的建筑哪怕在区域内彻底断开，
也会因为另一头搭在边界上而被判「仍有支撑」。

症状是「**拆断了没反应，再往旁边多拆几格才忽然全塌**」。

```yaml
# analysis.yml
border-expansion-passes: 2   # 0 = 关闭；确认这一项是开的
radius-xz: 12                # 建筑很大就调大
max-radius-xz: 48
```

### 4. 附近有没有锚定方块

```yaml
# analysis.yml
anchor-blocks:
  - BARRIER
  - BEDROCK
```

!!! danger "锚定是会传递的"
    在一栋楼里插一块屏障，**整栋与它连通的结构都不会再塌**。

    地图作者拿屏障当隐形骨架时最容易踩这一条。

### 5. 世界或区域被禁用了

```yaml
# config.yml
disabled-worlds:
  - world_the_end
```

```yaml
# systems.yml
systems:
  collapse: true    # 确认没被关掉
```

`/gtrp structure zone list` 看有没有 `IMMUNE` 区域盖住这里。

### 6. 承重分析被关掉了

```yaml
# structure.yml
enabled: true
```

关掉之后退回旧行为：只有**完全脱离地基**的结构才会塌。
挖空承重墙但上方还连着侧墙时，楼会一动不动地悬着。

---

## 什么都一碰就塌

```yaml
# structure.yml
strength-scale: 1.0   # 调大 → 更保守
```

这是**调整倒塌手感的总旋钮**，比逐个改材质方便，而且不破坏材质之间的相对关系。

如果是**摔一下就碎**（不是塌）而且你改过重力：

!!! danger "改重力必须连带改两处"
    `materials.yml` 的 `fracture-speed` 与 `impact.yml` 的 `min-break-speed`
    都是「落 N 格的着地速度」。

    把重力从 -9.81 改成 -16 之后，同样的落差有 **1.28 倍**的着地速度 ——
    那两处要跟着乘 1.28。

---

## 碎块表现不对

| 症状 | 先查 |
|---|---|
| 落地后自己转起来、边转边滑 | 这是求解器缺陷的经典症状，理论上已修（雅可比平均）。仍出现请提 issue 并附录像 |
| 静止的废墟缓慢摊开 / 缓慢自转 | 同上 |
| 废墟堆不成锥、全摊平 | `materials.yml` 的 `friction`。休止角 `tan θ = μ`，`μ = 0.75 × friction` |
| 史莱姆几乎不弹 | 已知偏差：配置 0.8 时实测约 0.63。见[性能与上限](../engine/limits.md#恢复系数收敛不足) |
| 羊毛和铁块落得一样快 | `materials.yml` 的 `density` 与 `air-drag`。**改重力不会改变轻重差别** |
| 碎块在平地上被莫名横推 | 幽灵碰撞。理论上已根治（面级暴露标记），仍出现请提 issue |
| 碎块穿过薄地形 | 投机接触应当拦住。若是**独立物体**，看下一节的地形流送 |

---

## 物体脚下没有地面、直接穿下去

刚体总数用光了。

```yaml
# physics.yml
max-bodies: 4096
```

这个数要同时装下独立物体（256）、布娃娃部件（224）、虚拟角色（64），
**剩下的才归地形流送**。前三类合计 544 是固定预留。

地形按 8×8×8 一格建一个刚体，每个物体身边要 3×3×4 = 36 格 ——
十几个分散的物体就能吃掉几百格。

!!! example "这个数曾经写死成 1024"
    扣掉预留只剩 480，症状就是这个。

---

## 服务器卡

**先跑 `/gtrp status` 看哪个指标满了**，别凭感觉调。

| 现象 | 大概率原因 | 去哪 |
|---|---|---|
| 玩家掉线 / 卡顿，服务端 TPS 正常 | **带宽** | [`view.yml`](config/view.md) 的 `broadcast-interval-ticks` 与 `distance` |
| 大坍塌落地时掉 TPS | 主线程写方块 | [`settle.yml`](config/settle.md) 的 `blocks-per-tick` |
| 撞击时掉 TPS | 主线程破坏方块 | [`impact.yml`](config/impact.md) 的 `blocks-per-tick` |
| 挖方块时有卡顿 | 结构分析 | [`analysis.yml`](config/analysis.md) 的 `radius-xz` / `height-down` |
| 虚拟实体计数居高不下 | 预算泄漏 | 见下 |

完整配方见[性能与预算](performance.md)。

### 「跑一段时间后就再也不塌了」

预算泄漏 —— 配额申请了没归还。

```
/gtrp status
```

看「虚拟实体」那一行：如果场上明明没有坍塌，计数却很高，就是泄漏。

!!! warning "不要靠调大上限掩盖"
    这是缺陷，请提 issue 并说明服务器跑了多久、期间大概发生过多少次坍塌。

---

## 碰撞箱相关

| 症状 | 原因 |
|---|---|
| 站在下落的碎块上被反复顶起 | 26.2 的潜影贝**没有客户端插值**，位置包是硬瞬移。把 [`collision.yml`](config/collision.md) 的 `moving-radius` 调成 `0` |
| 隐形方块把路封死 | 把 `mode` 改成 `INTERACTION`（能打、不挡路） |
| 站在半空的碎块上被拉回地面 | 服务端不知道这些碰撞箱存在，飞行检测在约 80 tick 后介入。长时间站立才会出现 |
| 打不动碎块 | `collision.yml` 的 `interact.enabled` |
| 碎块能穿过去 | `collision.yml` 的 `enabled`，或 `mode: INTERACTION`（那个模式本来就不挡人） |

---

## 视角滚转没效果

按顺序检查客户端那一半：

1. 资源包装了吗（[`resource-pack.yml`](config/resource-pack.md) 配了没）
2. 「Improved Transparency」（旧称 Fabulous!）画质选项开了吗
3. **有没有装 Iris 光影包** —— 装了就一定不生效
4. Sodium 版本 ≥ 0.9.0 吗

!!! tip "着色器失效是静默的"
    打开降级兜底至少能有原版受击倾斜：

    ```yaml
    # camera-roll.yml
    fallback: auto     # 或 hurt（确知着色器失效时）
    ```

自测入口在[管理面板 addon](../addons/panel.md) 的「视角效果」页 ——
`/gtrp shader test` 已随引擎瘦身迁出。

---

## 告示牌文字位置不对

那四个几何值是**推导值不是实证值**，需要真机标定：

```yaml
# view.yml
sign-text:
  standing-forward: 0.085
  standing-vertical: 0.25
  wall-forward: -0.355
  wall-vertical: 0.03125
  yaw-offset-degrees: 180.0
```

!!! tip "完全看不见字？"
    所有文字整体背对玩家。把 `yaw-offset-degrees` 改成 `0` —— 这就是为它留的逃生口。

---

## 载具

| 症状 | 原因 |
|---|---|
| 车悬空、给油不走 | **轮子几何**。轮子必须伸出车身侧面（`\|x\| > halfX`）且 z 收在车头内侧。见[载具实现](../engine/vehicle.md#轮子几何的红线) |
| 改了变速箱 / 差速器参数没反应 | 那些字段**已不再生效**。见[载具模板](../features/objects/vehicle.md#vehiclesettings-有一半字段不再生效) |
| 上车时人在车上抖成一团 | 两套驾驶在抢。你的插件要在自己的 listener 里**取消**那次 `PlayerInteractEvent` |

---

## 还是没解决

1. `/gtrp status` 的完整输出
2. 服务器启动时 `[GTRigidPhysics]` 开头的全部日志
3. 改过的配置项
4. 能复现的最小场景

带上这四样提 [issue](https://github.com/GTedd/GTRigidPhysics/issues)。

---

## 相关

- [配置总览](config/index.md)
- [性能与预算](performance.md)
- [性能与上限](../engine/limits.md) —— 已知偏差清单
