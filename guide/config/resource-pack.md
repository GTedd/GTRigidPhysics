# `resource-pack.yml` —— 资源包下发

只在用[视角滚转](../../features/camera-roll.md)时才需要配。**不配也能用**，只是玩家要自己装资源包。

---

## 流程

```bash
# 1. 构建产出资源包 zip 并打印 SHA-1
./gradlew build
# → build/distributions/GTRigidPhysics-RP-<版本>.zip

# 2. 把 zip 传到自己的对象存储 / CDN / 静态站，拿到直链

# 3. 把直链和 SHA-1 填进本文件，enabled 改 true
```

---

## 键表

```yaml
enabled: false
url: ""
sha1: ""
required: false
prompt: "<gradient:#7B68EE:#00CED1>GTRigidPhysics</gradient> <gray>需要资源包来驱动爆炸与坍塌的视角效果</gray>"
```

| 键 | 默认 | 说明 |
|---|---|---|
| `enabled` | `false` | 总开关 |
| `url` | `""` | 资源包**直链**。必须 `http://` 或 `https://` 开头，且是直接下载的地址 |
| `sha1` | `""` | zip 的 SHA-1，40 位十六进制 |
| `required` | `false` | 强制模式。`true` 时玩家拒绝或下载失败会被**踢出服务器** |
| `prompt` | 见上 | 客户端弹窗里的提示语，MiniMessage 格式。留空则不显示自定义文案 |

### `sha1` 是客户端的缓存键

填对了只在资源包**真的变了**时才重新下载。

不合法时插件**拒绝下发**并在日志说明 —— 这比静默下发一个客户端反复重下的包要好。

!!! warning "`required: true` 要想清楚"
    它会把下载失败的玩家踢下线。网络环境不好的玩家可能反复进不来。

    只有在视角滚转是核心玩法（比如一张主打爆破的图）时才值得开。

---

## 相关

- [视角滚转](../../features/camera-roll.md) —— 客户端还需要满足哪些条件
- [`camera-roll.yml`](camera-roll.md) —— 效果本身的参数
- [配置总览](index.md)
