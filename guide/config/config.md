# `config.yml` —— 统筹

只有两项。各功能域的详细参数都在同目录下的独立文件里，见[配置总览](index.md)。

---

## `language`

```yaml
language: zh_CN
```

界面语言，对应 `lang/<语言>.yml`。内置 `zh_CN` 与 `en_US`，
首次启动会释放到 `plugins/GTRigidPhysics/lang/` 供你修改。

运行时切换：`/gtrp admin locale <语言>`。

想加一种语言，往 `lang/` 里丢一个同结构的文件即可，不需要改代码。

---

## `disabled-worlds`

```yaml
disabled-worlds:
  - world_the_end
  # - "minigame_*"
```

在这些世界里**完全禁用坍塌判定**。

支持三种写法（与 `settle.yml` 的 `worlds` 一致）：

| 写法 | 例子 | 说明 |
|---|---|---|
| 精确名 | `world_the_end` | 大小写不敏感 |
| glob 通配 | `arena_*` | `*` 任意多字符，`?` 单个字符 |
| 正则 | `/^arena_\d+$/` | 前后加斜杠 |

!!! tip "通配是给临时世界用的"
    名字带 UUID 的副本 / 竞技场没法写精确名。

!!! note "这里只关坍塌"
    独立物理物体、物理 TNT 这些不受它影响。
    想整体关掉某个系统用 [`systems.yml`](systems.md)。

---

## 相关

- [配置总览](index.md)
- [`systems.yml`](systems.md) —— 按功能而非按世界关闭
- [`settle.yml`](settle.md) —— 同一套世界名写法
