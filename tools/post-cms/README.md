# 笔记 CMS

一个只服务于这个博客仓库的 VS Code 扩展：在编辑器里新建笔记、改 frontmatter、发布/转草稿，
并把本地预览打开。没有运行时依赖，装一次就行。

## 装

    code --install-extension tools/post-cms/post-cms.vsix

或者 VS Code 里 `Ctrl/Cmd+Shift+P` → 「Extensions: Install from VSIX…」 → 选那个 `.vsix`。
装完左侧资源管理器里会多一个「笔记」面板。

## 面板里能干什么

- **新建文章**（面板标题栏的 ＋）：输标题 → 输摘要 → 确认文件名（中文标题会保留汉字，
  英文标题自动出 `hello-world` 这种）。新建的默认是 `draft: true`，也就是本地能看、线上不出现。
- 点条目打开源文件；条目右边的按钮依次是 **在浏览器里打开**（拼 `{siteUrl}/posts/<文件名>/`）、
  **发布 / 转回草稿**、**删除**（会弹确认框）。
- 右键条目：改分类、改标签（多选）、改系列、改发布日期 —— 候选值是从仓库里已有的笔记里收集的。
- 面板标题栏的 ▶ 是 **启动本地预览**，会在终端里跑 `pnpm dev`。

列表按「草稿 / 已发布」分组，组内按 `pubDate` 倒序。发布只是把 `draft` 改成 `false`，
真正上线还是 git push 之后 Cloudflare 重建。

## 设置

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `postCms.postsDir` | `src/content/posts` | 笔记目录，相对仓库根 |
| `postCms.siteUrl` | `http://localhost:4321` | 拼预览地址用 |
| `postCms.devCommand` | `pnpm dev` | 「启动本地预览」跑的命令 |
| `postCms.defaultCategory` | `日常` | 新建时的默认分类 |

## 它怎么改文件

frontmatter 走**按行替换**，不引 YAML 库：只认顶层 `key: value` 和 `key: [a, b]`，
改的时候只动目标那一行。注释、空行、你没见过的字段、正文、CRLF 换行全都原样留着——
就算以后 frontmatter 里加了新字段，这个扩展也不会把它抹掉（有测试盯着）。

值里含 `: `、` #` 或以特殊符号开头时会自动加单引号，读回来还是原文。

## 开发

    cd tools/post-cms
    pnpm install --ignore-workspace   # 只装构建用的 esbuild/typescript/vsce，运行时不依赖
    pnpm build     # 出 out/extension.js（CJS，扩展本体）和 out/posts.mjs（给测试用）
    pnpm check     # tsc 类型检查
    pnpm test      # node --test：逻辑层 + 拿 mock 跑 activate，核对命令/视图/菜单是否对得上
    pnpm package   # 出 post-cms.vsix

`tools/post-cms` 不在仓库的 pnpm workspace 里（`pnpm-workspace.yaml` 只有 `.`），
所以它的依赖不会进主站的安装和 Cloudflare 构建。
