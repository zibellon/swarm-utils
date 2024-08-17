const path = require('path');
const { build } = require('esbuild');
const esbuildPluginTsc = require('esbuild-plugin-tsc');
const { existsSync, rmSync } = require('fs');

const distPath = path.resolve(__dirname, 'dist');
if (existsSync(distPath)) {
  rmSync(distPath, {
    recursive: true,
  });
}

build({
  entryPoints: ['./src/index.ts'],
  bundle: true,
  minify: false,
  platform: 'node',
  outdir: 'dist',
  alias: {
    src: path.resolve(__dirname, 'src'),
  },
  plugins: [esbuildPluginTsc()],
  resolveExtensions: ['.ts', '.js'],
})
  .then((result) => {
    console.log('build ok', result);
  })
  .catch((error) => {
    console.log('Build error', JSON.stringify(error, null, 2));
  });
