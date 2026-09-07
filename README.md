# GTRigidPhysics 文档

> Minecraft Paper 26.2 原版刚体物理引擎 —— 建筑坍塌、载具、骰子、小物件物理模拟。
> **纯服务端插件，零客户端 mod。**

| | |
|---|---|
| 📖 **文档站** | <https://gtedd.github.io/GTRigidPhysics/> |
| 📗 **API 文档 (Javadoc)** | <https://gtedd.github.io/GTRigidPhysics/javadoc/> |
| 📦 **Maven 仓库** | `https://gtedd.github.io/GTRigidPhysics/` |

---

## 这个仓库是什么

**文档站的源码。** 插件本身的 Java 代码不在这里。

| 分支 | 内容 |
|---|---|
| `main` | 文档源码 —— `docs/` 下的 Markdown、MkDocs 配置与翻译工具链 |
| `gh-pages` | 构建产物 —— 文档站、Javadoc、Maven 构件。**自动生成，不要手改** |

分开放是因为文档要给所有人看，而插件代码仓库不公开。
这里的 `docs/` 是上游仓库那份的单向副本，由维护者定期搬过来；同时也接受直接提交的改进 —— 见下。

---

## 参与翻译

文档以**简体中文**为源语言，其它语言都是它的译本。缺译本的页面会自动回退到中文，
不会 404，页首会挂一条「这页还没人翻」并附上一键开译链接。

最省事的三条路，按投入从小到大：

1. **改一个词** —— 站上每页右上角有支铅笔，点它直接在 GitHub 网页里改，改完提 PR。
2. **翻一整页** —— 每页右上角还有**导出 Markdown**，能下单页 `.md` 或整站 zip。
   包里的目录结构与这个仓库的 `docs/` 一一对应，翻完照着路径提 PR 即可。
3. **本地跑起来** —— 需要 [bun](https://bun.sh) 与 [uv](https://docs.astral.sh/uv/)：

   ```bash
   git clone https://github.com/GTedd/GTRigidPhysics
   cd GTRigidPhysics
   bun run docs          # → http://127.0.0.1:8000
   ```

   不装 bun / uv 也行，底下就是普通的 `mkdocs serve`。

命名规则、术语表、指纹机制的完整说明见站上的
[翻译文档](https://gtedd.github.io/GTRigidPhysics/dev/translating/)。

> **Javadoc 的翻译不在这个仓库。** 它走的是「源码覆盖层」——
> 需要 Java 源码才能校验译本与原文逐字一致，因此留在插件仓库里做。

---

## 给 AI agent

整站有三种机器友好的取法，都走 [llms.txt 约定](https://llmstxt.org)：

| 要什么 | 去哪儿 |
|---|---|
| 任意一页的 Markdown | 页面 URL 去掉尾斜杠，加 `.md` |
| 站点目录 | [`/llms.txt`](https://gtedd.github.io/GTRigidPhysics/llms.txt) |
| 全站正文合并（约 470 KB） | [`/llms-full.txt`](https://gtedd.github.io/GTRigidPhysics/llms-full.txt) |

英文版在 `/en/` 下的同名路径。详见
[导出 Markdown](https://gtedd.github.io/GTRigidPhysics/dev/export/)。

---

## ⚠️ 关于同步

`docs/`、`mkdocs.yml`、`hooks/`、`overrides/`、`tools/i18n/` 由维护者从上游仓库
**单向覆盖**同步过来。也就是说：

**在这里合并的 PR，必须先被上游采纳，否则下一次同步会把它抹掉。**

所以合并翻译 PR 的流程是：先合到这里让贡献者的提交记录留在原处，
然后立刻把同样的改动带回上游。别攒着。

`README.md` 与 `LICENSE` 不在同步范围内，它们属于这个仓库自己。

---

## 许可

文档内容与插件同源，随插件的双许可结构：
`api` / `common` / `physics` 三个模块以 **MIT** 授权，插件本体以 **GPL-3.0** 授权。
详见文档站的[接入 API](https://gtedd.github.io/GTRigidPhysics/api/) 一节。
