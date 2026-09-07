# `settle.yml` —— 落地规则

碎块停下来之后怎么处置：**写回真方块 / 变掉落物 / 直接消失**。

系统说明见[落地规则](../../features/settle.md)。

---

## 三种模式

```yaml
default-mode: RESTORE
```

| 模式 | 效果 | 存档风险 |
|---|---|---|
| `RESTORE` | 写回真方块，废墟留在原地 | **会改动存档** |
| `DROP` | 变成掉落物可以捡回 | 零 |
| `VANISH` | 直接消失 | 零，且零开销 |

!!! important "判定是逐方块的"
    一个碎块簇可能横跨两个区域，跨过边界的部分**各自守各自的规则**。

优先级：**`regions`（后声明者覆盖先声明者） > `worlds` > `default-mode`**

---

## 限流

```yaml
blocks-per-tick: 150
max-drops-per-collapse: 200
```

| 键 | 默认 | 说明 |
|---|---|---|
| `blocks-per-tick` | 150 | 每 tick 最多写回的方块数 |
| `max-drops-per-collapse` | 200 | 单场坍塌最多产生的掉落物数，超出部分直接丢弃 |

!!! warning "`blocks-per-tick` 不能不限"
    `setBlockData` 会触发**光照更新与区块标脏**。
    一次大坍塌几千个方块一口气写回，会当场卡住主线程。

    服务器在大坍塌落地时掉 TPS，先调小这个值。

---

## 按世界覆盖

```yaml
worlds:
  world_nether: VANISH
  # thefinals_arena_*: RESTORE
```

世界名支持三种写法：

| 写法 | 例子 |
|---|---|
| 精确名（大小写不敏感） | `world_nether` |
| glob 通配 | `arena_*`（`*` 任意多字符，`?` 单个字符） |
| 正则 | `/^arena_\d+$/`（前后加斜杠） |

### 通配是给临时世界用的

竞技场、副本这类世界往往每局新建、名字带 UUID（`thefinals_arena_9f3c...`），下一局就换一个 ——
**精确名根本没法写**。

有了通配，「竞技场废墟留下、生存区不受影响」这种需求才做得到。

优先级：**精确名 > 通配式**（通配式之间后声明覆盖先声明）。
所以想给某一个特定世界开例外，直接补一行精确名即可，不用管顺序。

---

## 按区域覆盖

```yaml
regions:
  - world: "thefinals_arena_*"
    from: [0, 60, 0]
    to: [200, 140, 200]
    mode: RESTORE
  - world: "thefinals_arena_*"    # 出生点平台不留废墟，免得堵住重生
    from: [5, 63, 5]
    to: [20, 68, 20]
    mode: VANISH
```

闭区间，**坐标顺序无所谓**会自动摆正。后声明的覆盖先声明的 ——
方便「大区域设一种、中间挖个小例外」。

`world` 字段同样支持上面三种写法。

!!! tip "区域这一层用通配尤其顺手"
    临时世界的**坐标是固定的**（结构总是粘贴到同一个 paste-origin），变的只有世界名。
    给个 `arena_*` 就能精确框住每一局的同一片区域。

---

## 常见配方

=== "生存服：不想动存档"

    ```yaml
    default-mode: DROP
    ```

    碎块落地变掉落物，玩家能捡回来，地形一格不改。

=== "竞技场：废墟留下"

    ```yaml
    default-mode: DROP
    worlds:
      "arena_*": RESTORE
    ```

    世界用完即删，`RESTORE` 在那里零存档风险。

=== "纯演出：不留任何东西"

    ```yaml
    default-mode: VANISH
    blocks-per-tick: 150
    ```

    开销最低。碎块飞完就没了。

---

## 相关

- [落地规则](../../features/settle.md) —— 逐方块判定的优先级、写回是一次有损还原
- [`materials.yml`](materials.md) —— `fracture-speed` 只在 `RESTORE` 时才判定
- [配置总览](index.md)
