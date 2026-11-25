import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIGURE_SLOTS, PLANET_FIGURE_BACKGROUND, PLANET_FIGURE_REFS, planetFigurePrompt, type PlanetFigureStyle } from './prompts/planetFigures';

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
});
