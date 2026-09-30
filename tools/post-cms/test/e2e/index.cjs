/**
 * 真机端到端：这段代码是跑在 VS Code 里的（--extensionTestsPath），用的是真的 vscode API。
 * 只走不需要人机交互的那几条：激活、命令注册、改 frontmatter、打开文件。
 * 需要弹输入框的「新建文章」在 mock 测试里覆盖。
 */
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vscode = require('vscode');

const EXPECTED = [
  'postCms.newPost',
  'postCms.refresh',
  'postCms.startDev',
  'postCms.openPost',
  'postCms.openPreview',
  'postCms.toggleDraft',
  'postCms.setCategory',
  'postCms.setTags',
  'postCms.setSeries',
  'postCms.setDate',
  'postCms.deletePost',
];

async function run() {
  const folder = vscode.workspace.workspaceFolders?.[0];
  console.log('[e2e] 工作区：' + folder?.uri.fsPath);

  const ext = vscode.extensions.getExtension('tyling.post-cms');
  assert.ok(ext, '扩展没被加载');
  await ext.activate();
  console.log('[e2e] 激活成功');

  const all = await vscode.commands.getCommands(true);
  for (const id of EXPECTED) assert.ok(all.includes(id), '没注册命令：' + id);
  console.log('[e2e] 命令齐全：' + EXPECTED.length);

  // 视图 id 必须和 package.json 一致：执行一次 refresh 就说明注册上了
  await vscode.commands.executeCommand('postCms.refresh');
  console.log('[e2e] refresh 可执行');

  const file = path.join(folder.uri.fsPath, 'src/content/posts/astro-rewrite.md');
  const post = { file, slug: 'astro-rewrite', title: '把站点从 Fuwari 换成 Astro', category: '折腾', tags: [], draft: false, pubDate: '2026-09-27', description: '' };

  await vscode.commands.executeCommand('postCms.toggleDraft', post);
  const after = fs.readFileSync(file, 'utf8');
  assert.match(after, /draft: true/, 'toggleDraft 没写进文件');
  assert.match(after, /旧站点主题太重了/, '正文被动了');
  console.log('[e2e] toggleDraft 改的是 frontmatter，正文完好');

  await vscode.commands.executeCommand('postCms.openPost', post);
  const active = vscode.window.activeTextEditor;
  assert.ok(active && active.document.uri.fsPath === file, 'openPost 没打开对应文件');
  console.log('[e2e] openPost 打开的就是那个文件');

  await vscode.commands.executeCommand('postCms.toggleDraft', post); // 还原
  assert.match(fs.readFileSync(file, 'utf8'), /draft: false/);
  console.log('[e2e] 全部通过');
}

module.exports = { run };
