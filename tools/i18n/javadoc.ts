#!/usr/bin/env bun
/**
 * Javadoc 译文覆盖层工具。
 *
 *   bun run javadoc:check     校验译本与原文的**代码**逐字一致（CI 用，会拦 PR）
 *   bun run i18n:status --javadoc   覆盖率与优先级建议
 *   bun run i18n:new-javadoc en cn/gtedd/rigidphysics/api/object/PhysicsBody.java
 *
 * ## 为什么 check 必须是硬性门禁
 *
 * 覆盖层文件在生成英文 Javadoc 时**顶替**原始源文件。所以原文加了一个方法而
 * 译本没跟上时，结果不是「这段说明有点旧」，而是英文 API 参考里**根本查不到
 * 这个方法** —— 一份看起来完整、实则缺东西的契约文档。这比没有英文更糟。
 *
 * 判据不是时间戳也不是哈希，而是「剥掉全部注释之后，两边代码是否逐字相同」。
 * 这一条同时挡住两类问题：译者顺手改了代码；原文变了而译本没跟。
 */

import path from "node:path";
import { mkdir, readdir } from "node:fs/promises";
import {
  JAVADOC_I18N_DIR,
  JAVA_SOURCE_ROOTS,
  ROOT,
  TARGET_LOCALES,
  c,
  exists,
  listJavaSources,
} from "./shared.ts";

/**
 * 剥掉 Java 源码里的所有注释，保留其余字节。
 *
 * 手写状态机而不是正则：字符串字面量里出现 `//`（比如 URL）或者 `/*`
 * 是完全合法的，正则分不清「注释」和「字符串里长得像注释的东西」，
 * 一旦剥错就会把真代码删掉，然后报出一个根本不存在的差异。
 *
 * 处理到的形态：行注释、块注释、Javadoc、字符串、字符字面量、文本块。
 */
export function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;

  while (i < n) {
    const ch = src[i];

    // 文本块 """ ... """ —— 必须比普通字符串先判，否则会被当成空串加一个引号
    if (ch === '"' && src.startsWith('"""', i)) {
      const end = src.indexOf('"""', i + 3);
      const stop = end === -1 ? n : end + 3;
      out += src.slice(i, stop);
      i = stop;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src[j] === quote) {
          j++;
          break;
        }
        // 字面量不跨行。碰到换行说明源码本身有问题，就地停手，
        // 免得一个未闭合的引号把文件剩余部分全吞成字符串。
        if (src[j] === "\n") break;
        j++;
      }
      out += src.slice(i, j);
      i = j;
      continue;
    }

    if (ch === "/" && src[i + 1] === "/") {
      const end = src.indexOf("\n", i);
      i = end === -1 ? n : end;
      out += " ";
      continue;
    }

    if (ch === "/" && src[i + 1] === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      out += " ";
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}

/** 代码指纹：剥注释 + 归一空白。空白差异（缩进、换行）不算代码改动。 */
export function codeShape(src: string): string {
  return stripComments(src).replace(/\s+/g, " ").trim();
}

/** 定位到原文：覆盖层里的相对路径在四个模块的源码根里逐个试。 */
async function originalFor(rel: string): Promise<string | null> {
  for (const root of JAVA_SOURCE_ROOTS) {
    const candidate = path.join(root, rel);
    if (await exists(candidate)) return candidate;
  }
  return null;
}

/** 列出某语言覆盖层里的全部 .java（相对包路径）。 */
async function listOverlay(locale: string): Promise<string[]> {
  const base = path.join(JAVADOC_I18N_DIR, locale);
  if (!(await exists(base))) return [];
  const out: string[] = [];
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(abs);
      else if (entry.name.endsWith(".java")) {
        out.push(path.relative(base, abs).split(path.sep).join("/"));
      }
    }
  }
  await walk(base);
  return out.sort();
}

async function cmdCheck() {
  let problems = 0;
  let checked = 0;

  for (const locale of TARGET_LOCALES) {
    const overlays = await listOverlay(locale);
    if (overlays.length === 0) {
      console.log(c.dim(`${locale}：覆盖层为空，跳过`));
      continue;
    }

    for (const rel of overlays) {
      const overlayAbs = path.join(JAVADOC_I18N_DIR, locale, rel);
      const originalAbs = await originalFor(rel);

      if (!originalAbs) {
        problems++;
        console.log(c.red(`✗ 孤儿译本  i18n/javadoc/${locale}/${rel}`));
        console.log(c.dim("    四个模块的源码树里都没有同路径的原文 —— 原文多半改了包名或被删了。"));
        console.log(c.dim("    把译本挪到新路径，或者删掉它。"));
        continue;
      }

      checked++;
      const [a, b] = await Promise.all([
        Bun.file(originalAbs).text(),
        Bun.file(overlayAbs).text(),
      ]);
      if (codeShape(a) === codeShape(b)) continue;

      problems++;
      console.log(c.red(`✗ 代码不一致  i18n/javadoc/${locale}/${rel}`));
      console.log(c.dim(`    原文：${path.relative(ROOT, originalAbs).split(path.sep).join("/")}`));
      const hint = firstDifference(codeShape(a), codeShape(b));
      if (hint) {
        console.log(c.dim(`    首个差异附近：`));
        console.log(`      原文  …${hint.a}…`);
        console.log(`      译本  …${hint.b}…`);
      }
      console.log(
        c.dim("    两种可能：① 译本动了代码 —— 改回去；② 原文变了 —— 重新复制原文，把译过的注释搬过去。"),
      );
    }
  }

  console.log("");
  if (problems > 0) {
    console.log(c.red(`javadoc:check 失败：${problems} 处问题（已比对 ${checked} 个译本）`));
    process.exit(1);
  }
  console.log(c.green(`javadoc:check 通过：${checked} 个译本与原文代码逐字一致`));
}

/** 找出两串代码指纹的第一处分歧，各取前后一段，方便人眼定位。 */
function firstDifference(a: string, b: string): { a: string; b: string } | null {
  const len = Math.min(a.length, b.length);
  let i = 0;
  while (i < len && a[i] === b[i]) i++;
  if (i === len && a.length === b.length) return null;
  const from = Math.max(0, i - 40);
  return { a: a.slice(from, i + 60), b: b.slice(from, i + 60) };
}

async function cmdStatus() {
  const sources = await listJavaSources();

  for (const locale of TARGET_LOCALES) {
    const overlays = new Set(await listOverlay(locale));
    const done = sources.filter((s) => overlays.has(s.rel));

    console.log("");
    console.log(
      `${c.bold(`Javadoc zh → ${locale}`)}  ` +
        `${c.green(`${done.length}`)}/${sources.length} 个源文件已翻译`,
    );

    // 优先级：api 模块的对外契约最值钱，其次是公开成员多的类。
    // 只是个建议排序，不是硬规则。
    const pending = await Promise.all(
      sources
        .filter((s) => !overlays.has(s.rel))
        .filter((s) => s.module === "api")
        .map(async (s) => {
          const text = await Bun.file(s.abs).text();
          return { rel: s.rel, weight: (text.match(/\bpublic\b/g) ?? []).length };
        }),
    );
    pending.sort((x, y) => y.weight - x.weight);

    if (pending.length) {
      console.log(c.dim(`\n  api 模块里最值得先翻的（按公开成员数排）：`));
      for (const p of pending.slice(0, 8)) {
        console.log(`      ${p.rel}  ${c.dim(`(${p.weight} 个 public)`)}`);
      }
      console.log(c.dim(`\n      开一个：bun run i18n:new-javadoc ${locale} <上面任一路径>`));
    }
  }
  console.log("");
}

async function cmdNew(locale: string, rel: string) {
  if (!TARGET_LOCALES.includes(locale as never)) {
    console.error(c.red(`未知语言 '${locale}'，可选：${TARGET_LOCALES.join(", ")}`));
    process.exit(1);
  }
  const originalAbs = await originalFor(rel);
  if (!originalAbs) {
    console.error(c.red(`找不到原文：${rel}`));
    console.error(c.dim("路径要相对源码根，例如 cn/gtedd/rigidphysics/api/object/PhysicsBody.java"));
    process.exit(1);
  }
  const dest = path.join(JAVADOC_I18N_DIR, locale, rel);
  if (await exists(dest)) {
    console.error(c.red(`译本已存在：i18n/javadoc/${locale}/${rel}`));
    process.exit(1);
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await Bun.write(dest, await Bun.file(originalAbs).text());

  console.log(c.green(`已创建 i18n/javadoc/${locale}/${rel}`));
  console.log(c.dim("  这是原文的逐字副本。只改注释，代码一个字节都别动。"));
  console.log(c.dim("  译完跑：bun run javadoc:check && bun run javadoc:build"));
}

// ── 入口 ─────────────────────────────────────────────────────────────
const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case "check":
    await cmdCheck();
    break;
  case "status":
    await cmdStatus();
    break;
  case "new":
    if (rest.length !== 2) {
      console.error("用法：bun run i18n:new-javadoc <locale> <相对源码根的路径>");
      process.exit(1);
    }
    await cmdNew(rest[0], rest[1]);
    break;
  default:
    console.error("用法：bun tools/i18n/javadoc.ts <check|status|new> [参数]");
    process.exit(1);
}
