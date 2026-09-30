import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as ext from '../out/extension-with-mock.mjs';
import { calls, workspace, window } from './vscode-mock.mjs';
import * as P from '../out/posts.mjs';

const REPO = path.resolve(import.meta.dirname, '../../..');
const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/post-cms/package.json'), 'utf8'));
let root;

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'post-cms-ext-'));
  fs.mkdirSync(path.join(root, 'src/content/posts'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'src/content/posts/astro-rewrite.md'), path.join(root, 'src/content/posts/astro-rewrite.md'));
  workspace.workspaceFolders = [{ uri: { fsPath: root }, name: 'blog', index: 0 }];
  ext.activate({ subscriptions: [] });
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

test('package.json 里声明的命令，代码里全都注册了', () => {
  for (const c of manifest.contributes.commands) {
    assert.ok(calls.commands.has(c.command), `没注册：${c.command}`);
  }
});

test('视图 id 和 viewsWelcome / menus 里写的对得上', () => {
  const viewId = manifest.contributes.views.explorer[0].id;
  assert.deepEqual(calls.views, [viewId]);
  assert.equal(manifest.contributes.viewsWelcome[0].view, viewId);
  for (const m of [...manifest.contributes.menus['view/title'], ...manifest.contributes.menus['view/item/context']]) {
    assert.ok(calls.commands.has(m.command), `菜单指向了没注册的命令：${m.command}`);
  }
});

test('新建文章：走完输入框就能落盘，并自动打开', async () => {
  const answers = ['用 Rust 写的小工具', '一把把剪贴板时间戳变人话的小刀', 'rust-clip-time'];
  calls.nextInput = () => answers.shift();
  await calls.commands.get('postCms.newPost')();
  const file = path.join(root, 'src/content/posts/rust-clip-time.md');
  assert.ok(fs.existsSync(file), '文件没建出来');
  const post = P.readPost(file);
  assert.equal(post.title, '用 Rust 写的小工具');
  assert.equal(post.description, '一把把剪贴板时间戳变人话的小刀');
  assert.equal(post.draft, true);
  assert.equal(post.category, '日常');
  assert.equal(post.pubDate, P.today());
  assert.ok(calls.opened.includes(file), '新建之后没打开');
});

test('改标签 + 发布：只动 frontmatter，正文还在', async () => {
  const file = path.join(root, 'src/content/posts/rust-clip-time.md');
  calls.nextQuickPick = () => [{ label: 'Rust' }, { label: 'CLI' }];
  await calls.commands.get('postCms.setTags')(P.readPost(file));
  assert.deepEqual(P.readPost(file).tags, ['Rust', 'CLI']);

  calls.nextQuickPick = undefined;
  await calls.commands.get('postCms.toggleDraft')(P.readPost(file));
  assert.equal(P.readPost(file).draft, false);
  assert.match(fs.readFileSync(file, 'utf8'), /在这里写正文/);
});

test('删除要确认，确认后才真的删', async () => {
  const file = path.join(root, 'src/content/posts/rust-clip-time.md');
  assert.ok(fs.existsSync(file));
  await calls.commands.get('postCms.deletePost')(P.readPost(file));
  assert.ok(!fs.existsSync(file), '确认之后应该删掉');
});

test('两组分得清：草稿归草稿、已发布归已发布', () => {
  const file = path.join(root, 'src/content/posts/astro-rewrite.md');
  assert.equal(P.readPost(file).draft, false);
  const groups = calls.provider.getChildren();
  assert.deepEqual(groups.map((g) => g.item.label), ['已发布（1）']);

  P.toggleDraft(file); // 变成草稿
  const after = calls.provider.getChildren();
  assert.deepEqual(after.map((g) => g.item.label), ['草稿（1）']);
  const items = calls.provider.getChildren(after[0]);
  assert.equal(items.length, 1);
  assert.equal(items[0].item.label, '把站点从 Fuwari 换成 Astro');
  assert.match(items[0].item.description, /2026-09-27 · 折腾/);
  assert.equal(items[0].item.contextValue, 'postCms.draft');
  P.toggleDraft(file); // 还原
});
