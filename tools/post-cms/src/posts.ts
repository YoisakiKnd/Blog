/**
 * 笔记仓库的读写逻辑，和 VS Code 完全解耦：这里只处理文件，所以能单独跑测试。
 *
 * frontmatter 走「按行改」的路子，不引 YAML 库：只认顶层 `key: value` 和
 * `key: [a, b]` 两种写法，改的时候只动目标那一行，注释、空行、没见过的字段都原样留着。
 * 这样就算以后 frontmatter 里多了别的字段，这个扩展也不会把它抹掉。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface Post {
  /** 绝对路径 */
  file: string;
  /** 文件名（去掉 .md），也就是 /posts/<slug>/ 里的那一段 */
  slug: string;
  title: string;
  description: string;
  pubDate: string;
  category: string;
  tags: string[];
  draft: boolean;
  series?: string;
  /** frontmatter 里出现过的其它顶层字段，原样保留 */
  extra: Array<[string, string]>;
}

/** frontmatter 的字段类，不含 extra */
export interface Editable {
  title: string;
  description: string;
  pubDate: string;
  category: string;
  tags: string[];
  draft: boolean;
  series?: string;
}

const FRONT = /^---\r?\n([\s\S]*?)\r?\n---/;
const KEY = /^([A-Za-z_][\w-]*):\s?(.*)$/;

export function splitFrontmatter(text: string): { front: string; rest: string; eol: string } | null {
  const m = FRONT.exec(text);
  if (!m) return null;
  return { front: m[1], rest: text.slice(m[0].length), eol: text.includes('\r\n') ? '\r\n' : '\n' };
}

function stripComment(value: string): string {
  // YAML 里 # 前面的空格才算注释；值里带引号时不处理
  if (!value.startsWith("'") && !value.startsWith('"')) {
    const i = value.indexOf(' #');
    if (i >= 0) value = value.slice(0, i);
  }
  return value.trim();
}

export function parseScalar(raw: string): string {
  let v = stripComment(raw).trim();
  if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
    v = v.slice(1, -1);
    if (raw.trim().startsWith("'")) v = v.replace(/''/g, "'");
  }
  return v;
}

export function parseList(raw: string): string[] {
  const v = stripComment(raw).trim();
  if (!v.startsWith('[') || !v.endsWith(']')) return [];
  return v
    .slice(1, -1)
    .split(',')
    .map((s) => parseScalar(s))
    .filter((s) => s.length > 0);
}

/** 值要不要加引号：含 `: `、以 `#` 开头或含 ` #`、首尾有空格、以特殊符号开头时加单引号 */
export function quoteScalar(value: string): string {
  const risky = /^(?:[-?:,\[\]{}#&*!|>%@`])/.test(value) || /:\s/.test(value) || /\s#/.test(value) || /^\s|\s$/.test(value);
  if (!risky) return value;
  return `'${value.replace(/'/g, "''")}'`;
}

export function formatList(tags: string[]): string {
  return `[${tags.map((t) => `'${t.replace(/'/g, "''")}'`).join(', ')}]`;
}

export function parseFields(front: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of front.split(/\r?\n/)) {
    const m = KEY.exec(line);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

export function readPost(file: string): Post {
  const text = fs.readFileSync(file, 'utf8');
  const split = splitFrontmatter(text);
  const map = split ? parseFields(split.front) : new Map<string, string>();
  const str = (k: string, d = '') => parseScalar(map.get(k) ?? d);
  const known = new Set(['title', 'description', 'pubDate', 'category', 'tags', 'draft', 'series']);
  return {
    file,
    slug: path.basename(file).replace(/\.md$/, ''),
    title: str('title', path.basename(file, '.md')),
    description: str('description'),
    pubDate: str('pubDate'),
    category: str('category', '日常'),
    tags: map.has('tags') ? parseList(map.get('tags') ?? '') : [],
    draft: parseScalar(map.get('draft') ?? 'false') === 'true',
    series: map.has('series') ? str('series') : undefined,
    extra: [...map.entries()].filter(([k]) => !known.has(k)) as Array<[string, string]>,
  };
}

/** 按 pubDate 倒序；没有日期的排最后（新建的草稿可能还没填） */
export function listPosts(dir: string): Post[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => readPost(path.join(dir, f)))
    .sort((a, b) => (b.pubDate || '').localeCompare(a.pubDate || ''));
}

/** 只替换目标那一行；字段不存在就补在最后一行 */
export function setField(file: string, key: string, value: string): void {
  const text = fs.readFileSync(file, 'utf8');
  const split = splitFrontmatter(text);
  if (!split) throw new Error(`${path.basename(file)} 没有 frontmatter`);
  const lines = split.front.split(/\r?\n/);
  const idx = lines.findIndex((l) => KEY.exec(l)?.[1] === key);
  const line = `${key}: ${value}`;
  if (idx >= 0) lines[idx] = line;
  else lines.push(line);
  const out = `---${split.eol}${lines.join(split.eol)}${split.eol}---${split.rest}`;
  fs.writeFileSync(file, out, 'utf8');
}

export function setTags(file: string, tags: string[]): void {
  setField(file, 'tags', formatList(tags));
}

/** 在草稿和已发布之间切换，返回切换后的状态 */
export function toggleDraft(file: string): boolean {
  const post = readPost(file);
  const next = !post.draft;
  setField(file, 'draft', String(next));
  return next;
}

export function slugify(title: string): string {
  const latin = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (latin) return latin;
  // 中文标题：去掉标点、空格换成连字符，保留汉字（和站点里分类/标签的 URL 一个路子）
  return (
    title
      .trim()
      .replace(/[\s]+/g, '-')
      .replace(/[^\p{L}\p{N}\-_]/gu, '')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '') || 'post'
  );
}

export function uniqueSlug(dir: string, base: string): string {
  let slug = base;
  let n = 1;
  while (fs.existsSync(path.join(dir, `${slug}.md`))) slug = `${base}-${n++}`;
  return slug;
}

export function renderFrontmatter(f: Editable, eol = '\n'): string {
  const lines = [
    '---',
    `title: ${quoteScalar(f.title)}`,
    `description: ${f.description ? quoteScalar(f.description) : "''"}`,
    `pubDate: ${f.pubDate}`,
    `category: ${quoteScalar(f.category)}`,
    `tags: ${formatList(f.tags)}`,
    `draft: ${f.draft}`,
  ];
  if (f.series) lines.push(`series: ${quoteScalar(f.series)}`);
  lines.push('---');
  return lines.join(eol) + eol;
}

export function createPost(
  dir: string,
  fields: Editable,
  opts: { slug?: string; eol?: string } = {},
): string {
  const eol = opts.eol ?? '\n';
  fs.mkdirSync(dir, { recursive: true });
  const slug = uniqueSlug(dir, opts.slug || slugify(fields.title));
  const file = path.join(dir, `${slug}.md`);
  const body =
    '在这里写正文。`##` 二级标题会自动进右侧目录，代码块会自动高亮。' + eol + eol + '删掉这一行，开始写。' + eol;
  fs.writeFileSync(file, renderFrontmatter(fields, eol) + eol + body, 'utf8');
  return file;
}

/** 收集已用过的分类 / 标签 / 系列，给 QuickPick 当候选项 */
export function existingValues(dir: string, key: 'category' | 'tags' | 'series'): string[] {
  const posts = listPosts(dir);
  if (key === 'tags') {
    const all = new Set<string>();
    for (const p of posts) for (const t of p.tags) all.add(t);
    return [...all].sort();
  }
  const all = new Set<string>();
  for (const p of posts) {
    const v = key === 'category' ? p.category : p.series;
    if (v) all.add(v);
  }
  return [...all].sort();
}

export function today(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function postUrl(siteUrl: string, slug: string): string {
  return `${siteUrl.replace(/\/$/, '')}/posts/${slug}/`;
}
