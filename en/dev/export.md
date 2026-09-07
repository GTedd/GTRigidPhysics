# 导出 Markdown

这个站点渲染出来的是 HTML，但有两类人要的是 **Markdown 原文**：

- **译者** —— 认领一篇去翻，需要带 front matter 的源文件，
  而不是从浏览器里复制正文再手工把标记补回去。
- **AI agent** —— 喂 HTML 给模型，一大半 token 花在导航、脚本和样式上。
  Markdown 是同一份内容的无损压缩版。

所以站点自己就提供源文件，不必先去 GitHub 翻仓库。

!!! tip "最快的路"

    每页正文右上角有两个小链接：**下载本页 Markdown** 和 **导出全部（.zip）**。
    要的就是这个的话，到这里就够了，下面是给需要批量或自动取用的人看的。

---

## 四种取法

| 要什么 | 去哪儿拿 |
|---|---|
| 某一页的源文件 | 页面 URL 去掉尾斜杠，加 `.md` |
| 整站打包 | [`/export/gtrigidphysics-docs-zh.zip`](https://gtedd.github.io/GTRigidPhysics/export/gtrigidphysics-docs-zh.zip) |
| 站点目录（给 agent） | [`/llms.txt`](https://gtedd.github.io/GTRigidPhysics/llms.txt) |
| 全站正文合并（给 agent） | [`/llms-full.txt`](https://gtedd.github.io/GTRigidPhysics/llms-full.txt) |

### 单页

规则只有一条：**URL 去掉尾斜杠、补 `.md`**。

```text
https://gtedd.github.io/GTRigidPhysics/guide/quick-start/
                                                              ↓
https://gtedd.github.io/GTRigidPhysics/guide/quick-start.md
```

英文站同理，把 `/en/` 那一层带上就行。

这条规则是刻意选的：只有一个深层链接时，不必先取索引也能猜对源文件在哪。

### 整站 zip

包里的目录结构与仓库 `docs/` 一一对应，解开来就能直接对照着改，
另附一份 `README.txt` 说明命名规则。

各语言各有一个包：中文是 `gtrigidphysics-docs-zh.zip`，
英文是 `gtrigidphysics-docs-en.zip`。**切到哪个语言，导出的就是那个语言的包。**

!!! note "英文包里为什么有中文"

    没人翻的页面会回退到中文原文（[为什么这样设计](translating.md)），
    所以英文包里混着中文 —— 那不是打包出错，**那正是还没人认领的部分**。
    想找活干的话，这就是清单。

### llms.txt 与 llms-full.txt

两份纯文本，走 [llms.txt 约定](https://llmstxt.org)：

- `llms.txt` —— 站点目录，按导航顺序列出每一页的标题与 `.md` 链接。
  先看目录、再按需取正文，适合上下文有限的场景。
- `llms-full.txt` —— 整站正文按导航顺序合并成一个文件，剥掉 front matter。
  中文约 470 KB，想一次读完就用它。

英文版在 `/en/llms.txt` 与 `/en/llms-full.txt`。

选这套约定而不是自己发明路径，是因为已经有一批工具认它 ——
自定义路径等于要求对方先读我们的说明。

---

## 不包含什么

`docs/internal/` 下的调研笔记、验收清单、整改方案不在导出范围内 ——
它们本来就被 `exclude_docs` 挡在站点之外。那些是过程材料，
公开容易被当成功能承诺。需要的话去仓库里读。

**Javadoc 不在这里。** API 参考是从 Java 源码注释生成的，
它的翻译走另一套机制（覆盖目录 + 硬性校验），见[翻译文档](translating.md)。

---

## 这套东西是怎么实现的

`hooks/md_export.py`，一个 MkDocs hook，约两百行，**没有引入新依赖** ——
文档工具链的依赖清单（`requirements-docs.txt`）保持不变。

它在每次构建时：把每页源文件拷到站点对应路径、打两个 zip、生成两份 llms 文本。
页面上那两个链接由 `overrides/partials/md-export.html` 渲染。

改文档不需要关心它。只有一种情况要留意：**新增页面记得挂进 `mkdocs.yml` 的 `nav`** ——
导出的排序跟着 nav 走，漏挂的页面会被排到最后（不会丢，但顺序会怪）。
