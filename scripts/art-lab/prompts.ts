/**
 * R17 picture comparison (client 2026-11-25: cheaper picture models): the four prompts the app really sends, written to
 * scripts/art-lab/prompts.json for runware_art_compare.py. Run again when a prompt changes:
 *   npx --yes tsx@4.19.2 scripts/art-lab/prompts.ts
 * The reference pictures: a fictional person painted for the tests (art/review/saturn/gen-tests/photos/p1.jpg), a
 * prepared Bati body (apps/api/assets/bati/moon-1.jpg) and the client's kororin style sheet (apps/api/assets/kororin-style.jpg).
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { batiRestylePrompt, kororinPicPrompt, neoFromPhotoPrompt, stickerArtPrompt, withAgeBand, withTouch } from '../../packages/ai/src/images';
import { spellFrom, spellPrompt } from '../../packages/shared/src/index';

const artSpell = spellFrom('art', '夜空を泳ぐクジラ、やさしい水彩、星がきらきら');
const cases = [
  {
    id: '1-art',
    use: 'ART_MODEL (jacketArt: an art piece from a spell)',
    prompt: stickerArtPrompt('夜空を泳ぐクジラ', spellPrompt('art', artSpell)),
    refs: [] as string[],
  },
  {
    id: '2-look',
    use: 'LOOK_MODEL (a member look from their photo, photo → anime)',
    prompt: withAgeBand(withTouch(neoFromPhotoPrompt({ animal: 'cat', color: 'blue', mood: 'calm', hobby: 'music' }, 0), 0), '15-24'),
    refs: ['art/review/saturn/gen-tests/photos/p1.jpg'],
  },
  {
    id: '3-bati',
    use: 'BATI_MODEL ({bati} dress-up, keeps the creature from its picture)',
    prompt: batiRestylePrompt('魔法使いの帽子とマントを着せて', 0, false, { seed: 'いちご', kind: 'food' }),
    refs: ['apps/api/assets/bati/moon-1.jpg'],
  },
  {
    id: '4-kororin',
    use: 'KORORIN_MODEL (a kororin design in the style of the reference characters)',
    prompt: kororinPicPrompt('星のかけらでできた、ねむそうなたこ焼き', false, 0),
    refs: ['apps/api/assets/kororin-style.jpg'],
  },
];
const out = resolve(__dirname, 'prompts.json');
writeFileSync(out, `${JSON.stringify(cases, null, 2)}\n`);
console.log(`${cases.length} prompts → ${out}`);
