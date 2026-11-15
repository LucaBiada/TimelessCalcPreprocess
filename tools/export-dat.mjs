// Exports the game tables the generator needs from GGG's patch CDN into data/<version>/.
// Usage: node tools/export-dat.mjs <version> <patch>   e.g.  node tools/export-dat.mjs 3.30 3.30.0.2
// Latest patch: https://raw.githubusercontent.com/poe-tool-dev/latest-patch-version/main/latest.txt
// Column names match poe-dat-viewer's JSON export (_rid, UnknownN for unnamed columns), which the generator reads.
// shortcut: the CDN loader isn't in the package's public exports, so it's imported by path; recheck on pathofexile-dat upgrades.
import * as loaders from '../node_modules/pathofexile-dat/dist/cli/bundle-loaders.js';
import { exportAllRows } from '../node_modules/pathofexile-dat/dist/cli/export-tables.js';
import { readDatFile, getHeaderLength } from 'pathofexile-dat/dat.js';
import { SCHEMA_URL, SCHEMA_VERSION, ValidFor } from 'pathofexile-dat-schema';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const [version, patch] = process.argv.slice(2);
if (!version || !patch) {
  console.error('Usage: node tools/export-dat.mjs <version> <patch>');
  process.exit(1);
}
const outDir = path.resolve(import.meta.dirname, '..', 'data', version);
const cacheDir = path.resolve(import.meta.dirname, '..', '.dat-cache');

const TABLES = {
  AlternatePassiveSkills: 'alternatepassiveskills.json',
  AlternatePassiveAdditions: 'alternatepassiveadditions.json',
  Stats: 'stats.json',
};
const FILES = {
  'Metadata/StatDescriptions/stat_descriptions.csd': 'stat_descriptions.txt',
  'Metadata/StatDescriptions/passive_skill_stat_descriptions.csd': 'passive_skill_stat_descriptions.txt',
};

function headersFor(sch, datFile) {
  const headers = [];
  let offset = 0;
  sch.columns.forEach((column, i) => {
    const t = column.type;
    headers.push({
      name: column.name || `Unknown${i + 1}`,
      offset,
      type: {
        array: column.array,
        interval: column.interval,
        integer: t === 'u16' ? { unsigned: true, size: 2 }
          : t === 'u32' ? { unsigned: true, size: 4 }
          : t === 'i16' ? { unsigned: false, size: 2 }
          : (t === 'i32' || t === 'enumrow') ? { unsigned: false, size: 4 }
          : undefined,
        decimal: t === 'f32' ? { size: 4 } : undefined,
        string: t === 'string' ? {} : undefined,
        boolean: t === 'bool' ? {} : undefined,
        key: (t === 'row' || t === 'foreignrow') ? { foreign: t === 'foreignrow' } : undefined,
      },
    });
    offset += getHeaderLength(headers[headers.length - 1], datFile);
  });
  if (offset !== datFile.rowLength) {
    throw new Error(`Schema for ${sch.name} covers ${offset} bytes but rows are ${datFile.rowLength}: schema is out of date`);
  }
  return headers;
}

const schema = await (await fetch(SCHEMA_URL)).json();
if (schema.version !== SCHEMA_VERSION) throw new Error('dat-schema format changed: update pathofexile-dat');

console.log(`Loading bundle index for patch ${patch}...`);
const loader = await loaders.FileLoader.create(
  new loaders.CachingBundleLoader(await loaders.CdnBundleLoader.create(cacheDir, patch)),
);
await fs.mkdir(outDir, { recursive: true });

for (const [name, file] of Object.entries(TABLES)) {
  const sch = schema.tables.find((s) => s.name === name && (s.validFor & ValidFor.PoE1));
  if (!sch) throw new Error(`No schema for ${name}`);
  const datFile = readDatFile('.datc64', await loader.getFileContents(`Data/${name}.datc64`));
  const rows = exportAllRows(headersFor(sch, datFile), datFile)
    .map(({ _index, ...rest }) => ({ _rid: _index, ...rest }));
  await fs.writeFile(path.join(outDir, file), JSON.stringify(rows, null, 2));
  console.log(`${file}: ${rows.length} rows`);
}
for (const [src, file] of Object.entries(FILES)) {
  await fs.writeFile(path.join(outDir, file), await loader.getFileContents(src));
  console.log(`${file} written`);
}
