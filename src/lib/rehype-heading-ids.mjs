/**
 * 给正文里的标题补 id，并在 h2 / h3 末尾挂一个 # 锚点。
 *
 * id 本该由 Astro 生成，但它那一步跑在用户插件之后，这里拿不到 id，所以按同一套规则
 * 自己算一遍（小写、空格转连字符、去掉标点、重名加 -1）。中文标题在这套规则下就等于
 * 原文，和 Astro 生成的对得上 —— 构建完有脚本逐个核对锚点和 id 是否一致。
 *
 * 单独一个文件、在 astro.config.mjs 里用路径引用：内容层跑在单独的 worker 里，
 * 配置里写函数会被序列化掉、传不过去，字符串路径才会被 worker 重新 import。
 */
export default function rehypeHeadingIds() {
  return (tree) => {
    const used = new Map();
    const slug = (raw) => {
      const base =
        raw
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\p{L}\p{N}\-_]/gu, '')
          .replace(/-{2,}/g, '-')
          .replace(/^-|-$/g, '') || 'section';
      const n = used.get(base) ?? 0;
      used.set(base, n + 1);
      return n === 0 ? base : `${base}-${n}`;
    };
    const textOf = (node) =>
      (node.children ?? []).map((c) => (c.type === 'text' ? c.value : textOf(c))).join('');

    const walk = (node) => {
      if (!Array.isArray(node.children)) return;
      for (const child of node.children) {
        const rank = /^h([1-6])$/.exec(child.tagName ?? '')?.[1];
        if (rank) {
          if (!child.properties?.id) {
            child.properties = { ...child.properties, id: slug(textOf(child)) };
          }
          if (rank === '2' || rank === '3') {
            child.children.push({
              type: 'element',
              tagName: 'a',
              properties: {
                href: `#${child.properties.id}`,
                className: ['anchor'],
                'aria-hidden': 'true',
                tabIndex: -1,
              },
              // 不放文字：render() 的 headings 会读标题里的文本，放个 # 会被带进目录
              children: [],
            });
          }
        }
        walk(child);
      }
    };
    walk(tree);
  };
}
