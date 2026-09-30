import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as P from '../out/posts.mjs';

const REPO = path.resolve(import.meta.dirname, '../../..');
const REAL = path.join(REPO, 'src/content/posts/astro-rewrite.md');
let dir;

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'post-cms-'));
  fs.copyFileSync(REAL, path.join(dir, 'astro-rewrite.md'));
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('读仓库里那篇真文章', () => {
  const p = P.readPost(path.join(dir, 'astro-rewrite.md'));
  assert.equal(p.title, '把站点从 Fuwari 换成 Astro');
  assert.equal(p.category, '折腾');
  assert.deepEqual(p.tags, ['Astro', '建站', '性能']);
  assert.equal(p.draft, false);
  assert.equal(p.pubDate, '2026-09-27');
  assert.equal(p.slug, 'astro-rewrite');
  assert.equal(p.series, undefined);
});

test('改一个字段时，注释、没见过的字段、正文都不动', () => {
  const f = path.join(dir, 'preserve.md');
  fs.writeFileSync(
    f,
    [
      '---',
      'title: 手写的标题',
      'description: 一段摘要',
      'pubDate: 2026-01-02',
      '# 这行注释要留住',
      'author: 我',
      'tags: [\'旧\']',
      'draft: false',
      '---',
      '',
      '正文第一段。',
      '',
      '## 小标题',
      '再多一句。',
    ].join('\n'),
  );
  P.setTags(f, ['新', 'Astro']);
  const text = fs.readFileSync(f, 'utf8');
  assert.match(text, /# 这行注释要留住/);
  assert.match(text, /author: 我/);
  assert.match(text, /正文第一段。/);
  assert.match(text, /## 小标题/);
  const p = P.readPost(f);
  assert.deepEqual(p.tags, ['新', 'Astro']);
  assert.deepEqual(p.extra, [['author', '我']]);
});

test('草稿开关来回切', () => {
  const f = path.join(dir, 'draft.md');
  fs.copyFileSync(REAL, f);
  assert.equal(P.toggleDraft(f), true);
  assert.equal(P.readPost(f).draft, true);
  assert.equal(P.toggleDraft(f), false);
  assert.equal(P.readPost(f).draft, false);
});

test('新建：中文标题保留汉字、摘要空着也合法、重名自动加后缀', () => {
  const f1 = P.createPost(dir, {
    title: '记一下最近的几件小事',
    description: '',
    pubDate: '2026-09-30',
    category: '日常',
    tags: [],
    draft: true,
  });
  assert.equal(path.basename(f1), '记一下最近的几件小事.md');
  const p1 = P.readPost(f1);
  assert.equal(p1.draft, true);
  assert.equal(p1.category, '日常');
  assert.deepEqual(p1.tags, []);
  assert.match(fs.readFileSync(f1, 'utf8'), /description: ''/);

  const f2 = P.createPost(dir, {
    title: '记一下最近的几件小事',
    description: '',
    pubDate: '2026-09-30',
    category: '日常',
    tags: [],
    draft: true,
  });
  assert.equal(path.basename(f2), '记一下最近的几件小事-1.md');
});

test('英文标题自动出 ascii 文件名', () => {
  assert.equal(P.slugify('Hello, World! 2026'), 'hello-world-2026');
  const f = P.createPost(dir, {
    title: 'Hello, World! 2026',
    description: 'd',
    pubDate: '2026-09-30',
    category: '日常',
    tags: [],
    draft: true,
  });
  assert.equal(path.basename(f), 'hello-world-2026.md');
});

test('带冒号或井号的摘要会被加引号，读回来还是原文', () => {
  const raw = '注意：这里有个 ASCII 冒号: 真的 # 还有井号';
  const f = P.createPost(
    dir,
    { title: 'quoted', description: raw, pubDate: '2026-09-30', category: '日常', tags: [], draft: false },
  );
  assert.match(fs.readFileSync(f, 'utf8'), /description: '/);
  assert.equal(P.readPost(f).description, raw);
});

test('CRLF 的文件改完还是 CRLF', () => {
  const f = path.join(dir, 'crlf.md');
  fs.writeFileSync(f, '---\r\ntitle: 旧\r\npubDate: 2026-01-01\r\ndraft: false\r\n---\r\n\r\n正文\r\n');
  P.setField(f, 'title', '新');
  const text = fs.readFileSync(f, 'utf8');
  assert.ok(!/(?<!\r)\n/.test(text), '不该出现只有 LF 的换行');
  assert.equal(P.readPost(f).title, '新');
});

test('候选值：分类、标签、系列去重排序', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'post-cms-vals-'));
  for (const [name, cat, tags, series] of [
    ['a', '折腾', "[\'Astro\', \'建站\']", '建站'],
    ['b', '读书', "[\'Astro\']", ''],
    ['c', '折腾', '[]', ''],
  ]) {
    fs.writeFileSync(
      path.join(d, `${name}.md`),
      `---\ntitle: ${name}\npubDate: 2026-01-0${name.charCodeAt(0) - 96}\ncategory: ${cat}\ntags: ${tags}\ndraft: false${series ? `\nseries: ${series}` : ''}\n---\n`,
    );
  }
  assert.deepEqual(P.existingValues(d, 'category'), ['折腾', '读书']);
  assert.deepEqual(P.existingValues(d, 'tags'), ['Astro', '建站']);
  assert.deepEqual(P.existingValues(d, 'series'), ['建站']);
  fs.rmSync(d, { recursive: true, force: true });
});

test('列表按日期倒序，URL 拼接正确', () => {
  const posts = P.listPosts(dir);
  assert.ok(posts.length >= 3);
  const dates = posts.map((p) => p.pubDate);
  assert.deepEqual(dates, [...dates].sort().reverse());
  assert.equal(P.postUrl('http://localhost:4321', 'astro-rewrite'), 'http://localhost:4321/posts/astro-rewrite/');
  assert.equal(P.postUrl('http://localhost:4321/', 'a'), 'http://localhost:4321/posts/a/');
});
