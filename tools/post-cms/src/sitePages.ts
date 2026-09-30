/** 数据页的定义：面板里显示什么、能改哪些字段 */
export interface FieldDef {
  key: string;
  label: string;
  /** 有 choices 就走下拉选择 */
  choices?: string[];
  /** 必填（新建时不允许留空） */
  required?: boolean;
}

export interface PageDef {
  id: string;
  label: string;
  /** 站点上的路径 */
  url: string;
  /** 数组名（site.config.ts 里的 export const） */
  array?: string;
  /** object = 对象数组；group = 每组下面还有 items；scalar = 标量+字符串数组（现在页） */
  kind: 'object' | 'group' | 'scalar';
  fields: FieldDef[];
  /** 标语用哪个字段 */
  primary: string;
  itemFields?: FieldDef[];
  scalar?: { object: string; key: string; label: string };
  strings?: { name: string; label: string };
}

export const PAGES: PageDef[] = [
  {
    id: 'projects',
    label: '项目',
    url: '/projects/',
    array: 'projects',
    kind: 'object',
    primary: 'name',
    fields: [
      { key: 'name', label: '名字', required: true },
      { key: 'desc', label: '一句话说明' },
      { key: 'href', label: '链接', required: true },
      { key: 'status', label: '状态', choices: ['在用', '弃坑', '偶尔用'] },
    ],
  },
  {
    id: 'friends',
    label: '友链',
    url: '/friends/',
    array: 'friends',
    kind: 'object',
    primary: 'name',
    fields: [
      { key: 'name', label: '站点名', required: true },
      { key: 'href', label: '链接', required: true },
      { key: 'desc', label: '一句话' },
    ],
  },
  {
    id: 'gear',
    label: '装备',
    url: '/gear/',
    array: 'gear',
    kind: 'group',
    primary: 'group',
    fields: [{ key: 'group', label: '分组', required: true }],
    itemFields: [
      { key: 'name', label: '名字', required: true },
      { key: 'note', label: '备注' },
    ],
  },
  {
    id: 'shelf',
    label: '书架',
    url: '/shelf/',
    array: 'shelf',
    kind: 'object',
    primary: 'title',
    fields: [
      { key: 'title', label: '书名', required: true },
      { key: 'author', label: '作者' },
      { key: 'note', label: '备注' },
      { key: 'state', label: '状态', choices: ['在读', '读完', '想读'], required: true },
    ],
  },
  {
    id: 'now',
    label: '现在',
    url: '/now/',
    kind: 'scalar',
    primary: 'updated',
    fields: [],
    scalar: { object: 'now', key: 'updated', label: '更新日期' },
    strings: { name: 'doing', label: '正在做的事' },
  },
];
