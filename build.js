const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

const rootDir = __dirname;
const entry = path.join(rootDir, 'entry.js');
// Bundle into single root main.js for Obsidian
const outFile = path.join(rootDir, 'main.js');

(async () => {
  const common = {
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    target: ['es2020'],
    format: 'cjs',
    sourcemap: true,
    outfile: outFile,
    external: ['obsidian'],
    logLevel: 'info',
  };

  if (watch) {
    const ctx = await esbuild.context(common);
    await ctx.watch();
    console.log('[save history] watching...');
  } else {
    await esbuild.build(common);
    console.log('[save history] build done:', outFile);
  }
})();

