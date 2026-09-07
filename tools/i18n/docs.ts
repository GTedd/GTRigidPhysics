#!/usr/bin/env bun
/**
 * 文档站翻译工具。
 *
 *   bun run i18n:status              翻译覆盖率与过期译本报告
 *   bun run i18n:check               同上，但结构性问题会让退出码非零（CI 用）
 *   bun run i18n:new en guide/quick-start.md    起一份译本骨架
 *   bun run i18n:bless en guide/quick-start.md  译本已同步到最新原文，重打指纹
 *
 * 「过期」不会让 CI 红 —— 否则改一句中文就要连坐所有语言的译本，
 * 结果只会是大家绕开这个检查。过期只报告，让它可见；真正会挡住合并的是
 * 结构性错误：孤儿译本、缺溯源指纹。
 */

import path from "node:path";
import { mkdir } from "node:fs/promises";
import {
  DOCS_DIR,
  SOURCE_LOCALE,
  SOURCE_SHA_KEY,
  TARGET_LOCALES,
  c,
  exists,
  listSourceDocs,
  localeOf,
  parseFrontMatter,
  shaOfFile,
  translationPath,
  withFrontMatter,
} from "./shared.ts";
import { readdir } from "node:fs/promises";

type Status = "translated" | "outdated" | "missing" | "no-sha";

interface Row {
  source: string;
  locale: string;
  status: Status;
  recorded?: string;
  actual: string;
}

async function collect(): Promise<{ rows: Row[]; orphans: string[] }> {
  const sources = await listSourceDocs();
  const known = new Set(sources);
  const rows: Row[] = [];

  for (const source of sources) {
    const actual = await shaOfFile(path.join(DOCS_DIR, source));
    for (const locale of TARGET_LOCALES) {
      const rel = translationPath(source, locale);
      const abs = path.join(DOCS_DIR, rel);
      if (!(await exists(abs))) {
        rows.push({ source, locale, status: "missing", actual });
        continue;
      }
      const meta = parseFrontMatter(await Bun.file(abs).text());
      const recorded = meta[SOURCE_SHA_KEY];
      rows.push({
        source,
        locale,
        actual,
        recorded,
        status: !recorded ? "no-sha" : recorded === actual ? "translated" : "outdated",
      });
    }
  }

  // 孤儿译本：原文已经被删掉或改名，译本还留在原地。这类文件在站上是
  // 「有英文页、点中文却 404」，而且没人会主动发现 —— 必须靠工具兜。
  const orphans: string[] = [];
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(DOCS_DIR, abs).split(path.sep).join("/");
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.name.endsWith(".md")) {
        const loc = localeOf(rel);
        if (!loc) continue;
        const source = rel.replace(`.${loc}.md`, ".md");
        if (!known.has(source)) orphans.push(rel);
      }
    }
  }
  await walk(DOCS_DIR);

  return { rows, orphans };
}

function bar(done: number, total: number, width = 24): string {
  const filled = total === 0 ? 0 : Math.round((done / total) * width);
  return "█".repeat(filled) + c.dim("░".repeat(width - filled));
}

async function cmdStatus(strict: boolean) {
  const { rows, orphans } = await collect();
  let failures = 0;

  for (const locale of TARGET_LOCALES) {
    const mine = rows.filter((r) => r.locale === locale);
    const translated = mine.filter((r) => r.status === "translated");
    const outdated = mine.filter((r) => r.status === "outdated");
    const missing = mine.filter((r) => r.status === "missing");
    const noSha = mine.filter((r) => r.status === "no-sha");
    const pct = mine.length ? Math.round((translated.length / mine.length) * 100) : 0;

    console.log("");
    console.log(
      `${c.bold(`${SOURCE_LOCALE} → ${locale}`)}  ${bar(translated.length, mine.length)}  ` +
        `${c.green(`${translated.length}`)}/${mine.length} 页最新 (${pct}%)`,
    );

    if (outdated.length) {
      console.log(c.yellow(`\n  ⟳ 原文已改，译本待同步（${outdated.length}）`));
      for (const r of outdated) {
        console.log(
          `      ${r.source}  ${c.dim(`${r.recorded} → ${r.actual}`)}\n` +
            `      ${c.dim(`译完跑：bun run i18n:bless ${locale} ${r.source}`)}`,
        );
      }
    }
    if (noSha.length) {
      console.log(c.red(`\n  ✗ 译本缺 ${SOURCE_SHA_KEY} front matter（${noSha.length}）`));
      for (const r of noSha) {
        console.log(
          `      ${translationPath(r.source, locale)}\n` +
            `      ${c.dim(`补上：bun run i18n:bless ${locale} ${r.source}`)}`,
        );
      }
      failures += noSha.length;
    }
    if (missing.length) {
      console.log(c.dim(`\n  · 尚无译本（${missing.length}）—— 站点会回退到中文原文，不会 404`));
      for (const r of missing.slice(0, 10)) console.log(c.dim(`      ${r.source}`));
      if (missing.length > 10) console.log(c.dim(`      …… 还有 ${missing.length - 10} 篇`));
      console.log(c.dim(`      开一篇：bun run i18n:new ${locale} <上面任一路径>`));
    }
  }

  if (orphans.length) {
    console.log(c.red(`\n✗ 孤儿译本：找不到对应的原文（${orphans.length}）`));
    for (const o of orphans) console.log(`      ${o}`);
    console.log(c.dim("      原文多半是改了名。把译本一起改名，或者删掉它。"));
    failures += orphans.length;
  }

  console.log("");
  if (strict && failures > 0) {
    console.log(c.red(`i18n:check 失败：${failures} 个结构性问题`));
    process.exit(1);
  }
  if (strict) console.log(c.green("i18n:check 通过"));
}

async function cmdNew(locale: string, source: string) {
  if (!TARGET_LOCALES.includes(locale as never)) {
    console.error(c.red(`未知语言 '${locale}'，可选：${TARGET_LOCALES.join(", ")}`));
    console.error(c.dim("新增语言要同时改 mkdocs.yml、build.gradle.kts 与 tools/i18n/shared.ts"));
    process.exit(1);
  }
  const srcAbs = path.join(DOCS_DIR, source);
  if (!(await exists(srcAbs))) {
    console.error(c.red(`原文不存在：docs/${source}`));
    process.exit(1);
  }
  const rel = translationPath(source, locale);
  const abs = path.join(DOCS_DIR, rel);
  if (await exists(abs)) {
    console.error(c.red(`译本已存在：docs/${rel}`));
    console.error(c.dim("要重新同步已有译本，用 i18n:bless；要重译，先自己删掉它。"));
    process.exit(1);
  }

  // 骨架 = 原文全文 + 指纹。刻意不留空白模板：对着原文逐段替换，
  // 比对着空文件重写更不容易漏掉小节，标题层级和链接也能原样保住。
  const body = await Bun.file(srcAbs).text();
  const sha = await shaOfFile(srcAbs);
  await mkdir(path.dirname(abs), { recursive: true });
  await Bun.write(
    abs,
    withFrontMatter(body, { [SOURCE_SHA_KEY]: sha }) +
      "",
  );

  console.log(c.green(`已创建 docs/${rel}`));
  console.log(c.dim("  里面是原文全文，逐段译过去即可。指纹已经打好，不用手动改。"));
  console.log(c.dim(`  预览：bun run docs  →  http://127.0.0.1:8000/${locale}/`));
}

async function cmdBless(locale: string, source: string) {
  const rel = translationPath(source, locale);
  const abs = path.join(DOCS_DIR, rel);
  if (!(await exists(abs))) {
    console.error(c.red(`译本不存在：docs/${rel}`));
    process.exit(1);
  }
  const sha = await shaOfFile(path.join(DOCS_DIR, source));
  const text = await Bun.file(abs).text();
  await Bun.write(abs, withFrontMatter(text, { [SOURCE_SHA_KEY]: sha }));
  console.log(c.green(`docs/${rel} 的溯源指纹已更新为 ${sha}`));
  console.log(c.dim("  只有在译本内容确实跟上最新原文之后才该跑这条 —— 它不检查内容，只盖章。"));
}

// ── 入口 ─────────────────────────────────────────────────────────────
const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case "status":
    await cmdStatus(false);
    break;
  case "check":
    await cmdStatus(true);
    break;
  case "new":
    if (rest.length !== 2) {
      console.error("用法：bun run i18n:new <locale> <docs 下的相对路径>");
      process.exit(1);
    }
    await cmdNew(rest[0], rest[1]);
    break;
  case "bless":
    if (rest.length !== 2) {
      console.error("用法：bun run i18n:bless <locale> <docs 下的相对路径>");
      process.exit(1);
    }
    await cmdBless(rest[0], rest[1]);
    break;
  default:
    console.error("用法：bun tools/i18n/docs.ts <status|check|new|bless> [参数]");
    process.exit(1);
}
