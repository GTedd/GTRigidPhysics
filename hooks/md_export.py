"""把每一页的 Markdown 源文件一并发布到站点，并额外产出几份整站导出。

## 为什么要做这个

站点渲染出来的是 HTML，但有两类读者要的是 Markdown 原文：

* **译者** —— 认领一篇去翻，需要的是带 front matter 的源文件，而不是从
  浏览器里复制正文再手工补回标记。尤其是不方便 clone 仓库的协作者。
* **AI agent** —— 喂 HTML 给模型，一大半 token 花在导航、脚本和样式上。
  Markdown 是同一份内容的无损压缩版。

原本这两类人都得去 GitHub 上翻仓库。现在站点自己就能给：

| 产物 | 路径 | 给谁 |
|---|---|---|
| 单页源文件 | 页面 URL 去掉尾斜杠再加 `.md` | 想翻某一页的人 |
| 整站打包 | `/export/gtrigidphysics-docs-<locale>.zip` | 认领整个分区的译者 |
| 站点索引 | `/llms.txt` | agent —— 先看目录再按需取 |
| 全文合并 | `/llms-full.txt` | agent —— 一次读完整站 |

后两个走的是 llms.txt 约定（<https://llmstxt.org>）。选它而不是自己发明一套，
纯粹因为已经有一批工具认这个路径 —— 自定义路径等于要求对方先读我们的说明。

## 单页 .md 的路径为什么是这样

`/guide/quick-start/` 对应 `/guide/quick-start.md`。这是 llms.txt 生态里
最常见的约定：**给任意页面 URL 去掉尾斜杠、补个 `.md`，就是它的源文件**。
agent 不需要先拿到索引也能猜对路径，这在只有一个深层链接时很有用。

## 与 exclude_docs 的关系

`internal/` 那批过程材料被 mkdocs.yml 的 `exclude_docs` 挡在站点之外，
它们压根不会进入 `files`，因此也不会被这里导出 —— 不需要在本文件里重复一份
排除清单。少一处会走样的真相。

## 多语言下这个 hook 会跑好几遍

mkdocs-static-i18n 的做法是在 `on_post_build` 里对每种非默认语言再跑一次
完整构建，所以下面的 `on_post_build` 会被触发 N 次（N = 语言数）。
应对方式是模块级累积 + 每次全量重写：写出的内容随着语言逐个构建而增长，
最后一次覆盖前面所有次的产物。80 篇文档重写几遍的开销可以忽略，
换来的是不必猜测「这是不是最后一次」—— 那种判断一旦猜错就是产物缺语言。
"""

from __future__ import annotations

import io
import posixpath
import zipfile
from pathlib import Path

# 累积各语言的页面清单。键是 locale，值按导航顺序排列。
#
# 用模块级变量而不是往 config 上挂：`mkdocs serve` 每次热重载都会新建 config，
# 但模块只加载一次 —— 挂 config 上的话，改一页就会丢掉其它语言的清单。
_collected: dict[str, list[dict]] = {}

# 站点级元信息，从最后一次构建的 config 取。各语言的 site_name 可能不同
# （mkdocs.yml 里 en 单独配了 site_description），所以按 locale 分开记。
_site_meta: dict[str, dict] = {}

# 各语言的导航顺序：src_uri → 序号。见 on_nav 的注释。
_nav_order: dict[str, dict[str, int]] = {}


def on_nav(nav, config=None, files=None, **kwargs):
    """记下导航顺序，供 llms.txt 与 llms-full.txt 排序。

    页面到达 `on_page_markdown` 的顺序是**构建顺序**，大致按路径字母序 ——
    那个顺序下 `addons/` 会排在 `guide/quick-start` 前面，等于让读者从
    「怎么写 addon」开始读一个他还没装上的插件。

    mkdocs.yml 里那棵 nav 是有意排的（上手 → 功能 → 扩展 → API → 原理 → 开发），
    导出应该沿用它。`nav.pages` 正好是这棵树拍平后的页面序列；
    nav 里的外部链接（比如指向 Javadoc 的那条）不是 Page，不会混进来。
    """
    if config is None:
        return nav

    locale = str(config["theme"]["language"])
    _nav_order[locale] = {
        page.file.src_uri: i for i, page in enumerate(nav.pages)
    }
    return nav


def _md_dest(dest_uri: str) -> str:
    """由页面的产出路径推出它的 `.md` 伴生路径。

    `use_directory_urls`（默认开启）下 dest_uri 是 `guide/quick-start/index.html`，
    关掉则是 `guide/quick-start.html`。两种都要能处理 —— 这个开关不归本 hook 管，
    哪天有人为了离线分发把它关掉，导出不该跟着坏掉。
    """
    if dest_uri.endswith("/index.html"):
        return dest_uri[: -len("/index.html")] + ".md"
    if dest_uri == "index.html":
        return "index.md"
    if dest_uri.endswith(".html"):
        return dest_uri[: -len(".html")] + ".md"
    return dest_uri + ".md"


def on_page_markdown(markdown, page=None, config=None, files=None, **kwargs):
    """登记这一页，并把下载链接算好挂到 page.meta 上。

    返回 None：这个 hook 不改正文。页面上那条工具栏由
    overrides/partials/md-export.html 渲染，它读的就是这里挂上去的两个键。

    为什么在这里算链接而不是在模板里：模板拿到的 `base_url` 是**站点根**的
    相对路径，而单页 .md 与页面本身是兄弟关系（`/a/b/` 对 `/a/b.md`），
    在 Jinja 里拼这个相对路径要处理层级，算错了就是一堆 404。
    Python 侧直接拿 dest_uri 推，一次算对。
    """
    if page is None or config is None:
        return None

    locale = str(config["theme"]["language"])
    dest = _md_dest(page.file.dest_uri)

    entry = {
        "title": page.title or page.file.src_uri,
        "url": page.url,
        "md_url": dest,
        "src": page.file.abs_src_path,
        "src_uri": page.file.src_uri,
        # 译本页与回退到原文的页面，src 指向的文件不同 —— 导出要跟着页面走，
        # 而不是永远导出中文原文，否则英文站的 zip 里全是中文。
        "localized": bool(getattr(page.file, "localization", None)),
    }
    _collected.setdefault(locale, []).append(entry)

    _site_meta[locale] = {
        "site_name": config["site_name"],
        "site_description": config.get("site_description") or "",
        "site_url": config.get("site_url") or "",
        # 源语言的包里没有「待翻译」这回事，README 的措辞要跟着分岔。
        # 取 mkdocs.yml 里那一处，不在这里再写死一个 "zh"。
        "source_locale": (config.get("extra") or {}).get("i18n_source_locale", "zh"),
    }

    # 模板要的是「从当前页出发到那个 .md」的相对链接。
    #
    # 基准是页面 URL 的**目录部分**，两种 use_directory_urls 下都成立：
    #   guide/quick-start/      → guide/quick-start   → ../quick-start.md
    #   guide/quick-start.html  → guide               → quick-start.md
    #   ''（首页）              → ''                  → index.md
    # 手算层数在首页和语言根页上会差一级，交给 posixpath.relpath 算。
    base = posixpath.dirname(page.url) or "."
    page.meta["md_export_page"] = posixpath.relpath(dest, base)
    page.meta["md_export_zip"] = posixpath.relpath(
        f"export/{_zip_name(locale)}", base
    )

    return None


def _zip_name(locale: str) -> str:
    return f"gtrigidphysics-docs-{locale}.zip"


def _strip_front_matter(text: str) -> str:
    """去掉 YAML front matter，只留正文。

    只用于 llms-full.txt：那份文件是给模型读的，`i18n_source_sha` 这类
    工具用的元数据对它没有意义，纯属噪声。单页 .md 与 zip 里**保留** front matter，
    因为译者需要它 —— 少了指纹，`bun run i18n:check` 会判定译本缺溯源。
    """
    if not text.startswith("---"):
        return text
    end = text.find("\n---", 3)
    if end == -1:
        return text
    return text[end + len("\n---") :].lstrip("\n")


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # 显式 newline="\n"：Windows 上不指定的话写出来是 CRLF，
    # 而同一份文件在 CI（Linux）上是 LF —— 两边产出的 zip 内容会不一致。
    io.open(path, "w", encoding="utf-8", newline="\n").write(content)


def on_post_build(config, **kwargs):
    """写出单页 .md、整站 zip、llms.txt 与 llms-full.txt。"""
    site_dir = Path(config["site_dir"])

    for locale, collected in _collected.items():
        meta = _site_meta.get(locale, {})
        pages = _in_nav_order(locale, collected)
        prefixed = _is_prefixed(locale, pages)
        zip_path = site_dir / "export" / _zip_name(locale)
        zip_path.parent.mkdir(parents=True, exist_ok=True)

        full_parts: list[str] = []

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as bundle:
            for entry in pages:
                src = Path(entry["src"])
                if not src.is_file():
                    # 理论上不会发生：files 里的条目都来自磁盘。
                    # 真发生了说明构建期间有人动了 docs/，跳过比崩掉强。
                    continue
                text = src.read_text(encoding="utf-8")

                # ① 单页伴生文件
                _write(site_dir / entry["md_url"], text)

                # ② 打进 zip。zip 内的路径去掉语言前缀，这样英文包解开来
                #    就是 `guide/quick-start.md` 而不是 `en/guide/quick-start.md`——
                #    译者要的是能直接对照 docs/ 的目录结构。
                bundle.writestr(_zip_arcname(locale, entry["md_url"]), text)

                # ③ 全文合并
                full_parts.append(
                    f"\n\n<!-- {entry['md_url']} -->\n\n"
                    + _strip_front_matter(text).strip()
                )

            bundle.writestr(
                "README.txt",
                _bundle_readme(locale, meta, len(pages)),
            )

        root = f"{locale}/" if prefixed else ""
        _write(site_dir / f"{root}llms.txt", _llms_index(locale, meta, pages))
        _write(site_dir / f"{root}llms-full.txt", _llms_full(meta, full_parts))


def _in_nav_order(locale: str, pages: list[dict]) -> list[dict]:
    """按 mkdocs.yml 的 nav 顺序重排，nav 里没有的排到最后。

    「nav 里没有的」正常情况下不存在 —— 本项目的 nav 是手写全量的。
    真出现了（有人加了页面忘了挂进 nav），排末尾并保持原相对顺序，
    比丢掉它强：漏挂 nav 是文档问题，不该连带让它从导出里消失。
    """
    order = _nav_order.get(locale, {})
    if not order:
        return pages
    fallback = len(order)
    return sorted(pages, key=lambda p: order.get(p["src_uri"], fallback))


def _is_prefixed(locale: str, pages: list[dict]) -> bool:
    """这批页面是不是发布在 `/<locale>/` 子路径下。

    mkdocs-static-i18n 把默认语言放站点根、其余语言各占一层前缀。
    llms.txt 要跟着放到对应的根，否则英文站的索引会盖掉中文站的。

    判定得扫全部页面而不是只看第一页：语言根首页的产出是 `en.md`
    （`en/index.html` 去掉 `/index.html` 就剩 `en`），它并不带 `en/` 前缀。
    只看第一页的话，恰好首页排在最前时就会判成「没有前缀」。
    """
    return any(
        p["md_url"].startswith(f"{locale}/") or p["md_url"] == f"{locale}.md"
        for p in pages
    )


def _zip_arcname(locale: str, md_url: str) -> str:
    """zip 内的路径 —— 去掉语言前缀，还原成 docs/ 下的样子。"""
    if md_url == f"{locale}.md":
        # 语言根首页。它在站点上叫 `en.md`，但在 docs/ 里对应的是 index。
        return "index.md"
    if md_url.startswith(f"{locale}/"):
        return md_url[len(locale) + 1 :]
    return md_url


def _bundle_readme(locale: str, meta: dict, count: int) -> str:
    """zip 里的说明文件。

    刻意用英文写：这个包最可能落到不读中文的译者手上。
    重点讲两件光看文件列表看不出来的事 —— front matter 不能删，
    以及非源语言的包里混着尚未翻译的中文原文（那不是打包出错）。
    """
    site_url = (meta.get("site_url") or "").rstrip("/")
    source_locale = meta.get("source_locale", "zh")
    is_source = locale == source_locale

    if is_source:
        # 源语言包 = 待翻译的原文。指路到目标语言的包，而不是讲后缀规则 ——
        # 拿到这个包的人还没选定要翻成哪种语言。
        situation = (
            "This is the source language. Every file here is an original, not a\n"
            "translation. If you are translating, you probably want the bundle\n"
            "for your target language instead -- switch the language at the top\n"
            "of the site and export again from there. Its untranslated pages\n"
            "will show up as these same Chinese originals, which is exactly the\n"
            "set of pages still up for grabs.\n"
        )
        guide = f"{site_url}/dev/translating/"
    else:
        situation = (
            "Pages with no translation yet fall back to the source language, so\n"
            "this bundle contains text in the original language. That is expected\n"
            "-- those are the pages still up for grabs. To translate one, add the\n"
            "language suffix to its name and place it next to the original:\n"
            f"guide/quick-start.md becomes guide/quick-start.{locale}.md\n"
        )
        guide = f"{site_url}/{locale}/dev/translating/"

    return (
        f"{meta.get('site_name', 'GTRigidPhysics')} - documentation sources ({locale})\n"
        f"{count} Markdown files, exported from {site_url}\n"
        "\n"
        "Layout mirrors docs/ in the repository, so a file here maps 1:1 onto\n"
        "the file you would edit in a pull request.\n"
        "\n"
        "The YAML front matter is kept on purpose. A translation records which\n"
        "revision of the original it was made from (i18n_source_sha); the\n"
        "repository's checks read that field, and the site uses it to flag\n"
        "translations that have fallen behind. Do not strip it.\n"
        "\n"
        + situation
        + "\n"
        f"Translation guide: {guide}\n"
        "Source repository: https://github.com/GTedd/GTRigidPhysics\n"
    )


def _llms_index(locale: str, meta: dict, pages: list[dict]) -> str:
    """llms.txt —— 给 agent 的站点目录。

    刻意只列**链接与标题**，不塞正文摘要：摘要要么是复制第一段（噪声），
    要么要额外维护一份描述（会走样）。想要正文的直接取 llms-full.txt。
    """
    site_url = (meta.get("site_url") or "").rstrip("/")
    lines = [
        f"# {meta.get('site_name', 'GTRigidPhysics')}",
        "",
        f"> {meta.get('site_description', '').strip()}",
        "",
        "Every page below is available as Markdown: take the page URL, drop the",
        "trailing slash and append `.md`. A zip of all pages is at",
        f"`/export/{_zip_name(locale)}`; the full text of the whole site,",
        "concatenated, is at `llms-full.txt` next to this file.",
        "",
        "## Pages",
        "",
    ]
    for entry in pages:
        url = f"{site_url}/{entry['md_url']}" if site_url else entry["md_url"]
        lines.append(f"- [{entry['title']}]({url})")
    lines.append("")
    return "\n".join(lines)


def _llms_full(meta: dict, parts: list[str]) -> str:
    header = (
        f"# {meta.get('site_name', 'GTRigidPhysics')}\n\n"
        f"> {meta.get('site_description', '').strip()}\n\n"
        "This file is the entire documentation site concatenated in navigation\n"
        "order, with YAML front matter stripped. Each page is preceded by an\n"
        "HTML comment giving its path.\n"
    )
    return header + "".join(parts) + "\n"
