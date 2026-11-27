import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIGURE_SLOTS, PLANET_FIGURE_BACKGROUND, PLANET_FIGURE_PROMPT_VERSION, PLANET_FIGURE_REFS, planetFigurePrompt, type PlanetFigureStyle } from './prompts/planetFigures';

const lab = JSON.parse(readFileSync(resolve(__dirname, '../../../scripts/art-lab/planet_avatar_prompts.json'), 'utf8')) as { styles: { id: string; prompt: string; style_refs: string[] }[] };
const LAB_ID: Record<PlanetFigureStyle, string> = {
  saturnChibi: 'saturn-chibi',
  saturnBall: 'saturn-ball',
  jupiter: 'jupiter-butterfly',
  mercury: 'mercury-ship',
  mars: 'mars-ufo',
  venus: 'venus-dj',
  uranus: 'uranus-balloons',
  pluto: 'pluto-book',
  neptune: 'neptune-bubble',
};
const fill = (p: string) => p.replace('{pattern}', FIGURE_SLOTS.pattern).replace('{accessory}', FIGURE_SLOTS.accessory).replace('{top}', FIGURE_SLOTS.top);

describe('client 2026-11-25: the planet figures are the lab prompts (scripts/art-lab/planet_avatar_prompts.json)', () => {
  for (const [style, id] of Object.entries(LAB_ID) as [PlanetFigureStyle, string][]) {
    it(`${style} = ${id}`, () => {
      const l = lab.styles.find((s) => s.id === id)!;
      const want = fill(l.prompt);
      const got = planetFigurePrompt(style, 'pure magenta (#FF00FF)', 'magenta');
      expect(PLANET_FIGURE_REFS[style]).toBe(l.style_refs[0] ?? 'none');
      if (PLANET_FIGURE_BACKGROUND[style] === 'white') expect(got).toBe(want);
      else {
        // the same words, on the key colour chosen for the look instead of the lab's green
        const body = want.split(/Plain solid bright chroma-key green/)[0].replace(' (no green)', ' (no magenta)');
        expect(got.startsWith(body)).toBe(true);
        expect(got).toContain('pure magenta (#FF00FF) background');
      }
    });
  }
  it('the Saturn chibi is the 2D anime chibi2 (M-R275), not the 3D vinyl figure', () => {
    const p = planetFigurePrompt('saturnChibi');
    expect(p).toContain('flat 2D Japanese anime illustration');
    expect(p).toContain('Not 3D, not a figure, not a render');
    expect(p).not.toMatch(/vinyl|studio lighting/);
  });
  it('M-R328: the Mars UFO has no light under the saucer (prompt version 2); the touch and the pattern are as before', () => {
    const p = planetFigurePrompt('mars');
    expect(p).not.toMatch(/projector beam|glowing under/);
    expect(p).toContain('No light beam, no glow and no sparkles under the saucer; the bottom of the saucer has a clean outline.');
    expect(p).toContain("riding a small cute round flying saucer UFO whose colours and patterns are designed from the character's outfit");
    expect(p).toContain('soft hand-drawn kawaii chibi illustration');
    expect(PLANET_FIGURE_PROMPT_VERSION.mars).toBe(2);
  });
  it('M-R326: a figure normally on white can be asked on the key colour (the cut-out\'s retry); a key-coloured one is the same', () => {
    const white = planetFigurePrompt('mars');
    const keyed = planetFigurePrompt('mars', 'pure magenta (#FF00FF)', 'magenta', undefined, true);
    expect(white).toContain('Plain solid pure white background');
    expect(keyed).not.toContain('pure white background');
    expect(keyed).toContain('pure magenta (#FF00FF) background');
    expect(keyed).toContain('nothing on the character or its vehicle is magenta');
    expect(keyed.split(' On a perfectly flat')[0]).toBe(white.split(' Plain solid pure white')[0]);
    expect(planetFigurePrompt('jupiter', 'pure magenta (#FF00FF)', 'magenta', undefined, true)).toBe(planetFigurePrompt('jupiter', 'pure magenta (#FF00FF)', 'magenta'));
  });
});
