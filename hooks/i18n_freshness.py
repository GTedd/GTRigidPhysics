"""判断译本是否已经落后于原文，把结论挂到 page.meta 上供模板使用。

译本在 front matter 里记着 `i18n_source_sha` —— 它是「我是照着哪一版原文翻的」
这句话的机器可读形式。构建时重新算一遍当前原文的指纹，对不上就说明原文改过而
译本没跟，于是页面顶部挂一条「本页译文可能已过时」。

为什么要在站上提示而不是只在 CI 里报：译本过期最坏的后果落在**读者**身上 ——
他照着一段旧说明去配参数，然后配错。CI 的日志他看不到。

命令行侧的同一套判断在 tools/i18n/docs.ts，两边的哈希算法必须逐字一致，
见下面 source_sha 的注释。
"""

from __future__ import annotations

import hashlib
from pathlib import Path


def source_sha(content: str) -> str:
    """原文内容指纹。

    ⚠️ 必须与 `tools/i18n/shared.ts` 的 `sourceSha()` **逐字一致**，
    否则站点横幅会和 `bun run i18n:status` 的结论打架 —— 那种不一致
    最难查，因为两边各自看都「没错」。

    规则：CRLF/CR → LF，去掉首尾空白，UTF-8 编码后取 sha256 前 12 位十六进制。
    """
    normalized = content.replace("\r\n", "\n").replace("\r", "\n").strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:12]


def on_page_markdown(markdown, page=None, config=None, files=None, **kwargs):
    """在 front matter 已解析、正文尚未渲染时插入新鲜度判定。

    返回 None 表示不改动正文 —— 这个钩子只往 page.meta 里塞结论，
    横幅本身由 overrides/partials/i18n-notice.html 渲染。
    """
    if page is None or config is None:
        return None

    meta = page.meta or {}
    recorded = meta.get("i18n_source_sha")
    if not recorded:
        # 没记指纹的页面无从判断新鲜度。缺指纹本身是个问题，但那归
        # `bun run i18n:check` 管 —— 它会让 CI 红，比在站上挂横幅更该在合并前解决。
        return None

    file = page.file
    # norm_src_uri 由 mkdocs-static-i18n 写入，是去掉语言后缀后的原文路径：
    # guide/quick-start.en.md → guide/quick-start.md
    norm_src_uri = getattr(file, "norm_src_uri", None) or file.src_uri
    if not getattr(file, "localization", None):
        # 这一页就是原文本身，没有「跟不跟得上」的问题
        return None

    source_path = Path(config["docs_dir"]) / norm_src_uri
    if not source_path.is_file():
        # 孤儿译本。同样交给 i18n:check，这里不重复报警。
        return None

    actual = source_sha(source_path.read_text(encoding="utf-8"))
    page.meta["i18n_source_path"] = norm_src_uri
    page.meta["i18n_outdated"] = actual != recorded

    return None
