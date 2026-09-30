import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  createPost,
  existingValues,
  listPosts,
  postUrl,
  setField,
  setTags,
  today,
  toggleDraft,
  slugify,
  type Post,
} from './posts';

let output: vscode.OutputChannel | undefined;

function cfg<T>(key: string, fallback: T): T {
  return vscode.workspace.getConfiguration('postCms').get<T>(key, fallback);
}

function root(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function postsDir(): string | undefined {
  const r = root();
  return r ? path.join(r, cfg('postsDir', 'src/content/posts')) : undefined;
}

class PostsProvider implements vscode.TreeDataProvider<Node> {
  private emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(node: Node): vscode.TreeItem {
    return node.item;
  }

  getChildren(node?: Node): Node[] {
    const dir = postsDir();
    if (!dir) return [];
    const all = listPosts(dir);
    if (!node) {
      const groups: Node[] = [];
      const drafts = all.filter((p) => p.draft);
      const live = all.filter((p) => !p.draft);
      if (drafts.length) groups.push(group(`草稿（${drafts.length}）`, drafts));
      if (live.length) groups.push(group(`已发布（${live.length}）`, live));
      return groups;
    }
    return (node.children ?? []).map(postNode);
  }
}

interface Node {
  item: vscode.TreeItem;
  children?: Post[];
}

function group(label: string, children: Post[]): Node {
  const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
  item.contextValue = 'postCms.group';
  return { item, children };
}

function postNode(post: Post): Node {
  const item = new vscode.TreeItem(post.title, vscode.TreeItemCollapsibleState.None);
  const bits = [post.pubDate || '没填日期', post.category];
  if (post.series) bits.push(`系列：${post.series}`);
  item.description = bits.join(' · ');
  item.tooltip = `${post.description || '（没写摘要）'}\n${post.slug}`;
  item.iconPath = new vscode.ThemeIcon(post.draft ? 'circle-outline' : 'book');
  item.contextValue = post.draft ? 'postCms.draft' : 'postCms.published';
  item.command = {
    command: 'postCms.openPost',
    title: '打开',
    arguments: [post],
  };
  return { item };
}

async function pickCategory(dir: string, current: string): Promise<string | undefined> {
  const items = existingValues(dir, 'category').map((c) => ({ label: c, picked: c === current }));
  const custom = { label: '$(add) 新分类…', alwaysShow: true } as vscode.QuickPickItem;
  const picked = await vscode.window.showQuickPick([...items, custom], { title: '选分类', placeHolder: current });
  if (!picked) return undefined;
  if (picked === custom) {
    return vscode.window.showInputBox({ title: '新分类', placeHolder: '折腾' });
  }
  return picked.label;
}

async function pickTags(dir: string, current: string[]): Promise<string[] | undefined> {
  const used = existingValues(dir, 'tags');
  const items: vscode.QuickPickItem[] = [...new Set([...used, ...current])].sort().map((t) => ({
    label: t,
    picked: current.includes(t),
  }));
  items.push({ label: '$(add) 新标签…', alwaysShow: true });
  const picked = await vscode.window.showQuickPick(items, { title: '选标签（可多选）', canPickMany: true });
  if (!picked) return undefined;
  const out: string[] = [];
  for (const p of picked) {
    if (p.label.startsWith('$(add)')) {
      const extra = await vscode.window.showInputBox({ title: '新标签（多个用空格隔开）' });
      if (extra) out.push(...extra.split(/\s+/).filter(Boolean));
    } else {
      out.push(p.label);
    }
  }
  return [...new Set(out)];
}

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel('笔记 CMS');
  const provider = new PostsProvider();

  context.subscriptions.push(
    vscode.window.createTreeView('postCms.posts', { treeDataProvider: provider, showCollapseAll: true }),
    vscode.commands.registerCommand('postCms.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('postCms.openPost', async (post: Post) => {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(post.file));
      await vscode.window.showTextDocument(doc);
    }),
    vscode.commands.registerCommand('postCms.newPost', async () => {
      const dir = postsDir();
      if (!dir) return;
      const title = await vscode.window.showInputBox({ title: '新文章标题', placeHolder: '比如：把博客换成 Astro 之后' });
      if (!title) return;
      const description = (await vscode.window.showInputBox({ title: '一句话摘要（列表页和分享卡片都用它）' })) ?? '';
      const auto = slugify(title);
      const slug = await vscode.window.showInputBox({
        title: '文件名（也就是 /posts/<这个>/ 里的那段）',
        value: auto,
        validateInput: (v) =>
          /^[\w\u4e00-\u9fa5-]+$/.test(v) ? undefined : '只能用字母、数字、汉字、下划线和连字符',
      });
      if (!slug) return;
      const file = createPost(
        dir,
        {
          title,
          description,
          pubDate: today(),
          category: cfg('defaultCategory', '日常'),
          tags: [],
          draft: true,
        },
        { slug },
      );
      provider.refresh();
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
      await vscode.window.showTextDocument(doc);
      vscode.window.showInformationMessage(`已新建草稿：${path.basename(file)} —— 发布时把 draft 改成 false`);
    }),
    vscode.commands.registerCommand('postCms.toggleDraft', (post: Post) => {
      const nowDraft = toggleDraft(post.file);
      provider.refresh();
      vscode.window.showInformationMessage(nowDraft ? '转回草稿了，线上不会出现' : '已发布，push 之后就会出现在线上');
    }),
    vscode.commands.registerCommand('postCms.setCategory', async (post: Post) => {
      const dir = postsDir();
      if (!dir) return;
      const category = await pickCategory(dir, post.category);
      if (category) {
        setField(post.file, 'category', category);
        provider.refresh();
      }
    }),
    vscode.commands.registerCommand('postCms.setTags', async (post: Post) => {
      const dir = postsDir();
      if (!dir) return;
      const tags = await pickTags(dir, post.tags);
      if (tags) {
        setTags(post.file, tags);
        provider.refresh();
      }
    }),
    vscode.commands.registerCommand('postCms.setSeries', async (post: Post) => {
      const dir = postsDir();
      if (!dir) return;
      const used = existingValues(dir, 'series');
      const items: vscode.QuickPickItem[] = [
        ...used.map((s) => ({ label: s, picked: s === post.series })),
        { label: '$(add) 新系列…' },
        { label: '$(close) 不参与系列' },
      ];
      const picked = await vscode.window.showQuickPick(items, { title: '系列' });
      if (!picked) return;
      if (picked.label.startsWith('$(close)')) {
        setField(post.file, 'series', '');
        const text = fs.readFileSync(post.file, 'utf8');
        fs.writeFileSync(post.file, text.replace(/^series:\s*$/m, '').replace(/^series: ''$/m, ''), 'utf8');
      } else if (picked.label.startsWith('$(add)')) {
        const name = await vscode.window.showInputBox({ title: '系列名', placeHolder: '建站' });
        if (!name) return;
        setField(post.file, 'series', name);
      } else {
        setField(post.file, 'series', picked.label);
      }
      provider.refresh();
    }),
    vscode.commands.registerCommand('postCms.setDate', async (post: Post) => {
      const value = await vscode.window.showInputBox({
        title: '发布日期（决定列表和归档的排序）',
        value: post.pubDate || today(),
        validateInput: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? undefined : '写成 2026-09-30 这样'),
      });
      if (value) {
        setField(post.file, 'pubDate', value);
        provider.refresh();
      }
    }),
    vscode.commands.registerCommand('postCms.openPreview', async (post: Post) => {
      const url = postUrl(cfg('siteUrl', 'http://localhost:4321'), post.slug);
      output?.appendLine(`打开 ${url}`);
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }),
    vscode.commands.registerCommand('postCms.startDev', () => {
      const r = root();
      if (!r) return;
      const term = vscode.window.terminals.find((t) => t.name === '博客 dev') ?? vscode.window.createTerminal({ name: '博客 dev', cwd: r });
      term.show();
      term.sendText(cfg('devCommand', 'pnpm dev'));
    }),
    vscode.commands.registerCommand('postCms.deletePost', async (post: Post) => {
      const yes = await vscode.window.showWarningMessage(`删掉《${post.title}》？文件会被直接删除（git 里还能找回来）`, { modal: true }, '删除');
      if (yes !== '删除') return;
      fs.rmSync(post.file);
      provider.refresh();
    }),
  );
}

export function deactivate(): void {
  // 没有需要清理的资源：命令和视图都在 subscriptions 里
}
