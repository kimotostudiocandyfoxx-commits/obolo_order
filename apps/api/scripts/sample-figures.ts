/**
 * The sample cast's planet figures (apps/web/public/planets/sample/fig-<planet>-<who>.webp) made from the story
 * session's paintings with the production cut-out and its checks (M-R325 / M-R326; no provider is called: the shape
 * and vision checks are skipped). Cut, checked, trimmed to the figure and fitted in 220 px like the files they replace.
 *   npx tsx apps/api/scripts/sample-figures.ts <planet> <dir with p5-<planet>-<who>.jpg> [out dir]
 * A figure whose cut fails a check is NOT written (the file of before stays) and the run ends with an error.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PLANET_FIGURE_OF, isHomePlanet } from '@obolo/shared';
import sharp from 'sharp';
import { cutPicture, inspectCut } from '../src/media/cutting';

const SIDE = 220;

async function main() {
  const [planet, dir, out = resolve(__dirname, '../../web/public/planets/sample')] = process.argv.slice(2);
  if (!planet || !isHomePlanet(planet) || !dir) throw new Error('usage: sample-figures.ts <planet> <dir> [out dir]');
  const kind = PLANET_FIGURE_OF[planet];
  let bad = 0;
  for (const f of (await readdir(dir)).filter((x) => new RegExp(`^p5-${planet}-[a-z]+\\.jpg$`).test(x)).sort()) {
    const who = f.replace(`p5-${planet}-`, '').replace('.jpg', '');
    const cut = await cutPicture(await readFile(resolve(dir, f)), 768, 'plain', { bigHoles: planet === 'neptune' });
    const i = await inspectCut(cut, { background: 'plain', kind, soft: planet === 'neptune' });
    const line = `${f}\tkept ${(i.kept * 100).toFixed(1)}%\tfringe ${(i.fringe * 100).toFixed(1)}%\tholes removed ${cut.report.holesRemoved}`;
    if (i.failed.length) {
      bad++;
      console.log(`${line}\tFAIL: ${i.failed.join(', ')} — not written`);
      continue;
    }
    const webp = await sharp(cut.png).trim({ threshold: 0 }).resize(SIDE, SIDE, { fit: 'inside' }).webp({ quality: 88, effort: 6 }).toBuffer();
    const meta = await sharp(webp).metadata();
    await writeFile(resolve(out, `fig-${planet}-${who}.webp`), webp);
    console.log(`${line}\tPASS → fig-${planet}-${who}.webp ${meta.width}×${meta.height}`);
  }
  if (bad) process.exitCode = 1;
}
void main();
