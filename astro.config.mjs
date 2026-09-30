// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 站点地址：部署前改成自己的域名
export const SITE = 'https://hyw.mom';

export default defineConfig({
  site: SITE,
  // 输出纯静态 HTML，不注入任何客户端 JS
  output: 'static',
  build: {
    // 小体积内联，大体积走文件，避免多余请求
    inlineStylesheets: 'auto',
  },
  markdown: {
    // 代码高亮用浅色主题，配合黑白版面
    shikiConfig: { theme: 'github-light', wrap: true },
  },
  integrations: [sitemap()],
});