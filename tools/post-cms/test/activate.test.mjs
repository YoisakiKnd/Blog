import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as ext from '../out/extension-with-mock.mjs';
import { calls, workspace, window } from './vscode-mock.mjs';
import * as P from '../out/posts.mjs';
import * as S from '../out/siteconf.mjs';
import { transform } from 'esbuild';

const REPO = path.resolve(import.meta.dirname, '../../..');
const manifest = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/post-cms/package.json'), 'utf8'));
let root;

before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'post-cms-ext-'));
  fs.mkdirSync(path.join(root, 'src/content/posts'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'src/content/posts/astro-rewrite.md'), path.join(root, 'src/content/posts/astro-rewrite.md'));
  // 页面数据视图要读 site.config.ts，临时工作区里也得有一份
  fs.copyFileSync(path.join(REPO, 'src/site.config.ts'), path.join(root, 'src/site.config.ts'));
  workspace.workspaceFolders = [{ uri: { fsPath: root }, name: 'blog', index: 0 }];
  ext.activate({ subscriptions: [] });
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

test('package.json 里声明的命令，代码里全都注册了', () => {
  for (const c of manifest.contributes.commands) {
    assert.ok(calls.commands.has(c.command), `没注册：${c.command}`);
  }
});

test('视图挂在活动栏自己的容器里，id 和 viewsWelcome / menus 里写的对得上', () => {
  const containers = manifest.contributes.viewsContainers?.activitybar ?? [];
  assert.equal(containers.length, 1, '应该有一个自己的活动栏容器');
  assert.equal(containers[0].id, 'postCms');
  assert.ok(fs.existsSync(path.join(REPO, 'tools/post-cms', containers[0].icon)), '容器图标文件不存在');

  const views = Object.values(manifest.contributes.views).flat();
  for (const v of views) assert.ok(calls.views.includes(v.id), `没建视图：${v.id}`);
  assert.deepEqual(Object.keys(manifest.contributes.views), ['postCms'], '视图应该搬进自己的容器，不再挂在资源管理器里');
  assert.equal(manifest.contributes.viewsWelcome[0].view, views[0].id);
  const all = [...manifest.contributes.menus['view/title'], ...manifest.contributes.menus['view/item/context']];
  for (const m of all) assert.ok(calls.commands.has(m.command), `菜单指向了没注册的命令：${m.command}`);
  // 菜单 when 里写的 viewItem 必须是代码里真的会出现的 contextValue，写错一个字菜单就永远不会出来。
  // 有些值要等有数据才产生（装备没分组时就没有 item），所以这里比对已知集合，
  // 另外走一遍树，确认至少 page / entry 这两种真的产得出来。
  const KNOWN = new Set([
    'postCms.draft',
    'postCms.published',
    'postCms.page',
    'postCms.entry',
    'postCms.field',
    'postCms.item',
    'postCms.itemField',
    'postCms.date',
    'postCms.doing',
    'postCms.doingItem',
  ]);
  const produced = new Set();
  const walk = (list) => {
    for (const entry of list ?? []) {
      const p = calls.providers.get(entry.viewId);
      const item = p.getTreeItem(entry.node);
      if (item.contextValue) produced.add(item.contextValue);
      walk((p.getChildren?.(entry.node) ?? []).map((n) => ({ viewId: entry.viewId, node: n })));
    }
  };
  walk([...calls.providers.keys()].flatMap((viewId) => (calls.providers.get(viewId).getChildren?.() ?? []).map((node) => ({ viewId, node }))));
  for (const m of all.filter((x) => x.when.includes('viewItem == '))) {
    for (const match of m.when.matchAll(/viewItem == ([\w.]+)/g)) {
      assert.ok(KNOWN.has(match[1]), `菜单 when 里写了代码没定义的 viewItem「${match[1]}」（命令 ${m.command}）`);
    }
  }
  assert.ok(produced.has('postCms.page'), '页面数据树没产出 page');
  assert.ok(produced.has('postCms.entry'), '页面数据树没产出 entry');
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
  const groups = calls.providers.get('postCms.posts').getChildren();
  assert.deepEqual(groups.map((g) => g.item.label), ['已发布（1）']);

  P.toggleDraft(file); // 变成草稿
  const after = calls.providers.get('postCms.posts').getChildren();
  assert.deepEqual(after.map((g) => g.item.label), ['草稿（1）']);
  const items = calls.providers.get('postCms.posts').getChildren(after[0]);
  assert.equal(items.length, 1);
  assert.equal(items[0].item.label, '把站点从 Fuwari 换成 Astro');
  assert.match(items[0].item.description, /2026-09-27 · 折腾/);
  assert.equal(items[0].item.contextValue, 'postCms.draft');
  P.toggleDraft(file); // 还原
});

test('页面数据：读得出来，加一项、删一项，删完字节回到原样', async () => {
  const configPath = path.join(root, 'src/site.config.ts');
  const original = fs.readFileSync(path.join(REPO, 'src/site.config.ts'), 'utf8');
  fs.writeFileSync(configPath, original);
  const provider = calls.providers.get('postCms.pages');
  const pages = provider.getChildren();
  assert.deepEqual(pages.map((p) => p.page.label), ['项目', '友链', '装备', '书架', '现在']);

  assert.equal(provider.getChildren(pages[0]).length, 2, '仓库里有两个项目');
  assert.equal(provider.getChildren(pages[1]).length, 0, '友链本来是空的');

  const answers = ['ty0', 'https://ty0.icu', '站长'];
  calls.nextInput = () => answers.shift();
  await calls.commands.get('postCms.addData')(pages[1]);
  let text = fs.readFileSync(configPath, 'utf8');
  await transform(text, { loader: 'ts' });
  assert.equal(S.readArray(text, 'friends').entries.length, 1);
  assert.equal(S.unquote(S.readArray(text, 'friends').entries[0].fields.get('name').raw), 'ty0');
  assert.equal(S.readArray(text, 'projects').entries.length, 2, '别的数组被动了');
  assert.equal(provider.getChildren(pages[1]).length, 1, '加完面板要马上能看到');

  calls.confirm = () => '删除';
  await calls.commands.get('postCms.removeData')(provider.getChildren(pages[1])[0]);
  assert.equal(fs.readFileSync(configPath, 'utf8'), original, '加一项再删一项应该字节回到原样');

  const gear = pages[2];
  calls.nextInput = (() => { const q = ['键盘']; return () => q.shift(); })();
  await calls.commands.get('postCms.addData')(gear);
  text = fs.readFileSync(configPath, 'utf8');
  await transform(text, { loader: 'ts' });
  const group = provider.getChildren(gear)[0];
  calls.nextInput = (() => { const q = ['HHKB Pro 2', '每天在敲']; return () => q.shift(); })();
  await calls.commands.get('postCms.addData')(group);
  text = fs.readFileSync(configPath, 'utf8');
  await transform(text, { loader: 'ts' });
  assert.match(text, /HHKB Pro 2/);
  assert.equal(S.readNestedArray(text, 'gear', 0, 'items').entries.length, 1);
  const groupChildren = provider.getChildren(group);
  assert.equal(groupChildren.filter((n) => n.kind === 'item').length, 1, '装备组下面应该挂出这一件');
  assert.equal(groupChildren.filter((n) => n.kind === 'field').length, 1, '分组名本身也应该是可见的一行');

  calls.nextInput = (() => { const q = ['纳瓦尔宝典', 'Eric Jorgenson', '']; return () => q.shift(); })();
  calls.nextQuickPick = () => '在读';
  await calls.commands.get('postCms.addData')(pages[3]);
  text = fs.readFileSync(configPath, 'utf8');
  await transform(text, { loader: 'ts' });
  const book = S.readArray(text, 'shelf').entries[0];
  assert.equal(S.unquote(book.fields.get('title').raw), '纳瓦尔宝典');
  assert.equal(S.unquote(book.fields.get('state').raw), '在读');
  assert.equal(book.fields.has('note'), false, '留空的字段不该写进去');

  const now = pages[4];
  const nowChildren = provider.getChildren(now);
  assert.deepEqual(nowChildren.map((n) => n.kind), ['date', 'doing']);
  calls.nextInput = (() => { const q = ['2026-10-01']; return () => q.shift(); })();
  await calls.commands.get('postCms.editData')(nowChildren[0]);
  assert.equal(S.readScalar(fs.readFileSync(configPath, 'utf8'), 'now', 'updated'), '2026-10-01');

  const doingBefore = S.readStrings(fs.readFileSync(configPath, 'utf8'), 'doing').length;
  calls.nextInput = () => '把装备页填满';
  calls.nextQuickPick = undefined;
  await calls.commands.get('postCms.addData')(nowChildren[1]);
  const after = fs.readFileSync(configPath, 'utf8');
  await transform(after, { loader: 'ts' });
  assert.equal(S.readStrings(after, 'doing').length, doingBefore + 1);
  assert.equal(S.readStrings(after, 'doing').at(-1), '把装备页填满');

  fs.writeFileSync(configPath, original);
});

test('点一下就能改：条目、字段、装备里的一件，默认动作都是「改内容」而不是跳文件', async () => {
  const configPath = path.join(root, 'src/site.config.ts');
  const original = fs.readFileSync(path.join(REPO, 'src/site.config.ts'), 'utf8');
  fs.writeFileSync(configPath, original);
  try {
    const provider = calls.providers.get('postCms.pages');
    const pages = provider.getChildren();

    const entry = provider.getChildren(pages[0])[0];
    assert.equal(provider.getTreeItem(entry).command.command, 'postCms.editData', '点条目应该直接进编辑');
    const field = provider.getChildren(entry).find((n) => n.kind === 'field');
    assert.equal(provider.getTreeItem(field).command.command, 'postCms.editData', '点字段应该直接进编辑');

    // 装备：先加一组、再加一件，再确认这一件的默认动作
    calls.nextInput = (() => { const q = ['键盘']; return () => q.shift(); })();
    await calls.commands.get('postCms.addData')(pages[2]);
    const gear = provider.getChildren(pages[2])[0];
    calls.nextInput = (() => { const q = ['HHKB Pro 2', '每天在敲']; return () => q.shift(); })();
    await calls.commands.get('postCms.addData')(gear);
    const item = provider.getChildren(gear).find((n) => n.kind === 'item');
    assert.equal(provider.getTreeItem(item).command.command, 'postCms.editData', '点装备里的一件也应该直接进编辑');

    // 真的改一下：点字段 → 填新值 → 文件跟着变，正文/别的字段不动
    calls.nextInput = () => '刚刚改的名字';
    await calls.commands.get('postCms.editData')(field);
    const text = fs.readFileSync(configPath, 'utf8');
    assert.equal(S.unquote(S.readArray(text, 'projects').entries[0].fields.get(field.key).raw), '刚刚改的名字');
    assert.equal(S.readArray(text, 'projects').entries.length, 2, '别的项目不该被动');
  } finally {
    calls.nextInput = undefined;
    fs.writeFileSync(configPath, original);
  }
});

test('editPost：一个入口改元信息，改字段自己写、能派活的派给既有命令', async () => {
  const file = path.join(root, 'src/content/posts/astro-rewrite.md');
  const original = fs.readFileSync(file, 'utf8');
  try {
    const pick = (...pickers) => { calls.nextQuickPick = (items) => pickers.shift()(items); };

    // 标题：editPost 自己写回 frontmatter
    pick((items) => items.find((r) => r.key === 'title'));
    calls.nextInput = () => '换了个标题';
    await calls.commands.get('postCms.editPost')(P.readPost(file));
    assert.equal(P.readPost(file).title, '换了个标题');

    // 系列：派给 postCms.setSeries，走它自己的选择流程
    pick((items) => items.find((r) => r.key === 'series'), (items) => items.find((i) => i.label.includes('新系列')));
    calls.nextInput = () => '建站';
    await calls.commands.get('postCms.editPost')(P.readPost(file));
    assert.equal(P.readPost(file).series, '建站');
    // frontmatter 之外的部分一个字节都不该动
    const bodyOf = (text) => text.split('---').slice(2).join('---');
    assert.equal(bodyOf(fs.readFileSync(file, 'utf8')), bodyOf(original), '正文不该被动');

    // 取消就当没发生
    pick((items) => undefined);
    await calls.commands.get('postCms.editPost')(P.readPost(file));
    assert.equal(P.readPost(file).series, '建站');
  } finally {
    calls.nextQuickPick = undefined;
    calls.nextInput = undefined;
    fs.writeFileSync(file, original);
  }
});
