import type { APIRoute } from 'astro';
import { site } from '../site.config';

/** 纯静态输出，构建时生成 dist/robots.txt，里面带的域名跟着 astro.config 走 */
export const GET: APIRoute = ({ site: astroSite }) => {
  const base = (astroSite ?? new URL(site.url)).href.replace(/\/$/, '');
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap-index.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
