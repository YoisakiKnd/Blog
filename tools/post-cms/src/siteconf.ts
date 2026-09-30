/**
 * 读写 site.config.ts 里那几页数据（项目 / 友链 / 装备 / 书架 / 现在）。
 *
 * 那是 TypeScript 源码，不是数据文件，所以这里不引 TS 编译器（会把扩展从 16 KB
 * 撑到几 MB），而是自己扫：认字符串（含转义）、行注释、块注释，按括号深度切出
 * 数组和对象；编辑只替换命中的那一小段，其余字节一个不动。写完的文件还会用
 * esbuild 解析一遍（测试里做），确保没把 TS 语法写坏。
 */
export interface Field {
  /** 从 key 开头到值结束 */
  start: number;
  end: number;
  /** 值原文，比如 `'在用'` 或 `site.github` */
  raw: string;
}

export interface Entry {
  /** `{` 到 `}` 的位置 */
  start: number;
  end: number;
  fields: Map<string, Field>;
}

export interface Region {
  /** `[` 和 `]` 的位置 */
  open: number;
  close: number;
  entries: Entry[];
}

/** 从一个引号开始，返回闭合引号之后的位置 */
function skipString(text: string, i: number): number {
  const quote = text[i];
  i += 1;
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === quote) return i + 1;
    if (c === '\n' && quote !== '`') return i + 1; // 未闭合，别死循环
    i += 1;
  }
  return i;
}

/** 当前位置如果是注释就跳过去，返回新位置 */
function skipComment(text: string, i: number): number {
  if (text[i] === '/' && text[i + 1] === '/') {
    const nl = text.indexOf('\n', i);
    return nl < 0 ? text.length : nl + 1;
  }
  if (text[i] === '/' && text[i + 1] === '*') {
    const end = text.indexOf('*/', i + 2);
    return end < 0 ? text.length : end + 2;
  }
  return i;
}

/** 从开括号（位置 i）找到配对的闭括号 */
function matchBracket(text: string, i: number): number {
  const open = text[i];
  const close = open === '[' ? ']' : open === '{' ? '}' : ')';
  let depth = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(text, i);
      continue;
    }
    const after = skipComment(text, i);
    if (after !== i) {
      i = after;
      continue;
    }
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return text.length - 1;
}

/** 找 `export const <name> = [` 里那个 `[` */
function findArrayOpen(text: string, name: string): number | null {
  const re = new RegExp(`export\\s+const\\s+${name}\\s*(?::[^=]*)?=\\s*\\[`);
  const m = re.exec(text);
  if (!m) return null;
  // 正则尾巴就是那个 [（类型注解里的 [] 已被 [^=]* 吃掉），别再 indexOf 回头找
  return m.index + m[0].length - 1;
}

/** 找 `const <name> = {` 里那个 `{` */
function findObjectOpen(text: string, name: string): number | null {
  const re = new RegExp(`export\\s+const\\s+${name}\\s*(?::[^=]*)?=\\s*\\{`);
  const m = re.exec(text);
  if (!m) return null;
  return m.index + m[0].length - 1;
}

/** 把 from..to 之间按顶层分隔符切开（忽略括号内和字符串里） */
function splitTopLevel(text: string, from: number, to: number): Array<[number, number]> {
  const parts: Array<[number, number]> = [];
  let depth = 0;
  let start = from;
  let i = from;
  while (i < to) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      i = skipString(text, i);
      continue;
    }
    const after = skipComment(text, i);
    if (after !== i) {
      i = after;
      continue;
    }
    if (c === '[' || c === '{' || c === '(') depth += 1;
    else if (c === ']' || c === '}' || c === ')') depth -= 1;
    else if (c === ',' && depth === 0) {
      parts.push([start, i]);
      start = i + 1;
    }
    i += 1;
  }
  if (text.slice(start, to).trim()) parts.push([start, to]);
  return parts;
}

function trimRange(text: string, from: number, to: number): [number, number] {
  let a = from;
  let b = to;
  while (a < b && /\s/.test(text[a])) a += 1;
  while (b > a && /\s/.test(text[b - 1])) b -= 1;
  return [a, b];
}

/** 解析一个 `{ … }` 里的顶层 key: value */
function parseFields(text: string, start: number, end: number): Map<string, Field> {
  const fields = new Map<string, Field>();
  for (const [a, b] of splitTopLevel(text, start + 1, end)) {
    const [ka, kb] = trimRange(text, a, b);
    const colon = text.indexOf(':', ka);
    if (colon < 0 || colon > kb) continue;
    const key = text.slice(ka, colon).trim().replace(/^['"]|['"]$/g, '');
    if (!/^[A-Za-z_$][\w$]*$/.test(key)) continue;
    // 值的范围：从冒号后到这一项的末尾
    let [va, vb] = trimRange(text, colon + 1, kb);
    fields.set(key, { start: va, end: vb, raw: text.slice(va, vb) });
  }
  return fields;
}

export function readArray(text: string, name: string): Region | null {
  const open = findArrayOpen(text, name);
  if (open === null) return null;
  const close = matchBracket(text, open);
  const entries: Entry[] = [];
  for (const [a, b] of splitTopLevel(text, open + 1, close)) {
    const [ea] = trimRange(text, a, b);
    if (text[ea] !== '{') continue;
    const inner = matchBracket(text, ea);
    entries.push({ start: ea, end: inner, fields: parseFields(text, ea, inner) });
  }
  return { open, close, entries };
}

/** 读一个标量字段，比如 now 里的 updated */
export function readScalar(text: string, objectName: string, key: string): string | null {
  const open = findObjectOpen(text, objectName);
  if (open === null) return null;
  const close = matchBracket(text, open);
  const field = parseFields(text, open, close).get(key);
  return field ? unquote(field.raw) : null;
}

export function setScalar(text: string, objectName: string, key: string, valueLiteral: string): string {
  const open = findObjectOpen(text, objectName);
  if (open === null) throw new Error(`找不到 ${objectName}`);
  const close = matchBracket(text, open);
  const field = parseFields(text, open, close).get(key);
  if (!field) throw new Error(`${objectName} 里没有 ${key}`);
  return text.slice(0, field.start) + valueLiteral + text.slice(field.end);
}

/** 读一个字符串数组，比如 doing */
export function readStrings(text: string, name: string): string[] {
  const region = readArray(text, name);
  if (!region) return [];
  return splitTopLevel(text, region.open + 1, region.close)
    .map(([a, b]) => unquote(text.slice(...trimRange(text, a, b))))
    .filter((s) => s.length > 0);
}

export function setEntryField(text: string, name: string, index: number, key: string, valueLiteral: string): string {
  const region = readArray(text, name);
  const entry = region?.entries[index];
  if (!region || !entry) throw new Error(`${name} 的第 ${index} 项不存在`);
  const field = entry.fields.get(key);
  if (!field) {
    // 字段不存在：补在对象最后一个字段后面
    const last = [...entry.fields.values()].sort((a, b) => b.end - a.end)[0];
    const at = last ? last.end : entry.start + 1;
    return text.slice(0, at) + `, ${key}: ${valueLiteral}` + text.slice(at);
  }
  return text.slice(0, field.start) + valueLiteral + text.slice(field.end);
}

/** 在数组末尾加一项。body 是对象字面量去掉大括号的内容，比如 `name: 'x', href: 'y'` */
export function insertEntry(text: string, name: string, body: string): string {
  const region = readArray(text, name);
  if (!region) throw new Error(`找不到数组 ${name}`);
  const last = region.entries[region.entries.length - 1];
  if (!last) {
    return text.slice(0, region.open) + `[\n    { ${body} },\n  ]` + text.slice(region.close + 1);
  }
  // 上一项后面没逗号就补一个（生成器里常常省略），然后插在逗号后面。
  // 注意不能再自己带一个逗号，否则会变成 [a,,] 这种数组空洞。
  const afterLast = last.end + 1;
  let out = text[afterLast] === ',' ? text : text.slice(0, afterLast) + ',' + text.slice(afterLast);
  return out.slice(0, afterLast + 1) + `\n    { ${body} },` + out.slice(afterLast + 1);
}

/** 给装备里的某一组加一件 */
export function insertNestedEntry(text: string, name: string, index: number, key: string, body: string): string {
  const region = readArray(text, name);
  const entry = region?.entries[index];
  if (!region || !entry) throw new Error(`${name} 的第 ${index} 项不存在`);
  const field = entry.fields.get(key);
  if (!field) throw new Error(`${name} 第 ${index} 项没有 ${key}`);
  const open = text.indexOf('[', field.start);
  if (open < 0 || open > field.end) throw new Error(`${key} 不是数组`);
  const close = matchBracket(text, open);
  const inner = text.slice(open + 1, close);
  if (!inner.trim()) {
    return text.slice(0, open) + `[\n      { ${body} },\n    ]` + text.slice(close + 1);
  }
  const last = splitTopLevel(text, open + 1, close).pop()!;
  const [, lb] = trimRange(text, last[0], last[1]);
  let out = text;
  if (text.slice(lb, lb + 1) !== ',') out = text.slice(0, lb) + ',' + text.slice(lb);
  const close2 = matchBracket(out, open);
  return out.slice(0, close2) + `\n      { ${body} },` + out.slice(close2);
}

export function deleteEntry(text: string, name: string, index: number): string {
  const region = readArray(text, name);
  const entry = region?.entries[index];
  if (!region || !entry) throw new Error(`${name} 的第 ${index} 项不存在`);
  if (region.entries.length === 1) {
    // 只剩这一项：整个数组收成 []
    return text.slice(0, region.open) + '[]' + text.slice(region.close + 1);
  }
  // 连同它前面/后面的空白和逗号一起删，末尾多一个逗号在 TS 里无妨
  let from = entry.start;
  while (from > region.open && /\s/.test(text[from - 1])) from -= 1;
  let to = entry.end + 1;
  if (text[to] === ',') to += 1;
  return text.slice(0, from) + text.slice(to);
}

export function insertString(text: string, name: string, valueLiteral: string): string {
  const region = readArray(text, name);
  if (!region) throw new Error(`找不到数组 ${name}`);
  if (region.entries.length === 0) {
    const inner = text.slice(region.open + 1, region.close);
    if (!inner.trim()) return text.slice(0, region.open) + `[\n    ${valueLiteral},\n  ]` + text.slice(region.close + 1);
  }
  const last = splitTopLevel(text, region.open + 1, region.close).pop();
  if (!last) throw new Error(`${name} 解析失败`);
  const [, lb] = trimRange(text, last[0], last[1]);
  let out = text;
  if (out.slice(lb, lb + 1) !== ',') out = out.slice(0, lb) + ',' + out.slice(lb);
  const close2 = readArray(out, name)!.close;
  return out.slice(0, close2) + `\n    ${valueLiteral},` + out.slice(close2);
}

export function setString(text: string, name: string, index: number, valueLiteral: string): string {
  const region = readArray(text, name);
  if (!region) throw new Error(`找不到数组 ${name}`);
  const part = splitTopLevel(text, region.open + 1, region.close)[index];
  if (!part) throw new Error(`${name} 的第 ${index} 项不存在`);
  const [a, b] = trimRange(text, part[0], part[1]);
  return text.slice(0, a) + valueLiteral + text.slice(b);
}

export function deleteString(text: string, name: string, index: number): string {
  const region = readArray(text, name);
  if (!region) throw new Error(`找不到数组 ${name}`);
  const part = splitTopLevel(text, region.open + 1, region.close)[index];
  if (!part) throw new Error(`${name} 的第 ${index} 项不存在`);
  let from = part[0];
  while (from > region.open && /\s/.test(text[from - 1])) from -= 1;
  let to = part[1];
  if (text[to] === ',') to += 1;
  return text.slice(0, from) + text.slice(to);
}

/** 去掉两边的引号（不处理转义，够用：这些值是给人看的标签/链接） */
export function unquote(raw: string): string {
  const v = raw.trim();
  if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
    return v.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  }
  return v;
}

/** 值写成 TS 字符串字面量 */
export function tsString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ')}'`;
}

/** 解析某个对象字段里的嵌套数组，比如装备每组的 items */
export function readNestedArray(text: string, name: string, index: number, key: string): Region | null {
  const region = readArray(text, name);
  const entry = region?.entries[index];
  if (!region || !entry) return null;
  const field = entry.fields.get(key);
  if (!field) return null;
  const open = text.indexOf('[', field.start);
  if (open < 0 || open > field.end) return null;
  const close = matchBracket(text, open);
  const entries: Entry[] = [];
  for (const [a, b] of splitTopLevel(text, open + 1, close)) {
    const [ea] = trimRange(text, a, b);
    if (text[ea] !== '{') continue;
    const inner = matchBracket(text, ea);
    entries.push({ start: ea, end: inner, fields: parseFields(text, ea, inner) });
  }
  return { open, close, entries };
}

export function setNestedEntryField(
  text: string,
  name: string,
  index: number,
  key: string,
  itemIndex: number,
  fieldKey: string,
  valueLiteral: string,
): string {
  const nested = readNestedArray(text, name, index, key);
  const item = nested?.entries[itemIndex];
  if (!nested || !item) throw new Error(`${name} 第 ${index} 组的第 ${itemIndex} 件不存在`);
  const field = item.fields.get(fieldKey);
  if (!field) {
    const last = [...item.fields.values()].sort((a, b) => b.end - a.end)[0];
    const at = last ? last.end : item.start + 1;
    return text.slice(0, at) + `, ${fieldKey}: ${valueLiteral}` + text.slice(at);
  }
  return text.slice(0, field.start) + valueLiteral + text.slice(field.end);
}

export function deleteNestedEntry(text: string, name: string, index: number, key: string, itemIndex: number): string {
  const nested = readNestedArray(text, name, index, key);
  const item = nested?.entries[itemIndex];
  if (!nested || !item) throw new Error(`${name} 第 ${index} 组的第 ${itemIndex} 件不存在`);
  if (nested.entries.length === 1) {
    return text.slice(0, nested.open) + '[]' + text.slice(nested.close + 1);
  }
  let from = item.start;
  while (from > nested.open && /\s/.test(text[from - 1])) from -= 1;
  let to = item.end + 1;
  if (text[to] === ',') to += 1;
  return text.slice(0, from) + text.slice(to);
}

/** 字符串数组每一项的字符位置，用来「在文件里定位」 */
export function stringOffsets(text: string, name: string): Array<{ start: number; end: number }> {
  const region = readArray(text, name);
  if (!region) return [];
  return splitTopLevel(text, region.open + 1, region.close).map(([a, b]) => {
    const [sa, sb] = trimRange(text, a, b);
    return { start: sa, end: sb };
  });
}
