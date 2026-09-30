import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

/** 已发布的文章，按时间倒序 */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** 2026-09-20 这样的短日期 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 统计分类：按篇数倒序 */
export function countCategories(posts: Post[]) {
  const map = new Map<string, number>();
  for (const p of posts) map.set(p.data.category, (map.get(p.data.category) ?? 0) + 1);
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));
}

/** 统计标签：按篇数倒序 */
export function countTags(posts: Post[]) {
  const map = new Map<string, number>();
  for (const p of posts) for (const t of p.data.tags) map.set(t, (map.get(t) ?? 0) + 1);
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));
}
/** 正文字数：汉字按字算、英文按词算；代码块和链接地址不算 */
export function wordCount(post: Post): number {
  const body = (post as unknown as { body?: string }).body ?? '';
  if (!body) return 0;
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_|\-]/g, ' ');
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const latin = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) ?? []).length;
  return cjk + latin;
}

/** 按中文阅读速度 350 字/分钟估，最少 1 分钟 */
export function readingMinutes(count: number): number {
  return Math.max(1, Math.round(count / 350));
}

/** 相关文章：按共享标签数排序，同数的新文章优先 */
export function relatedPosts(post: Post, all: Post[], limit = 3): Post[] {
  const mine = new Set(post.data.tags);
  const byTag = all
    .filter((p) => p.id !== post.id)
    .map((p) => ({ post: p, shared: p.data.tags.filter((t) => mine.has(t)).length }))
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.shared - a.shared || b.post.data.pubDate.valueOf() - a.post.data.pubDate.valueOf())
    .map((x) => x.post);
  if (byTag.length > 0) return byTag.slice(0, limit);
  // 一篇都没共享标签时退到同分类，不然这一块在标签比较散的站上永远是空的
  return all
    .filter((p) => p.id !== post.id && p.data.category === post.data.category)
    .slice(0, limit);
}

/** 同一个系列里的其他文章，按时间从早到晚 */
export function seriesPosts(post: Post, all: Post[]): Post[] {
  if (!post.data.series) return [];
  return all
    .filter((p) => p.data.series === post.data.series)
    .sort((a, b) => a.data.pubDate.valueOf() - b.data.pubDate.valueOf());
}

export interface MonthGroup {
  /** 2026-09 */
  key: string;
  label: string;
  posts: Post[];
}

/** 按年月分组，新的在前 */
export function groupByMonth(posts: Post[]): MonthGroup[] {
  const map = new Map<string, Post[]>();
  for (const p of posts) {
    const key = formatDate(p.data.pubDate).slice(0, 7);
    const list = map.get(key);
    if (list) list.push(p);
    else map.set(key, [p]);
  }
  return [...map.entries()]
    .map(([key, list]) => ({ key, label: `${key.slice(0, 4)} 年 ${Number(key.slice(5))} 月`, posts: list }))
    .sort((a, b) => (a.key < b.key ? 1 : -1));
}

/** 站点统计，构建期算出来，页面上不跑任何脚本 */
export function siteStats(posts: Post[]) {
  const words = posts.reduce((n, p) => n + wordCount(p), 0);
  const months = groupByMonth(posts);
  const byCount = [...months].sort((a, b) => b.posts.length - a.posts.length)[0];
  const year = new Date().getFullYear();
  return {
    posts: posts.length,
    words,
    avg: posts.length ? Math.round(words / posts.length) : 0,
    categories: countCategories(posts).length,
    tags: countTags(posts).length,
    months: months.length,
    busiest: byCount ? `${byCount.label}（${byCount.posts.length} 篇）` : '—',
    thisYear: posts.filter((p) => p.data.pubDate.getFullYear() === year).length,
    first: posts.length ? formatDate(posts[posts.length - 1].data.pubDate) : '—',
    latest: posts.length ? formatDate(posts[0].data.pubDate) : '—',
    grouped: months,
  };
}
