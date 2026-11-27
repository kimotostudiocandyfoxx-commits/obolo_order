import { cutPicture } from './cutting';

/**
 * Cut a character out of its plain light background → a square transparent PNG of `out` px around it (3 % margin).
 * Since M-R325 this is the shared cut (media/cutting.ts cutPicture, media/cut.ts plainMatte): the background's colour is
 * measured on the border, the outside is flooded only through pixels very close to it that carry no outline (a white
 * body behind its outline stays), and enclosed gaps of the background go while highlights stay.
 * `noShadow`: the soft grey shadow the painter leaves under the feet goes too (the app draws its own; on a dark
 * stage it read as a white stain, story chat 2026-11-01).
 */
export async function cutoutWhite(input: Buffer, out = 512, _bg?: [number, number, number], noShadow = false): Promise<Buffer> {
  return (await cutPicture(input, out, 'plain', { noShadow })).png;
}
