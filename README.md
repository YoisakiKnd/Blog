# 天音铃 · 个人页 + 博客

一个用 Astro 写的极简个人主页和笔记站。黑白灰三色，没有强调色、没有卡片阴影、没有客户端 JavaScript。

## 跑起来

```bash
pnpm install
pnpm dev      # http://localhost:4321
pnpm build    # 输出到 dist/，纯静态文件，丢到任何地方都能跑
```

## 体积

`pnpm build` 之后整站 276 KB（大头是 18 份 HTML），其中：

| 项 | 大小 |
| --- | --- |
| HTML（18 个页面） | ~90 KB |
| CSS（全站共用） | 7.7 KB |
| CSS（只有个人页要） | 4.7 KB |
| 头像 `avatar.webp` | 6.7 KB |
| 分享图 `og.png` | 30 KB |
| JavaScript | **0** |

没有 webfont：标题用系统宋体、正文用系统黑体，中文站点用 webfont 一个子集就是几百 KB，
这笔开销直接省掉。顶栏、图标、分页全部是 HTML + CSS，没有一行脚本。

个人页上是外链引用 —— 技术栈徽章走 shields.io，两张数据卡走 github-readme-stats 和
streak-stats，底部波浪走 capsule-render，一共约 30 个 `<img>`。这些都不进 dist，但也意味着
首屏要多发 30 个请求、并且依赖那几家的服务；不想要就把 `site.config.ts` 里的 `stack`、
`assets.stats`、`assets.wave` 删掉。

## 改内容

| 想改什么 | 改哪里 |
| --- | --- |
| 名字、GitHub、域名、每页篇数 | `src/site.config.ts` |
| README 框里的标题、副标题、链接行 | `src/site.config.ts` 的 `handle` / `tagline` / `links` |
| 技术栈徽章（分三行，照 GitHub 上那个分组） | `src/site.config.ts` 的 `stack`，每项是名字 + 底色 + logo |
| 两张数据卡、底部波浪图 | `src/site.config.ts` 的 `assets`，里面是完整外链，改 `theme` 就换配色 |
| 头像、左栏信息行、「正在做的事」 | `src/site.config.ts` 的 `avatar` / `facts` / `doing` |
| 波浪图上面那句话 | `src/site.config.ts` 的 `signoff` |
| 写新文章 | 在 `src/content/posts/` 里加一个 `.md` |
| 颜色、字体、正文排版 | `src/styles/global.css` |

个人页上半部分是按 GitHub profile 的版面排的，顺序和 `YoisakiKnd/YoisakiKnd` 那份 README 一致：
标题 → 副标题 → 链接行 → 三行徽章 → 两张数据卡 → 底部波浪。README 框标题栏右边那个铅笔
只是照 GitHub 的样子放的装饰，点了不做任何事（想让它真能跳去编辑页面，把 `Profile.astro`
里的 `span.rm-edit` 换成 `<a href="{site.github}/{site.repo}/edit/main/{site.readme}">` 即可）。

滚动时有三层东西钉住：**顶栏**、**「笔记」那条标题条**（整幅宽的一条，钉在顶栏下面）、
**左边整栏卡片**（钉在标题条下面）。

三层挂在同一根容器底线上，所以列表快到底时左栏一定会先被容器顶出去、从标题条底下
滑过去。「钉住」的时间等于正文列高 − 左栏高；什么时候被顶出去则只跟网格下面还剩多高
有关（`= 页脚高度 + 视口高度 − 容器底线`），页脚留白收得紧就是为了把它推出视口之外。

**现在站上只有一篇笔记，这一整块还轮不到它出场**：1440×900 与 800 两个高度实测笔记页
只有 610px 高、根本滚不动（左栏 228px、右栏 364px）。等笔记多起来它才会开始工作，
下面是 5 篇示例内容时的量法，留着当参考：整幅宽标题条在 1440×760 / 800 / 900 / 1080
四个高度、以 20px 步长扫全程，压到左栏 0 次；左栏钉住行程 = 正文列高 − 左栏高
（示例 5 篇时 865 − 459 = 406px）。

四处和那份 README 不一样，都是有意改的：

- 两张数据卡用 `theme=graywhite`（浅色），原 README 是 `tokyonight`（深色），压在白底上太重
- 波浪图去掉了 `text` 参数：原图那行白字压在浅色渐变上几乎看不见，改成页面上的一行真字
- 「成就」和「组织」两栏没做，左栏换成「正在做的事」
- 「关注者 / 关注中」那行、「写封邮件」按钮、邮箱和 ty0.icu 两行都删了：GitHub 以外没有
  关注者这种关系，邮箱也不必挂在公开页面上，链接在右边的 README 框里已经有一份

文章头部字段：

```yaml
---
title: 标题
description: 列表里显示的一句话
pubDate: 2026-09-27
category: 折腾
tags: ['Astro', '建站']
draft: false      # true 就不发布
series: 建站      # 可选：同系列的文章会自动串成一个列表
---
```

## 页面

- `/` 个人页，下滑就是笔记列表
- `/notes/` 全部笔记（文章超过 8 篇会自动分页成 `/notes/2/`）
- `/categories/`、`/categories/<分类>/` 分类索引与分类下的笔记
- `/tags/`、`/tags/<标签>/` 标签索引与带该标签的笔记
- `/posts/<文件名>/` 文章页（字数 / 阅读时间、右侧目录、标题锚点、相关文章、上下篇）
- `/archive/` 全部笔记按年月排开
- `/projects/`、`/now/`、`/about/` 项目、现在在做什么、关于我和这个站
- `/stats/` 站点统计（篇数、字数、分类标签数、按月分布）
- `/friends/`、`/gear/`、`/shelf/` 友链、装备、书架（数据留好了，内容是空的）
- `/robots.txt`、`/og.png` 抓取规则和分享卡片图
- `/404.html` 找不到的地址（Cloudflare 的静态资源会自动拿它当 404 页）
- `/rss.xml`、`/sitemap-index.xml`

## 文章页上的几个小东西

- **字数 / 阅读时间**：构建时从正文里数出来（汉字按字、英文按词，代码块和链接地址不算），
  按 350 字/分钟估，页面上不跑脚本。
- **目录**：用 `render()` 给的 `headings` 生成，宽度够就钉在正文右侧，窄屏收起来。
- **标题锚点**：`h2` / `h3` 末尾那个 `#` 是构建时挂上去的，插件在
  `src/lib/rehype-heading-ids.mjs`。它顺带做了 id（Astro 自己那一步跑在用户插件之后，
  在插件里拿不到 id），规则和 Astro 一致：小写、空格转连字符、去标点、重名加 `-1`。
  锚点是空链接，`#` 用 CSS 伪元素画——因为 `render()` 的 `headings` 会读标题里的文本，
  塞个真 `#` 进去会把目录也弄脏。
- **相关文章**：先按共享标签排，一个都没共享时退到同分类。
- **系列**：frontmatter 里写 `series: 建站`，同一系列的文章会自动串成一个列表，
  上下篇也改成在系列内走。

> 改了这个 rehype 插件之后，记得删掉 `node_modules/.astro/`（内容层缓存，渲染结果存在那儿，
> 不清的话老文章的正文不会重新渲染，插件看着就像没生效）。另外它必须用**路径字符串**引用：
> 内容层跑在单独的 worker 里，配置里写成函数会被序列化掉、传不过去。

## 用 VS Code 写

仓库里带了个小扩展 `tools/post-cms/`：资源管理器里多一个「笔记」面板，草稿/已发布分组，
能新建文章、改分类标签系列日期、一键发布或转回草稿、打开本地预览，全部只动 frontmatter、
不碰正文。装法：

    code --install-extension tools/post-cms/post-cms.vsix

（VSIX 是 `cd tools/post-cms && pnpm install --ignore-workspace && pnpm package` 打出来的，
也可以让 VS Code 从 VSIX 装。）细节和开发命令见 `tools/post-cms/README.md`。

## 数据在哪改

`src/site.config.ts` 一个文件全包：`projects`（项目）、`friends`（友链）、`gear`（装备）、
`shelf`（书架）、`now.updated`（现在页的日期），加上原来的 `facts` / `doing` / `stack` 等。
`friends` / `gear` / `shelf` 现在是空数组，对应页面显示空状态，填上就有内容；不想要这几页
就把 `src/pages/` 下对应的目录删掉，再删 `Base.astro` 页脚里那个链接。

## 上线前记得改

- `astro.config.mjs` 里的 `site` 换成自己的域名（影响 RSS、sitemap 和 canonical）
- `src/site.config.ts` 里的 GitHub 账号（现在是 `YoisakiKnd`，三处外链都跟着它走）、域名
- `src/content/posts/` 里那篇示例文章（把站点从 Fuwari 换成 Astro）—— 内容是我按你的
  身份写的占位文字，里面的经历和数字请替换或删掉
- 数据卡和徽章是外链图，会随对方服务实时更新；服务挂了就是空白，所以 `alt` 里都写了说明

## 部署

纯静态，丢哪都能跑。这台机器上走的是 **Cloudflare Workers**（不是 Pages）：构建命令
`pnpm build`、部署命令 `npx wrangler deploy`、产物目录 `dist`，Node 20 以上（它那边给的是 24）。

两个坑记一下：

1. **`wrangler.jsonc` 里不能写 `main`。** 这个站是纯静态，没有 Worker 脚本；老站用
   `@astrojs/cloudflare` 适配器时会生成 `dist/_worker.js`，这里没有。配置里只写
   `assets.directory`（= `./dist`），wrangler 会把这些文件当静态资源传上去。少了 `main`
   时 wrangler 会去猜框架、试图跑 `astro add cloudflare`，最后报
   `The entry-point file at "dist/_worker.js/index.js" was not found` 让部署失败。
   本地可以用 `npx wrangler deploy --dry-run` 验配置，它会打印读到了多少个资源文件。
2. **`pnpm-workspace.yaml` 不能删、也不能少 `packages:` 字段。** pnpm 10 只要看见这个文件
   就要求有 `packages`，缺了直接报 `ERROR packages field missing or empty`，构建挂在这一步
   （Cloudflare 上是 pnpm 10，本地是 12，表现不一样，所以本地测不出来）。同一个文件里
   `allowBuilds`（pnpm 11/12 认）和 `onlyBuiltDependencies`（pnpm 10 认）都写着——两个版本
   叫法不同，写全了 esbuild 的安装脚本才不会被拦下来。

## 关于头像

用的是你给的那张 Gravatar：抓下来缩到 256×256 存成 `public/avatar.webp`（6.7 KB，
显示尺寸 120px，2 倍够清楚）。直连那个地址也行，但 `gravatar.loli.net` 不认 `s` 参数，
`?s=512`、`?s=256`、`?s=128` 返回的都是同一张 512×512、198 KB 的图 —— 一张头像占的
带宽比全站 CSS 加起来还多，所以放本地。

换了 Gravatar 头像之后重新抓一次：

```bash
curl -s "https://gravatar.loli.net/avatar/a6ce8e009afd299c1e2279eb5055ab58?s=512" -o /tmp/av.png
python3 -c "from PIL import Image; Image.open('/tmp/av.png').convert('RGB').resize((256,256), Image.LANCZOS).save('public/avatar.webp','WEBP',quality=80,method=6)"
pnpm build
```

想直连就改 `src/site.config.ts` 的 `avatar`，换成那个完整地址，别的都不用动。

## 许可

代码用 MIT（见 `LICENSE`）——随便拿去改、拿去用。但 `src/content/posts/` 里的文章内容是我自己写的，版权归本人，转载前说一声。
