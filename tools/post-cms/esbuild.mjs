import * as fs from 'node:fs';
import * as path from 'node:path';
import { build } from 'esbuild';

fs.rmSync('out', { recursive: true, force: true });

const common = { bundle: true, platform: 'node', target: 'node18', logLevel: 'warning' };

await build({ ...common, entryPoints: ['src/extension.ts'], outfile: 'out/extension.js', format: 'cjs', external: ['vscode'] });
await build({ ...common, entryPoints: ['src/posts.ts'], outfile: 'out/posts.mjs', format: 'esm' });

// 测试版：把 vscode 换成 mock（esbuild 的 alias 只认包名，所以用插件来指路）
await build({
  ...common,
  entryPoints: ['src/extension.ts'],
  outfile: 'out/extension-with-mock.mjs',
  format: 'esm',
  plugins: [
    {
      name: 'vscode-mock',
      // external 的路径原样写进产物，所以这里按 out/ 的角度写相对路径：
      // 这样扩展和测试 import 到的是同一个模块实例，calls 里的记账才看得到
      setup(b) {
        b.onResolve({ filter: /^vscode$/ }, () => ({ path: '../test/vscode-mock.mjs', external: true }));
      },
    },
  ],
});
console.log('打包完成：out/extension.js、out/posts.mjs、out/extension-with-mock.mjs');
