# CraftEngine 兼容

装了 [CraftEngine](https://github.com/Xiao-MoMi/craft-engine) 之后，它的自定义方块会和原版方块一样参与坍塌、承重、破碎与落地。**不需要任何配置**，装上就生效。

没装 CraftEngine 时，这一整套完全不加载，也不产生任何开销。

## 服主要做什么

装 CraftEngine（26.5 及以上），然后什么都不用做。

`/gtrp status` 会多出一行确认：

```
CraftEngine 已接入   自定义方块参与坍塌与承重
```

如果看到的是红色的「已安装 CraftEngine 但接口对不上」，说明 CE 的版本与本插件编译时用的接口有出入 —— 此时自定义方块**不会**参与坍塌，其余功能一切正常。升级 CraftEngine 通常就能解决。

## 自定义方块的物理参数从哪来

按优先级：

**① 你在 `materials.yml` 里写的精确配置**

用完整的 CE 方块 id 作为键，冒号形式建议加引号：

```yaml
blocks:
  "default:topaz_block":
    density: 3.2
    compressive-strength: 200
    span-limit: 5
```

**② 从 CraftEngine 的方块定义自动推导**（默认走这条）

一个整合包有上千种自定义方块是常态，指望服主逐个填表不现实。所以本插件会读 CE 方块定义里本来就有的那几项，换算成物理参数：

| CraftEngine 的字段 | 换算到 | 说明 |
|---|---|---|
| `hardness` | `density`、`fracture-speed` | 硬度越高越重、越不容易摔碎 |
| `resistance` | `compressive-strength`、`span-limit` | 爆炸抗性越高越扛压、越能悬挑 |
| `friction` | `friction` | 原版的「滑度」，方向相反，换算时取反 |
| `bounce-restitution` | `bounciness` | 直接映射 |

换算以**原版石头**为锚点：`hardness 1.5` → `density 2.5`，`resistance 6.0` → `compressive-strength 120`，与 `materials.yml` 里手写的 `STONE` 条目对齐。所以一块自定义石材的手感与原版石头大体一致，不会出现「自定义方块轻得像纸」。

想知道某个方块实际拿到的是什么数值，直接查：

```
/gtrp material info default:topaz_block
```

这条命令报出来的就是坍塌时真正用的那份，包含自动推导的结果。

!!! note "CE 方块不吃后缀组"
    `materials.yml` 的 `suffixes` 段（`_WOOL`、`_LOG`）只对原版方块生效。后缀组是按原版的命名习惯设计的，让它去匹配带命名空间的 id 多半是误伤 —— 一个恰好以 `_BLOCK` 结尾的自定义方块，不该因此继承铁块的密度。要批量调整请用运行时覆盖，它支持通配符。

## 已经处理好的几件事

这些都是接入时必须正面解决的问题，列在这里是为了让你知道它们**不是**待办事项：

- **碎块外观**。CraftEngine 把自定义方块真正注册进了服务端的 blockstate 注册表，那个 id 客户端并不认识。本插件发碎块时会主动换算成 CE 的「视觉 state」，所以掉下来的是自定义模型，而不是一片音符盒。
- **拆除**。坍塌开始时走 CE 自己的拆除流程，不会在原地留下 CE 的方块实体数据。
- **落地写回**。碎块停下来时用 CE 的放置接口写回，自定义方块不会退化成音符盒。
- **摔碎掉落**。落地破碎走 CE 的掉落表，掉的是服主定义的自定义物品。
- **砸坑**。高速碎块砸坏地面时，被砸的若是 CE 方块，同样走 CE 的破坏流程。

## 已知边界

- **家具（Furniture）不参与**。CE 的家具是实体而非方块，不会出现在方块快照里，因此建筑塌了它会留在原地。这是当前的刻意取舍。
- **非刚体降级路径不接管 CE 方块**。当坍塌走原版 `FallingBlock` 表现的那条降级路径时，CE 方块会原地保留而不是掉下来 —— `FallingBlock` 只认原版 blockstate，交给它会把自定义方块真的写成音符盒。留一块暂时浮空的方块是功能降级，把它变成音符盒是数据损坏。主路径（刚体坍塌）没有这个限制。
