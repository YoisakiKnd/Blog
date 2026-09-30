/**
 * 站点与个人信息，全部集中在这里，改这一个文件就能换成你自己的。
 */
const githubUser = 'YoisakiKnd';

export const site = {
  name: '天音铃',
  /** README 框里的主标题，和 GitHub profile 上那个大标题一致 */
  handle: 'TY_Ling · YoisakiKnd',
  tagline: '在校学生 · 喜欢瞎折腾 · 偶尔写点能用的东西',
  description: '天音铃的个人主页与笔记。',
  url: 'https://hyw.mom',
  /**
   * 头像。这里指向本地那份 256px WebP（6.7 KB）；想直连 Gravatar 就换成
   * https://gravatar.loli.net/avatar/a6ce8e009afd299c1e2279eb5055ab58?s=512（那张 512 的是 198 KB）
   */
  avatar: '/avatar.webp',
  githubUser,
  github: `https://github.com/${githubUser}`,
  /** README 框标题栏上的仓库名和文件名；右边那个铅笔只是照 GitHub 的样子放的装饰，点了不做任何事 */
  repo: githubUser,
  readme: 'README.md',
  /** 侧栏站点卡里的一句话 */
  /** 文章列表每页条数 */
  perPage: 8,
  /** 底部波浪图上面的那句话 */
  signoff: '感谢路过 ★',
};

/** README 框里那行链接，顺序和 GitHub 上一样 */
export const links = [
  { label: '博客', href: 'https://ty0.icu' },
  { label: 'hyw.mom', href: 'https://hyw.mom' },
  { label: 'GitHub', href: site.github },
];

/** 左栏信息行 */
export const facts = [
  { icon: 'building', text: '@CongMiaoFactory' },
  { icon: 'pin', text: '中国' },
  { icon: 'clock', text: 'UTC+08:00' },
];

/** 正在折腾的事 */
export const doing = [
  '用 Rust 写一些自己用得上的小工具',
  '把笔记从各家平台搬回自己的域名',
  '整理这套图床、RSS 与备份的流程',
];

/**
 * 技术栈徽章，直接用 shields.io 的图，名字后面跟的是底色、logo 名和 logo 颜色。
 * 分三行只为保留 GitHub 上那个分组，宽度不够时仍会自动折行。
 */
export const stack = [
  [
    { name: 'Rust', color: '000000', logo: 'rust', logoColor: 'white' },
    { name: 'Zig', color: 'F7A41D', logo: 'zig', logoColor: 'white' },
    { name: 'C++', color: '00599C', logo: 'cplusplus', logoColor: 'white' },
    { name: 'C#', color: '239120', logo: 'csharp', logoColor: 'white' },
    { name: 'Java', color: 'ED8B00', logo: 'openjdk', logoColor: 'white' },
    { name: 'Kotlin', color: '7F52FF', logo: 'kotlin', logoColor: 'white' },
    { name: 'Go', color: '00ADD8', logo: 'go', logoColor: 'white' },
    { name: 'Python', color: '3776AB', logo: 'python', logoColor: 'white' },
    { name: 'Lua', color: '2C2D72', logo: 'lua', logoColor: 'white' },
    { name: 'Lisp', color: '3FB68B', logo: 'commonlisp', logoColor: 'white' },
    { name: 'PHP', color: '777BB4', logo: 'php', logoColor: 'white' },
    { name: 'Dart', color: '0175C2', logo: 'dart', logoColor: 'white' },
    { name: 'JavaScript', color: 'F7DF1E', logo: 'javascript', logoColor: 'black' },
    { name: 'TypeScript', color: '3178C6', logo: 'typescript', logoColor: 'white' },
    { name: 'Shell', color: '4EAA25', logo: 'gnubash', logoColor: 'white' },
    { name: 'PowerShell', color: '5391FE', logo: 'powershell', logoColor: 'white' },
    { name: 'SQL', color: '4479A1', logo: 'mysql', logoColor: 'white' },
    { name: 'Nix', color: '5277C3', logo: 'nixos', logoColor: 'white' },
    { name: 'Markdown', color: '000000', logo: 'markdown', logoColor: 'white' },
    { name: 'LaTeX', color: '008080', logo: 'latex', logoColor: 'white' },
  ],
  [
    { name: 'HTML', color: 'E34F26', logo: 'html5', logoColor: 'white' },
    { name: 'CSS', color: '1572B6', logo: 'css', logoColor: 'white' },
    { name: 'Vue', color: '4FC08D', logo: 'vuedotjs', logoColor: 'white' },
    { name: 'React', color: '61DAFB', logo: 'react', logoColor: 'black' },
    { name: 'Svelte', color: 'FF3E00', logo: 'svelte', logoColor: 'white' },
    { name: 'Astro', color: 'BC52EE', logo: 'astro', logoColor: 'white' },
  ],
  [{ name: '.NET', color: '512BD4', logo: 'dotnet', logoColor: 'white' }],
];

/** 正文里引用的那几个外面服务 */
export const assets = {
  /** 两张数据卡：github-readme-stats 和 streak-stats，想换配色改 theme */
  stats: [
    {
      alt: `${githubUser} 的 GitHub 数据`,
      src: `https://github-readme-stats.zohan.tech/api?username=${githubUser}&show_icons=true&count_private=true&theme=graywhite`,
    },
    {
      alt: `${githubUser} 的连续记录`,
      src: `https://github-readme-streak-stats.herokuapp.com/?user=${githubUser}&theme=graywhite&mode=weekly`,
    },
  ],
  /** 底部那条波浪。原图自带一行白字，压在浅色渐变上几乎看不见，所以这里不带 text 参数，文字用页面上的真字 */
  wave: 'https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=12,14,20&height=100&section=footer',
};