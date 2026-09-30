# 笔记 CMS

一个只服务于这个博客仓库的 VS Code 扩展：左边活动栏里一个自己的图标，两个面板——**笔记**和
**页面数据**。点一下就能改，不用先跳到文件里再手动编辑。没有运行时依赖，装一次就行。

## 装

从 [Releases](../../../../releases) 下最新的 `post-cms-*.vsix`：

    code --install-extension post-cms-0.3.0.vsix

或者在 VS Code 里 `Ctrl/Cmd+Shift+P` → 「Extensions: Install from VSIX…」→ 选那个文件。
也可以自己打一个：

    cd tools/post-cms
    pnpm install --ignore-workspace
    pnpm package     # 出 post-cms.vsix

装完左边活动栏（资源管理器、搜索、源代码管理…那一列）会多一个图标，点开就是这两个面板。

## 笔记面板

- **新建文章**（面板标题栏的 ＋）：输标题 → 输摘要 → 确认文件名（中文标题保留汉字，英文标题
  自动出 `hello-world` 这种）。默认 `draft: true`，也就是本地能看、线上不出现。
- 点条目**打开源文件**（正文就在那里写）；行右边的按钮依次是 **在浏览器里打开**
  （拼 `{siteUrl}/posts/<文件名>/`）、**发布 / 转回草稿**、**删除**（会弹确认框）。
- 右键「**改这篇的内容**」：列出现在所有的元信息（标题、摘要、分类、标签、系列、日期、状态），
  选一项就地改完，直接写回 frontmatter。单项也可以从右键菜单里直接点：改分类、改标签（多选）、
  改系列、改发布日期——候选值从仓库里已有的笔记里收集。
- 面板标题栏的 ▶ 是**启动本地预览**，会在终端里跑 `pnpm dev`。

列表按「草稿 / 已发布」分组，组内按 `pubDate` 倒序。发布只是把 `draft` 改成 `false`，
真正上线还是得 git push、等 Cloudflare 重建。

## 页面数据面板（项目 / 友链 / 装备 / 书架 / 现在）

管 `site.config.ts` 里那几个数组，**点一下就是编辑**：

- 顶层五项：项目、友链、装备、书架、现在，后面跟着条数（空的写「空」）
- 展开某一项 → 里面每一条 → 再展开是每个字段（带当前值）；「现在」下面是「更新日期」和「正在做的事」
- **点条目** → 弹出「改哪个字段」，列出每个字段的当前值，选一个填新值就写回文件；
  「装备」这类带分组的，点里面那一件也一样
- **点字段行** → 直接改这一个字段（固定取值的走下拉，非必填留空就不写进文件）
- 行上的按钮：**＋ 加一项**（装备的分组上按 ＋ 是加一件装备，「正在做的事」上按 ＋ 是加一条）、
  **✎ 改内容**、**删掉这一项**（弹确认框）、**在浏览器里打开这个页面**
- 想手动改也行：右键「**在 site.config.ts 里定位**」跳到对应那一行

它改的是 TypeScript 源码，做法和 frontmatter 一样保守：只认括号、字符串、注释的边界，
只替换命中的那一小段，其余字节一个不动（`href: site.github` 这种表达式、注释、别的数组都不会被碰）。
解析不引 TypeScript 编译器（那会把扩展从 50 KB 撑到几 MB），是自己扫的。
测试里每改一次都会用 esbuild 重新解析一遍产物，确认语法没坏；还做过一次真机验收——
用这套东西改真实的 `site.config.ts`，再跑站点构建，`/friends/`、`/gear/`、`/shelf/`、`/now/`
上确实渲染出了新加的内容。

## 设置

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `postCms.postsDir` | `src/content/posts` | 笔记目录，相对仓库根 |
| `postCms.configFile` | `src/site.config.ts` | 数据页所在的配置文件 |
| `postCms.siteUrl` | `http://localhost:4321` | 拼预览地址用 |
| `postCms.devCommand` | `pnpm dev` | 「启动本地预览」跑的命令 |
| `postCms.defaultCategory` | `日常` | 新建时的默认分类 |

## 它怎么改文件

frontmatter 走**按行替换**，不引 YAML 库：只认顶层 `key: value` 和 `key: [a, b]`，
改的时候只动目标那一行。注释、空行、你没见过的字段、正文、CRLF 换行全都原样留着——
就算以后 frontmatter 里加了新字段，这个扩展也不会把它抹掉（有测试盯着）。

值里含 `: `、` #` 或以特殊符号开头时会自动加单引号，读回来还是原文。

## 开发与发布

    cd tools/post-cms
    pnpm install --ignore-workspace   # 只装构建用的 esbuild/typescript/vsce，运行时不依赖
    pnpm build     # 出 out/extension.js（CJS，扩展本体）和 out/extension-with-mock.mjs（给测试用）
    pnpm check     # tsc 类型检查
    pnpm test      # node --test：逻辑层 + 拿 mock 跑 activate，核对命令/视图/菜单是否对得上
    pnpm package   # 出 post-cms.vsix

真机端到端（要先把 VS Code 解压到 /tmp/vscode）：

    xvfb-run -a /tmp/vscode/bin/code --no-sandbox --disable-gpu --disable-workspace-trust \
      --user-data-dir=/tmp/e2e-user --extensions-dir=/tmp/e2e-ext \
      --extensionDevelopmentPath="$PWD" --extensionTestsPath="$PWD/e2e/index.cjs" /tmp/e2e-ws

它用真的 VS Code 跑 activate()，检查命令注册、活动栏容器、改 frontmatter、打开文件、定位这几件事。
新版 VS Code 把扩展宿主的 `console.log` 写进自己的日志（`<user-data-dir>/logs/*/window1/exthost/exthost.log`），
命令行的标准输出可能是空的——没输出不代表失败，看那儿的 `[e2e]` 行和退出码。

发布不用把 `.vsix` 提交进仓库：打个 tag 就行了。`.github/workflows/extension-release.yml` 会
装依赖、跑类型检查和测试、打包，再把 `.vsix` 挂到 GitHub Release 上。

    git tag post-cms-v0.3.0 && git push origin post-cms-v0.3.0

`tools/post-cms` 不在仓库的 pnpm workspace 里（`pnpm-workspace.yaml` 只有 `.`），
所以它的依赖不会进主站的安装和 Cloudflare 构建。