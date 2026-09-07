/**
 * i18n 工具链的公共部分：语言表、路径、以及**溯源哈希**的定义。
 *
 * 零第三方依赖 —— 直接 `bun tools/i18n/docs.ts`，不需要 npm install / bun install。
 */

import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dir, "../..");
export const DOCS_DIR = path.join(ROOT, "docs");
export const JAVADOC_I18N_DIR = path.join(ROOT, "i18n", "javadoc");

/** 源语言。文档与注释都用它写，其余语言都是它的译本。 */
export const SOURCE_LOCALE = "zh";

/**
 * 目标语言。
 *
 * 必须与三处保持一致，任何一处漏改都会静默出问题：
 *   - `mkdocs.yml` 的 `plugins.i18n.languages`
 *   - `build.gradle.kts` 的 `javadocLocales`
 *   - `i18n/javadoc/index.html` 里的 `LANGS`
 */
export const TARGET_LOCALES = ["en"] as const;

/**
 * 不参与翻译统计的文档。必须与 `mkdocs.yml` 的 `exclude_docs` 对齐 ——
 * 一个根本不会发布的页面，统计成「待翻译」只会让覆盖率永远到不了 100%。
 */
const DOCS_IGNORED_DIRS = new Set(["internal"]);
const DOCS_IGNORED_FILES = new Set(["dev/engine-addon-architecture.md"]);

/** 记在译本 front matter 里的键名。 */
export const SOURCE_SHA_KEY = "i18n_source_sha";

/**
 * 溯源哈希：原文内容的指纹，译本把它记在 front matter 里。
 *
 * 译本记下「我是照着哪一版原文翻的」，之后原文一改，指纹对不上，
 * 工具就能指出这份译本已经过期。没有这个记号的话，判断译本新旧只能靠
 * 文件 mtime 或 git 时间戳 —— 前者一 clone 就全废，后者被 rebase 一改就错。
 *
 * ⚠️ 归一化规则必须与 `hooks/i18n_freshness.py` 的 `source_sha()`
 * **逐字一致**，否则站点上的「译本已过期」横幅会和命令行报告打架。
 * 改这里就要同步改那边，两边各有一条注释互相指认。
 *
 * 规则：CRLF/CR → LF，去掉首尾空白，UTF-8 编码后取 sha256 前 12 位十六进制。
 */
export function sourceSha(content: string): string {
  const normalized = content.replace(/\r\n?/g, "\n").trim();
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(normalized, "utf8");
  return hasher.digest("hex").slice(0, 12);
}

export async function shaOfFile(file: string): Promise<string> {
  return sourceSha(await Bun.file(file).text());
}

/**
 * 换行归一化。
 *
 * 不是洁癖：Windows 上的编辑器、以及任何用 Python `write_text` 写过的文件，
 * 都会留下 CRLF。而 JS 的 `.` 与 `$` 都**不匹配 `\r`**（它是行终止符），
 * 于是 `key: value\r` 这一行在正则眼里是「冒号后面接了个匹配不上的东西」——
 * front matter 静默解析失败，工具报「这份译本没有溯源指纹」，
 * 而文件里明明写着。踩过一次，别再让下一个人踩。
 */
const toLf = (text: string) => text.replace(/\r\n?/g, "\n");

/** 极简 front matter 解析：只认文件开头 `---` 包起来的 `key: value` 行。 */
export function parseFrontMatter(raw: string): Record<string, string> {
  const text = toLf(raw);
  if (!text.startsWith("---")) return {};
  const end = text.indexOf("\n---", 3);
  if (end === -1) return {};
  const body = text.slice(text.indexOf("\n") + 1, end);
  const out: Record<string, string> = {};
  for (const line of body.split("\n")) {
    const m = line.match(/^([A-Za-z_][\w.-]*)\s*:\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

/**
 * 把一组 key 写回（或插入）front matter，保留其余内容原样。
 *
 * 输出一律用 LF —— 仓库里其余文本文件都是 LF，`git` 的 autocrlf 会在检出时
 * 按平台还原，所以这不会给 Windows 用户添麻烦，反倒避免了同一份文件里
 * 前几行 LF、后面 CRLF 的混合行尾。
 */
export function withFrontMatter(raw: string, updates: Record<string, string>): string {
  const text = toLf(raw);
  const lines = Object.entries(updates).map(([k, v]) => `${k}: ${v}`);
  if (!text.startsWith("---")) {
    return `---\n${lines.join("\n")}\n---\n\n${text}`;
  }
  const end = text.indexOf("\n---", 3);
  if (end === -1) return `---\n${lines.join("\n")}\n---\n\n${text}`;

  const head = text.slice(text.indexOf("\n") + 1, end).split("\n");
  const kept = head.filter((l) => {
    const m = l.match(/^([A-Za-z_][\w.-]*)\s*:/);
    return !(m && m[1] in updates);
  });
  const rest = text.slice(end + "\n---".length);
  return `---\n${[...kept.filter((l) => l.trim()), ...lines].join("\n")}\n---${rest}`;
}

/** 译本路径：`guide/quick-start.md` + `en` → `guide/quick-start.en.md` */
export function translationPath(relSource: string, locale: string): string {
  return relSource.replace(/\.md$/, `.${locale}.md`);
}

/** 判断相对路径是不是某个语言的译本，是则返回该语言。 */
export function localeOf(rel: string): string | null {
  const m = rel.match(/\.([a-z]{2}(?:[-_][A-Za-z]{2,4})?)\.md$/);
  return m ? m[1] : null;
}

/** 遍历 docs/，返回**原文** Markdown 的相对路径（已排除译本与内部材料）。 */
export async function listSourceDocs(): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const abs = path.join(dir, entry.name);
      const rel = path.relative(DOCS_DIR, abs).split(path.sep).join("/");
      if (entry.isDirectory()) {
        if (DOCS_IGNORED_DIRS.has(rel)) continue;
        await walk(abs);
      } else if (entry.name.endsWith(".md") && !localeOf(rel) && !DOCS_IGNORED_FILES.has(rel)) {
        out.push(rel);
      }
    }
  }
  await walk(DOCS_DIR);
  return out.sort();
}

/** Gradle 模块名，顺序即翻译优先级：api 是对外契约，最该先有英文。 */
export const JAVA_MODULES = ["api", "common", "physics", "paper"] as const;

/** 各模块的 Java 源码根。译文覆盖层按相对这些根的路径镜像。 */
export const JAVA_SOURCE_ROOTS = JAVA_MODULES.map((m) =>
  path.join(ROOT, m, "src", "main", "java"),
);

export interface JavaSource {
  abs: string;
  /** 相对源码根的包路径，如 `cn/gtedd/rigidphysics/api/object/PhysicsBody.java` */
  rel: string;
  /** 所属 Gradle 模块。不能靠路径里有没有 `/api/` 判断 —— `paper` 模块下就有个
   *  `paper/api/` 子包，那样判会把实现类当成对外契约。 */
  module: (typeof JAVA_MODULES)[number];
}

/** 遍历所有 Java 源文件。 */
export async function listJavaSources(): Promise<JavaSource[]> {
  const out: JavaSource[] = [];
  for (const [i, root] of JAVA_SOURCE_ROOTS.entries()) {
    if (!(await exists(root))) continue;
    const module = JAVA_MODULES[i];
    async function walk(dir: string) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(abs);
        else if (entry.name.endsWith(".java")) {
          out.push({ abs, module, rel: path.relative(root, abs).split(path.sep).join("/") });
        }
      }
    }
    await walk(root);
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

export async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

// ── 终端着色。不判断 TTY 时也无所谓：CI 日志带颜色码照样能读。 ──────────────
const useColor = process.env.NO_COLOR === undefined;
const wrap = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
export const c = {
  dim: wrap("2"),
  bold: wrap("1"),
  red: wrap("31"),
  green: wrap("32"),
  yellow: wrap("33"),
  cyan: wrap("36"),
};
