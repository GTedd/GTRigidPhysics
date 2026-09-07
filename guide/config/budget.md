# `budget.yml` —— 碎块预算

五道安全带。它们不是「优化」，是**防止一次大坍塌把服务器或玩家客户端打死**的硬闸门。

调参前先跑 `/gtrp status` 看哪一项满了，别凭感觉调。

---

## 键表

```yaml
max-global-virtual-entities: 20000
max-concurrent-collapses: 8
max-active-bodies-per-region: 600
region-size: 256
max-visible-clusters-per-player: 150
max-rotating-blocks-per-player: 256
max-viewers-per-collapse: 12
```

| 键 | 默认 | 单位 | 拦什么 |
|---|---|---|---|
| `max-global-virtual-entities` | 20000 | 个 | 全服虚拟实体总数（一个簇 = 1 根实体 + N 个 display） |
| `max-concurrent-collapses` | 8 | 场 | 同时进行的坍塌场数 |
| `max-active-bodies-per-region` | 600 | 个 | **每个区域**的活跃刚体数 |
| `region-size` | 256 | 格 | 区域边长 |
| `max-visible-clusters-per-player` | 150 | 簇 | 每玩家同时可见的簇数，超出按距离由远及近销毁 |
| `max-rotating-blocks-per-player` | 256 | **方块** | 每玩家每帧享受旋转更新的方块数 |
| `max-viewers-per-collapse` | 12 | 人 | 单场坍塌的高保真观众数 |

---

## 三条设计要点

### R1 · 旋转配额的单位是方块，不是簇

!!! important "这是整份文件里最重要的一条"
    **平移整个簇只要 1 个包；旋转要给每个方块各发一次 metadata。**

    256 个方块的姿态关键帧约 18 KB，按 2 Hz 发就是 36 KB/s ——
    已经吃掉单个玩家物理带宽预算（50 KB/s）的一大半。

所以配额按方块计。按簇计的话，一个 64 方块的簇和一个 1 方块的簇会占同样的额度，
而它们的带宽差 64 倍。

### R2 · 单事件观众上限

一场倒塌被 30 人围观时，真正需要看清细节的永远只是最近的那几个。

超出 `max-viewers-per-collapse` 的玩家降级到低保真表现
（[`view.yml`](view.md) 的 `distant-effect-distance` 那一档：一次性粒子 + 音效）。

### R3 · 区域独立预算池

按 `region-size` 把世界切成方格，每格一个独立池子。

!!! tip "A 区打得再凶也不会饿死 B 区"
    没有分池的话，一场城市规模的爆破会把全服额度吃光，
    地图另一头的玩家挖一块承重墙什么都不会发生。

---

## 怎么读 `/gtrp status`

```
并发坍塌   3/8   (37%)
虚拟实体   6420/20000  (32%)
活跃刚体   184 @ 40 Hz
```

| 满了 | 症状 | 调哪个 |
|---|---|---|
| 虚拟实体 | 新坍塌不再生成碎块 | `max-global-virtual-entities`；或压 [`view.yml`](view.md) 的 `distance` |
| 并发坍塌 | 后来的坍塌请求被丢弃 | `max-concurrent-collapses` |
| 活跃刚体（分区域） | 局部坍塌规模被削 | `max-active-bodies-per-region` |

!!! warning "调大之前先确认瓶颈不是带宽"
    这几个数调大会让**更多东西同时发出去**。
    如果玩家已经在掉线或卡顿，该调的是 [`view.yml`](view.md) 的
    `broadcast-interval-ticks` 与 `distance`，不是这里。

---

## 预算泄漏防护

簇被销毁时额度必须归还。有一处容易漏：**玩家下线时他的可见簇没有被回收**。

引擎在 `ViewerCleanupListener` 里处理这一条 —— 这类泄漏的症状是
「服务器跑了几小时之后，明明没什么坍塌，虚拟实体计数却居高不下」。

看到这个症状请提 issue，不要靠调大上限掩盖。

---

## 相关

- [性能与预算](../performance.md) —— 五道闸门的完整说明
- [`view.yml`](view.md) —— 距离、遮挡、广播频率
- [`collision.yml`](collision.md) —— 碰撞箱有自己一套独立预算
- [配置总览](index.md)
