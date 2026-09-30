---
title: 把站点从 Fuwari 换成 Astro
description: 旧站点主题太重了，索性自己写一个：没有框架、没有客户端 JS、没有 webfont，整站只有一个 CSS 文件。
pubDate: 2026-09-27
category: 折腾
tags: ['Astro', '建站', '性能']
---

之前用的是一个现成的博客主题，功能很全，但页面里塞了相当多的 CSS 和脚本，只想写几行字的时候，会觉得不太值。

于是花了两个晚上重写了一遍，目标只有三条：

- 首屏不加载任何 JavaScript
- 不下载任何字体文件，正文直接吃系统字体
- 所有样式加起来不超过一个文件的量

## 为什么是 Astro

Astro 默认输出纯静态 HTML，`output: 'static'` 之后整站就是一堆 `.html` 加一个 `.css`，没有 hydration、没有 island、没有运行时。对于一个只用来读的文章站来说，这就是最合适的形态。

文章放在 `src/content/posts/` 下，写成 Markdown，靠 content collection 收集：

```ts
const posts = await getCollection('posts', ({ data }) => !data.draft);
return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
```

标题用宋体、正文用黑体，都是从系统字体里挑的，所以体积是 0。中文网页如果用 webfont，一个子集动不动就是几百 KB，这笔账不划算。

## 现在的样子

版面只剩黑白两级灰：白纸、黑字、两个层级的灰，加上几条 1px 的分隔线。没有强调色，也没有卡片阴影，层次的区分全靠字号、字重和留白。

以后再想加东西之前，先问一句：这一行会不会让首屏多出一次请求。