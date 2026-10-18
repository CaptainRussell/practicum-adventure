const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'vendor', 'dice');
fs.mkdirSync(out, { recursive: true });
esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'dice-renderer.js')],
  outfile: path.join(out, 'dice.js'), bundle: true, minify: true,
  format: 'iife', globalName: 'PracticumDice', target: 'es2020', legalComments: 'eof'
});
for (const [pkg, file] of [
  ['@3d-dice/dice-box-threejs', 'LICENSE'], ['three', 'LICENSE'], ['cannon-es', 'LICENSE']
]) {
  fs.copyFileSync(path.join(root, 'node_modules', pkg, file), path.join(out, pkg.replaceAll('/', '-') + '-LICENSE.txt'));
}
