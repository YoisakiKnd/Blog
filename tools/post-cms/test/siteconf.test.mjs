import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { transform } from 'esbuild';
import * as S from '../out/siteconf.mjs';

const REPO = path.resolve(import.meta.dirname, '../../..');
const CONFIG = path.join(REPO, 'src/site.config.ts');
let text;

before(() => {
  text = fs.readFileSync(CONFIG, 'utf8');
});

/** 改完必须还是能解析的 TypeScript */
async function validTs(source) {
  await transform(source, { loader: 'ts' });
}

/** 除了这一段，其余字节必须一模一样 */
function onlyChanged(before, after, from, to) {
  assert.equal(after.slice(0, from), before.slice(0, from), '前面被动了');
  assert.equal(
    after.slice(from + (after.length - before.length)),
    before.slice(to),
    '后面被动了',
  );
}

test('解析仓库里那份真的 site.config.ts', () => {
  const projects = S.readArray(text, 'projects');
  assert.ok(projects, '没找到 projects');
  assert.equal(projects.entries.length, 2);
  assert.deepEqual([...projects.entries[0].fields.keys()], ['name', 'desc', 'href', 'status']);
  assert.equal(S.unquote(projects.entries[0].fields.get('name').raw), 'clip-time');
  assert.equal(S.unquote(projects.entries[1].fields.get('status').raw), '在用');
  // href 写的是 site.github，是表达式不是字符串，必须原样留着
  assert.equal(projects.entries[0].fields.get('href').raw, 'site.github');
  assert.equal(projects.entries[1].fields.get('href').raw, 'site.github');

  assert.equal(S.readArray(text, 'friends').entries.length, 0);
  assert.equal(S.readArray(text, 'gear').entries.length, 0);
  assert.equal(S.readArray(text, 'shelf').entries.length, 0);
  assert.equal(S.readScalar(text, 'now', 'updated'), '2026-09-30');
  const doing = S.readStrings(text, 'doing');
  assert.equal(doing.length, 3);
  assert.ok(doing.every((s) => s.length > 4));
});

test('改一个字段：只动那一段，site.github、注释、别页数据全在', async () => {
  const before = text;
  const after = S.setEntryField(before, 'projects', 0, 'status', S.tsString('弃坑'));
  assert.equal(after, before.replace("status: '在用'", "status: '弃坑'"));
  assert.match(after, /href: site.github/);
  assert.match(after, /\/\*\* 项目页/);
  assert.equal(S.unquote(S.readArray(after, 'projects').entries[0].fields.get('status').raw), '弃坑');
  assert.equal(S.readStrings(after, 'doing').length, 3);
  await validTs(after);
});

test('给空数组加一项，解析得回来；删掉之后字节回到原样', async () => {
  const before = text;
  const added = S.insertEntry(before, 'friends', "name: 'ty0', href: 'https://ty0.icu', desc: '站长'");
  await validTs(added);
  const region = S.readArray(added, 'friends');
  assert.equal(region.entries.length, 1);
  assert.equal(S.unquote(region.entries[0].fields.get('name').raw), 'ty0');
  assert.equal(S.unquote(region.entries[0].fields.get('desc').raw), '站长');
  assert.equal(S.readArray(added, 'projects').entries.length, 2, '别的数组被动了');

  const back = S.deleteEntry(added, 'friends', 0);
  assert.equal(back, before, '加一项再删一项应该回到原样');
  await validTs(back);

  const two = S.insertEntry(added, 'friends', "name: 'b', href: 'https://b.dev'");
  assert.equal(S.readArray(two, 'friends').entries.length, 2);
  assert.equal(S.readArray(two, 'friends').entries[1].fields.has('desc'), false, '没写的字段不该冒出来');
  assert.equal(S.unquote(S.readArray(two, 'friends').entries[1].fields.get('name').raw), 'b');
  await validTs(two);
});

test('装备：先加组，再往组里塞两件，结构还对', async () => {
  const before = text;
  const withGroup = S.insertEntry(before, 'gear', "group: '键盘', items: []");
  await validTs(withGroup);
  let region = S.readArray(withGroup, 'gear');
  assert.equal(region.entries.length, 1);
  assert.equal(S.unquote(region.entries[0].fields.get('group').raw), '键盘');

  const one = S.insertNestedEntry(withGroup, 'gear', 0, 'items', "name: 'HHKB Pro 2', note: '每天在敲'");
  await validTs(one);
  const two = S.insertNestedEntry(one, 'gear', 0, 'items', "name: 'Filco 87', note: '备用'");
  await validTs(two);
  assert.match(two, /HHKB Pro 2/);
  assert.match(two, /Filco 87/);
  assert.match(two, /group: '键盘', items: \[/);
  assert.equal(S.readArray(two, 'projects').entries.length, 2, '别的数组被动了');
  await validTs(two);
});

test('书架：对象数组的增删改', async () => {
  let out = text;
  out = S.insertEntry(out, 'shelf', "title: '纳瓦尔宝典', author: 'Eric Jorgenson', state: '在读'");
  await validTs(out);
  out = S.insertEntry(out, 'shelf', "title: '程序员修炼之道'");
  await validTs(out);
  let entries = S.readArray(out, 'shelf').entries;
  assert.equal(entries.length, 2);
  assert.equal(S.unquote(entries[0].fields.get('author').raw), 'Eric Jorgenson');
  out = S.setEntryField(out, 'shelf', 1, 'state', S.tsString('读完'));
  await validTs(out);
  assert.equal(S.unquote(S.readArray(out, 'shelf').entries[1].fields.get('state').raw), '读完');
  // 给缺字段的那本补一个 author：应该追加在对象里
  out = S.setEntryField(out, 'shelf', 1, 'author', S.tsString('Hunt & Thomas'));
  await validTs(out);
  assert.equal(S.unquote(S.readArray(out, 'shelf').entries[1].fields.get('author').raw), 'Hunt & Thomas');
  assert.equal(S.readArray(out, 'shelf').entries[1].fields.get('title').raw, "'程序员修炼之道'");
  out = S.deleteEntry(out, 'shelf', 0);
  await validTs(out);
  assert.equal(S.readArray(out, 'shelf').entries.length, 1);
  assert.equal(S.readArray(out, 'shelf').entries[0].fields.get('title').raw, "'程序员修炼之道'");
});

test('现在：日期和「正在做的事」', async () => {
  let out = text;
  out = S.setScalar(out, 'now', 'updated', S.tsString('2026-10-01'));
  await validTs(out);
  assert.equal(S.readScalar(out, 'now', 'updated'), '2026-10-01');
  assert.equal(out, text.replace("updated: '2026-09-30'", "updated: '2026-10-01'"));

  out = S.insertString(out, 'doing', S.tsString('把装备页填满'));
  await validTs(out);
  assert.equal(S.readStrings(out, 'doing').length, 4);
  assert.equal(S.readStrings(out, 'doing')[3], '把装备页填满');

  out = S.setString(out, 'doing', 0, S.tsString('改过的第一条'));
  await validTs(out);
  assert.equal(S.readStrings(out, 'doing')[0], '改过的第一条');

  out = S.deleteString(out, 'doing', 0);
  await validTs(out);
  const doing = S.readStrings(out, 'doing');
  assert.equal(doing.length, 3);
  assert.equal(doing[0], S.readStrings(text, 'doing')[1], '删掉第一条之后，剩下的顺序应该对上');
});

test('值里的撇号、反斜杠、中文能原样写进去再读回来', async () => {
  const nasty = "O'Reilly 的《性能》\\ 反斜杠";
  const literal = S.tsString(nasty);
  assert.equal(S.unquote(literal), nasty);
  const out = S.insertEntry(text, 'friends', `name: ${literal}, href: 'https://x.dev'`);
  await validTs(out);
  assert.equal(S.unquote(S.readArray(out, 'friends').entries[0].fields.get('name').raw), nasty);
});

test('找不到的数组要报错，不要静默乱改', () => {
  assert.equal(S.readArray(text, 'nope'), null);
  assert.equal(S.readArray(text, 'project'), null); // 不能把 projects 认成 project
  assert.throws(() => S.insertEntry(text, 'nope', 'a: 1'), /找不到数组/);
  assert.throws(() => S.setEntryField(text, 'projects', 9, 'name', "'x'"), /不存在/);
});
