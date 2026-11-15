// Copies a generated version into the TimelessCalc app.
// Usage: node tools/sync-to-app.mjs <version> [appDir=../TimelessCalc] [gggExportDir]
// gggExportDir: an unpacked grindinggear/skilltree-export release; when given, the tree images are copied too.
import * as fs from 'node:fs';
import * as path from 'node:path';

const [version, appArg = '../TimelessCalc', gggDir] = process.argv.slice(2);
if (!version) {
  console.error('Usage: node tools/sync-to-app.mjs <version> [appDir] [gggExportDir]');
  process.exit(1);
}
const root = path.resolve(import.meta.dirname, '..');
const app = path.resolve(root, appArg);
const out = path.join(root, 'output', version);
const data = path.join(root, 'data', version);

function copy(from, to) {
  if (!fs.existsSync(from)) throw new Error(`Missing ${from}: run the generator steps first`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

if (!fs.existsSync(path.join(app, 'package.json'))) throw new Error(`No app found at ${app}`);

for (const f of ['tree.json', 'translation.json', 'jewelstats.json']) {
  copy(path.join(out, f), path.join(app, 'src/data', f));
}
// The in-browser seed analyzer runs the calculator on the raw tables.
for (const f of ['data.json', 'alternatepassiveadditions.json', 'alternatepassiveskills.json']) {
  copy(path.join(data, f), path.join(app, 'src/utils/Timeless/config', f));
}

const jewels = fs.readdirSync(out).filter((f) => f.endsWith('.jsonl.gz'));
if (jewels.length === 0) throw new Error(`No jewel files in ${out}: run "npm run jewels ${version}"`);
const jewelDir = path.join(app, 'public/data/jewels');
for (const f of fs.readdirSync(jewelDir).filter((f) => f.endsWith('.jsonl.gz'))) fs.rmSync(path.join(jewelDir, f));
for (const f of jewels) copy(path.join(out, f), path.join(jewelDir, f));

if (gggDir) {
  const images = ['frame-4.png', 'group-background-4.png', 'jewel-radius.png', 'mastery-4.png',
    'mastery-disabled-4.png', 'skills-4.jpg', 'skills-disabled-4.jpg'];
  for (const f of images) copy(path.join(gggDir, 'assets', f), path.join(app, 'public/assets', f));
}

console.log(`Synced ${version} into ${app}: 3 data files, 3 config files, ${jewels.length} jewel files${gggDir ? ', 7 images' : ''}`);
