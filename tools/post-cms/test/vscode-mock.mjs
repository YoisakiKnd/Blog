/** 只实现扩展用到的那几个 VS Code API，够把 activate() 跑起来看接线对不对 */
export const calls = { commands: new Map(), views: [], inputs: [], quickPicks: [], messages: [], opened: [], terminals: [] };

export const EventEmitter = class {
  constructor() { this.event = () => ({ dispose() {} }); }
  fire() {}
  dispose() {}
};

export class TreeItem {
  constructor(label, state) { this.label = label; this.collapsibleState = state; }
}

export const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };

export class ThemeIcon { constructor(id) { this.id = id; } }

export const Uri = {
  file: (p) => ({ fsPath: p, path: p, toString: () => p }),
  parse: (s) => ({ toString: () => s }),
};

export const window = {
  createOutputChannel: () => ({ appendLine: () => {}, dispose: () => {} }),
  createTreeView: (id, options) => { calls.views.push(id); calls.provider = options.treeDataProvider; return { dispose: () => {} }; },
  showTextDocument: async (doc) => { calls.opened.push(doc.uri.fsPath); return doc; },
  showInformationMessage: (m) => { calls.messages.push(m); return Promise.resolve(undefined); },
  showWarningMessage: (m, ...rest) => {
    calls.messages.push(m);
    const btn = rest.find((r) => typeof r === 'string');
    return Promise.resolve(btn);
  },
  showQuickPick: async (items) => { calls.quickPicks.push(items); return calls.nextQuickPick ? calls.nextQuickPick(items) : items[0]; },
  showInputBox: async () => { calls.inputs.push(1); return calls.nextInput ? calls.nextInput() : undefined; },
  createTerminal: (o) => { const t = { name: o.name, show: () => {}, sendText: (s) => calls.terminals.push(s), dispose: () => {} }; calls.terminals.push(o.name); return t; },
  terminals: [],
};

export const workspace = {
  workspaceFolders: [],
  getConfiguration: () => ({ get: (_k, d) => d }),
  openTextDocument: async (uri) => ({ uri }),
};

export const commands = {
  registerCommand: (id, fn) => { calls.commands.set(id, fn); return { dispose() {} }; },
};

export const env = { openExternal: async (u) => { calls.opened.push(String(u)); return true; } };
