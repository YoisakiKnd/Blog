import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  deleteEntry,
  deleteNestedEntry,
  deleteString,
  insertEntry,
  insertNestedEntry,
  insertString,
  readArray,
  readNestedArray,
  readScalar,
  readStrings,
  setEntryField,
  setNestedEntryField,
  setScalar,
  setString,
  stringOffsets,
  tsString,
  unquote,
} from './siteconf';
import { PAGES, type FieldDef, type PageDef } from './sitePages';

type Node =
  | { kind: 'page'; page: PageDef }
  | { kind: 'entry'; page: PageDef; index: number }
  | { kind: 'field'; page: PageDef; index: number; key: string }
  | { kind: 'item'; page: PageDef; index: number; itemIndex: number }
  | { kind: 'itemField'; page: PageDef; index: number; itemIndex: number; key: string }
  | { kind: 'date'; page: PageDef }
  | { kind: 'doing'; page: PageDef }
  | { kind: 'doingItem'; page: PageDef; index: number };

function cfg<T>(key: string, fallback: T): T {
  const value = vscode.workspace.getConfiguration('postCms').get<T>(key);
  return value === undefined || value === null || value === '' ? fallback : value;
}

function root(): string | null {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
}

/** site.config.ts 的绝对路径，不存在就返回 null */
export function configUri(): { file: string; dir: string } | null {
  const base = root();
  if (!base) return null;
  const rel = cfg('configFile', 'src/site.config.ts');
  const file = path.isAbsolute(rel) ? rel : path.join(base, rel);
  return fs.existsSync(file) ? { file, dir: base } : null;
}

async function readConfig(): Promise<string | null> {
  const c = configUri();
  if (!c) return null;
  // 编辑器里要是开着同一个文件且有未保存的改动，先存盘，免得到处是两份
  const open = (vscode.workspace.textDocuments ?? []).find((d) => d.uri.fsPath === c.file);
  if (open?.isDirty) await open.save();
  return fs.readFileSync(c.file, 'utf8');
}

async function writeConfig(next: string): Promise<void> {
  const c = configUri();
  if (!c) throw new Error('找不到 site.config.ts');
  fs.writeFileSync(c.file, next, 'utf8');
}

async function askField(field: FieldDef, current: string | undefined, step: number, total: number): Promise<string | undefined> {
  const title = `${field.label}${total > 1 ? `（${step}/${total}）` : ''}`;
  if (field.choices) {
    const picked = await vscode.window.showQuickPick(
      [...field.choices, ...(current && !field.choices.includes(current) ? [current] : [])],
      { title, placeHolder: current ?? field.choices[0] },
    );
    return picked;
  }
  return vscode.window.showInputBox({
    title,
    value: current ?? '',
    prompt: field.required ? '必填' : '留空就不写这个字段',
    ignoreFocusOut: true,
    validateInput: (value) => (field.required && !value.trim() ? `${field.label}不能空着` : undefined),
  });
}

/** 依次问完所有字段；返回 undefined 表示中途取消 */
async function askEntry(page: PageDef, existing: Map<string, string> | null): Promise<Array<[string, string]> | undefined> {
  const fields = page.fields;
  const out: Array<[string, string]> = [];
  const known = existing ?? new Map<string, string>();
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const answer = await askField(field, known.get(field.key), i + 1, fields.length);
    if (answer === undefined) return undefined;
    if (!answer.trim()) {
      if (field.required) return undefined;
      continue;
    }
    out.push([field.key, answer.trim()]);
  }
  return out;
}

function bodyOf(pairs: Array<[string, string]>): string {
  return pairs.map(([k, v]) => `${k}: ${tsString(v)}`).join(', ');
}

export class PagesProvider implements vscode.TreeDataProvider<Node> {
  private readonly onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChange.event;

  refresh(): void {
    this.onDidChange.fire();
  }

  getTreeItem(node: Node): vscode.TreeItem {
    const text = readConfigText();
    if (node.kind === 'page') {
      const item = new vscode.TreeItem(node.page.label, vscode.TreeItemCollapsibleState.Expanded);
      item.description = describePage(node.page, text);
      item.iconPath = new vscode.ThemeIcon(node.page.id === 'now' ? 'calendar' : 'symbol-array');
      item.contextValue = 'postCms.page';
      item.command = { command: 'postCms.revealData', title: '在 site.config.ts 里定位', arguments: [node] };
      item.tooltip = `打开 /${node.page.id}/ 数据；点一下跳到 site.config.ts 里的位置`;
      return item;
    }
    if (node.kind === 'entry') {
      const fields = entryMap(text, node.page, node.index);
      const label = fields ? unquote(fields.get(node.page.primary)?.raw ?? '') : `第 ${node.index + 1} 项`;
      const item = new vscode.TreeItem(label || `第 ${node.index + 1} 项`, vscode.TreeItemCollapsibleState.Collapsed);
      item.description = describeEntry(node.page, fields);
      item.contextValue = 'postCms.entry';
      item.command = { command: 'postCms.revealData', title: '在 site.config.ts 里定位', arguments: [node] };
      return item;
    }
    if (node.kind === 'field') {
      const fields = entryMap(text, node.page, node.index);
      const def = node.page.fields.find((f) => f.key === node.key);
      const item = new vscode.TreeItem(def?.label ?? node.key, vscode.TreeItemCollapsibleState.None);
      item.description = fields ? unquote(fields.get(node.key)?.raw ?? '（没写）') : '';
      item.contextValue = 'postCms.field';
      item.command = { command: 'postCms.editData', title: '改这个字段', arguments: [node] };
      return item;
    }
    if (node.kind === 'item') {
      const fields = itemMap(text, node.page, node.index, node.itemIndex);
      const item = new vscode.TreeItem(fields ? unquote(fields.get('name')?.raw ?? '这件') : '这件', vscode.TreeItemCollapsibleState.Collapsed);
      item.description = fields ? unquote(fields.get('note')?.raw ?? '') : '';
      item.iconPath = new vscode.ThemeIcon('circle-small-filled');
      item.contextValue = 'postCms.item';
      return item;
    }
    if (node.kind === 'itemField') {
      const fields = itemMap(text, node.page, node.index, node.itemIndex);
      const def = node.page.itemFields?.find((f) => f.key === node.key);
      const item = new vscode.TreeItem(def?.label ?? node.key, vscode.TreeItemCollapsibleState.None);
      item.description = fields ? unquote(fields.get(node.key)?.raw ?? '（没写）') : '';
      item.contextValue = 'postCms.itemField';
      item.command = { command: 'postCms.editData', title: '改这个字段', arguments: [node] };
      return item;
    }
    if (node.kind === 'date') {
      const item = new vscode.TreeItem('更新日期', vscode.TreeItemCollapsibleState.None);
      item.description = node.page.scalar ? (readScalar(text ?? '', node.page.scalar.object, node.page.scalar.key) ?? '') : '';
      item.iconPath = new vscode.ThemeIcon('calendar');
      item.contextValue = 'postCms.date';
      item.command = { command: 'postCms.editData', title: '改日期', arguments: [node] };
      return item;
    }
    if (node.kind === 'doing') {
      const list = node.page.strings ? readStrings(text ?? '', node.page.strings.name) : [];
      const item = new vscode.TreeItem(node.page.strings?.label ?? '正在做的事', vscode.TreeItemCollapsibleState.Expanded);
      item.description = list.length ? `共 ${list.length} 条` : '空';
      item.iconPath = new vscode.ThemeIcon('checklist');
      item.contextValue = 'postCms.doing';
      return item;
    }
    const list = node.page.strings ? readStrings(text ?? '', node.page.strings.name) : [];
    const item = new vscode.TreeItem(list[node.index] ?? `第 ${node.index + 1} 条`, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('circle-small-filled');
    item.contextValue = 'postCms.doingItem';
    item.command = { command: 'postCms.editData', title: '改这条', arguments: [node] };
    return item;
  }

  getChildren(node?: Node): Node[] {
    const text = readConfigText();
    if (!node) return PAGES.map((page) => ({ kind: 'page', page }) as Node);
    if (node.kind === 'page') {
      if (node.page.kind === 'scalar') {
        const children: Node[] = [{ kind: 'date', page: node.page }];
        if (node.page.strings) children.push({ kind: 'doing', page: node.page });
        return children;
      }
      const region = readArray(text ?? '', node.page.array!);
      return (region?.entries ?? []).map((_, index) => ({ kind: 'entry', page: node.page, index }) as Node);
    }
    if (node.kind === 'entry') {
      const entries: Node[] = node.page.fields.map((f) => ({ kind: 'field', page: node.page, index: node.index, key: f.key }) as Node);
      if (node.page.kind === 'group') {
        const nested = readNestedArray(text ?? '', node.page.array!, node.index, 'items');
        for (let i = 0; i < (nested?.entries.length ?? 0); i++) {
          entries.push({ kind: 'item', page: node.page, index: node.index, itemIndex: i });
        }
      }
      return entries;
    }
    if (node.kind === 'item') {
      return (node.page.itemFields ?? []).map((f) => ({ kind: 'itemField', page: node.page, index: node.index, itemIndex: node.itemIndex, key: f.key }) as Node);
    }
    if (node.kind === 'doing') {
      const list = node.page.strings ? readStrings(text ?? '', node.page.strings.name) : [];
      return list.map((_, index) => ({ kind: 'doingItem', page: node.page, index }) as Node);
    }
    return [];
  }
}

/** 同步读文本（树渲染是同步的） */
function readConfigText(): string | null {
  const c = configUri();
  if (!c) return null;
  try {
    return fs.readFileSync(c.file, 'utf8');
  } catch {
    return null;
  }
}

function entryMap(text: string | null, page: PageDef, index: number) {
  if (!text || !page.array) return null;
  return readArray(text, page.array)?.entries[index]?.fields ?? null;
}

function itemMap(text: string | null, page: PageDef, index: number, itemIndex: number) {
  if (!text || !page.array) return null;
  return readNestedArray(text, page.array, index, 'items')?.entries[itemIndex]?.fields ?? null;
}

function describePage(page: PageDef, text: string | null): string {
  if (!text) return '找不到 site.config.ts';
  if (page.kind === 'scalar') {
    const updated = page.scalar ? readScalar(text, page.scalar.object, page.scalar.key) : '';
    const list = page.strings ? readStrings(text, page.strings.name).length : 0;
    return `${updated ?? ''} · ${list} 条`;
  }
  const count = readArray(text, page.array!)?.entries.length ?? 0;
  return count ? `共 ${count} 项` : '空';
}

function describeEntry(page: PageDef, fields: Map<string, { raw: string }> | null): string {
  if (!fields) return '';
  return page.fields
    .filter((f) => f.key !== page.primary)
    .map((f) => unquote(fields.get(f.key)?.raw ?? ''))
    .filter(Boolean)
    .join(' · ');
}

export function registerPages(context: vscode.ExtensionContext): void {
  const provider = new PagesProvider();
  const view = vscode.window.createTreeView('postCms.pages', { treeDataProvider: provider });
  context.subscriptions.push(view);

  const openDocAt = async (offset: number | null) => {
    const c = configUri();
    if (!c) {
      vscode.window.showWarningMessage('找不到 site.config.ts');
      return;
    }
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(c.file));
    const editor = await vscode.window.showTextDocument(doc);
    if (offset !== null && offset >= 0) {
      const pos = doc.positionAt(offset);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('postCms.refreshPages', () => provider.refresh()),
    vscode.commands.registerCommand('postCms.openDataPage', (node: Node) => {
      if (node?.page) void vscode.env.openExternal(vscode.Uri.parse(`${cfg('siteUrl', 'http://localhost:4321')}${node.page.url}`));
    }),
    vscode.commands.registerCommand('postCms.revealData', async (node: Node) => {
      const text = await readConfig();
      if (!text || !node?.page) return;
      let offset = 0;
      if (node.kind === 'page') {
        if (node.page.kind === 'scalar') offset = text.indexOf(`const ${node.page.scalar!.object}`);
        else if (node.page.array) offset = text.indexOf(`const ${node.page.array}`);
      } else if (node.kind === 'entry') {
        offset = readArray(text, node.page.array!)?.entries[node.index]?.start ?? 0;
      } else if (node.kind === 'field') {
        offset = entryMap(text, node.page, node.index)?.get(node.key)?.start ?? 0;
      } else if (node.kind === 'item') {
        offset = readNestedArray(text, node.page.array!, node.index, 'items')?.entries[node.itemIndex]?.start ?? 0;
      } else if (node.kind === 'itemField') {
        offset = itemMap(text, node.page, node.index, node.itemIndex)?.get(node.key)?.start ?? 0;
      } else if (node.kind === 'date') {
        offset = text.indexOf(`${node.page.scalar!.key}:`);
      } else if (node.kind === 'doing' || node.kind === 'doingItem') {
        const name = node.page.strings!.name;
        if (node.kind === 'doingItem') offset = stringOffsets(text, name)[node.index]?.start ?? 0;
        else offset = text.indexOf(`const ${name}`);
      }
      await openDocAt(offset >= 0 ? offset : 0);
    }),
    vscode.commands.registerCommand('postCms.addData', async (node: Node) => {
      const text = await readConfig();
      if (!text || !node?.page) return;
      try {
        let next: string;
        // page 节点和「正在做的事」那一行都往这一步走：都是往 doing 里加一条
        if ((node.kind === 'page' || node.kind === 'doing') && node.page.kind === 'scalar') {
          const value = await vscode.window.showInputBox({ title: `加一条${node.page.strings!.label}`, ignoreFocusOut: true, prompt: '一句话就行' });
          if (!value?.trim()) return;
          next = insertString(text, node.page.strings!.name, tsString(value.trim()));
        } else if (node.kind === 'page') {
          const pairs = await askEntry(node.page, null);
          if (!pairs) return;
          const extra = node.page.kind === 'group' ? ', items: []' : '';
          next = insertEntry(text, node.page.array!, bodyOf(pairs) + extra);
        } else if (node.kind === 'entry' && node.page.kind === 'group') {
          const pairs = await askEntryGroupItems(node.page);
          if (!pairs) return;
          next = insertNestedEntry(text, node.page.array!, node.index, 'items', bodyOf(pairs));
        } else {
          return;
        }
        await writeConfig(next);
        provider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`写入失败：${String(error)}`);
      }
    }),
    vscode.commands.registerCommand('postCms.editData', async (node: Node) => {
      const text = await readConfig();
      if (!text || !node?.page) return;
      try {
        let next: string | null = null;
        if (node.kind === 'date') {
          const value = await vscode.window.showInputBox({
            title: node.page.scalar!.label,
            value: readScalar(text, node.page.scalar!.object, node.page.scalar!.key) ?? '',
            ignoreFocusOut: true,
            validateInput: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? undefined : '写成 2026-09-30 这样'),
          });
          if (value === undefined) return;
          next = setScalar(text, node.page.scalar!.object, node.page.scalar!.key, tsString(value.trim()));
        } else if (node.kind === 'doingItem') {
          const list = readStrings(text, node.page.strings!.name);
          const value = await vscode.window.showInputBox({ title: '改这条', value: list[node.index] ?? '', ignoreFocusOut: true });
          if (value === undefined || !value.trim()) return;
          next = setString(text, node.page.strings!.name, node.index, tsString(value.trim()));
        } else if (node.kind === 'field' || node.kind === 'itemField') {
          const defs = node.kind === 'field' ? node.page.fields : node.page.itemFields!;
          const def = defs.find((f) => f.key === node.key)!;
          const map = node.kind === 'field'
            ? entryMap(text, node.page, node.index)
            : itemMap(text, node.page, node.index, node.itemIndex);
          const value = await askField(def, map ? unquote(map.get(node.key)?.raw ?? '') : '', 1, 1);
          if (value === undefined || !value.trim()) return;
          next = node.kind === 'field'
            ? setEntryField(text, node.page.array!, node.index, node.key, tsString(value.trim()))
            : setNestedEntryField(text, node.page.array!, node.index, 'items', node.itemIndex, node.key, tsString(value.trim()));
        } else if (node.kind === 'entry') {
          const map = entryMap(text, node.page, node.index);
          const missing = node.page.kind === 'group' ? null : node.page.fields.filter((f) => !map?.has(f.key));
          const choices = [
            ...node.page.fields.map((f) => ({
              label: `${f.label}：${map ? unquote(map.get(f.key)?.raw ?? '') || '（没写）' : ''}`,
              field: f,
            })),
            ...(missing ?? []).map((f) => ({ label: `${f.label}：还没写`, field: f })),
          ];
          const picked = await vscode.window.showQuickPick(choices, { title: '改哪个字段', placeHolder: node.page.fields[0].label });
          if (!picked) return;
          const value = await askField(picked.field, map ? unquote(map.get(picked.field.key)?.raw ?? '') : '', 1, 1);
          if (value === undefined || !value.trim()) return;
          next = setEntryField(text, node.page.array!, node.index, picked.field.key, tsString(value.trim()));
        } else if (node.kind === 'item') {
          const map = itemMap(text, node.page, node.index, node.itemIndex);
          const choices = node.page.itemFields!.map((f) => ({ label: `${f.label}：${map ? unquote(map.get(f.key)?.raw ?? '') || '（没写）' : ''}`, field: f }));
          const picked = await vscode.window.showQuickPick(choices, { title: '改哪个字段' });
          if (!picked) return;
          const value = await askField(picked.field, map ? unquote(map.get(picked.field.key)?.raw ?? '') : '', 1, 1);
          if (value === undefined || !value.trim()) return;
          next = setNestedEntryField(text, node.page.array!, node.index, 'items', node.itemIndex, picked.field.key, tsString(value.trim()));
        }
        if (!next) return;
        await writeConfig(next);
        provider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`写入失败：${String(error)}`);
      }
    }),
    vscode.commands.registerCommand('postCms.removeData', async (node: Node) => {
      const text = await readConfig();
      if (!text || !node?.page) return;
      let name: string;
      if (node.kind === 'doingItem') {
        name = readStrings(text, node.page.strings!.name)[node.index] ?? '这一条';
      } else if (node.kind === 'item') {
        name = unquote(itemMap(text, node.page, node.index, node.itemIndex)?.get('name')?.raw ?? '这件');
      } else if (node.kind === 'entry') {
        name = unquote(entryMap(text, node.page, node.index)?.get(node.page.primary)?.raw ?? '这一项');
      } else {
        return;
      }
      const ok = await vscode.window.showWarningMessage(`删掉「${name}」？`, { modal: true }, '删除');
      if (ok !== '删除') return;
      try {
        let next: string;
        if (node.kind === 'doingItem') next = deleteString(text, node.page.strings!.name, node.index);
        else if (node.kind === 'item') next = deleteNestedEntry(text, node.page.array!, node.index, 'items', node.itemIndex);
        else next = deleteEntry(text, node.page.array!, node.index);
        await writeConfig(next);
        provider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`删除失败：${String(error)}`);
      }
    }),
  );
}

/** 装备里加一件时问 name/note */
async function askEntryGroupItems(page: PageDef): Promise<Array<[string, string]> | undefined> {
  const out: Array<[string, string]> = [];
  const defs = page.itemFields ?? [];
  for (let i = 0; i < defs.length; i++) {
    const answer = await askField(defs[i], '', i + 1, defs.length);
    if (answer === undefined) return undefined;
    if (!answer.trim()) {
      if (defs[i].required) return undefined;
      continue;
    }
    out.push([defs[i].key, answer.trim()]);
  }
  return out;
}
