import { describe, expect, it } from 'vitest';
import { check, parseFile, walk, type Line } from './parse';

const MD = `## 一周目

### D01-S001｜封筒が、届く
**旅・日・星**：一周目
**本文**
〔動画 1〕〔封の丸い印が、ひとりでに光る〕
（ナレーション）宛名はない。
［選択肢：封を開く→open ／ あとで開く→hold］
（hold）
（ナレーション）封筒は光りつづける。
（open）
〔招待状〕
君に見せたい宇宙がある。
{inviter}
KIMORIN（小声で）「やった。」
〔扉が開く〕KIMORIN「待ってたケン！」〔腕を組む〕「……遅刻、してないケン。」
［選択肢：本部へ向かう→D01-S002 ／ 今日はここで閉じる→hold2］
（hold2）（ナレーション）閉じても消えない。
〔到着の一枚絵：雲まで届く石の門〕
（架空の入力例）「波の音」
（nosongのとき）〔汽笛が鳴る〕
〔合流〕
**選択ごとの行き先／更新フラグ**：
- 本部へ→D01-S002。f_d01_open。RESUME@D01-S001
**設計注（本文に混ぜない）**：メモ

### D01-S002｜門
**本文**
MONBAN「誰だお前…」
→D01-S009
`;

describe('story reader', () => {
  const scenes = parseFile(MD, 'P01', 'P01/c01.md');
  it('finds the scenes, their routing, flags and resume point', () => {
    expect(scenes.map((s) => s.id)).toEqual(['D01-S001', 'D01-S002']);
    expect(scenes[0].flags).toEqual(['f_d01_open']);
    expect(scenes[0].resume).toBe('D01-S001');
    expect(scenes[0].next).toEqual(['D01-S002']);
  });

  it('turns lines into speech, narration, cards, pictures and choices with their branches', () => {
    const l = scenes[0].lines;
    expect(l[0]).toEqual({ k: 'video', id: '1' });
    expect(l[1]).toMatchObject({ k: 'dir' });
    expect(l[2]).toEqual({ k: 'narr', text: '宛名はない。' });
    expect(l[3]).toMatchObject({ k: 'choice', options: [{ label: '封を開く', to: 'open' }, { label: 'あとで開く', to: 'hold' }] });
    const open = l.find((x): x is Extract<Line, { k: 'branch' }> => x.k === 'branch' && x.key === 'open')!;
    expect(open.lines[0]).toEqual({ k: 'card', kind: '招待状', text: '君に見せたい宇宙がある。\n{inviter}' });
    expect(open.lines[1]).toEqual({ k: 'say', who: 'KIMORIN', text: 'やった。', act: '小声で' });
    expect(open.lines.slice(2, 6)).toEqual([
      { k: 'dir', text: '扉が開く' },
      { k: 'say', who: 'KIMORIN', text: '待ってたケン！' },
      { k: 'dir', text: '腕を組む' },
      { k: 'say', who: 'KIMORIN', text: '……遅刻、してないケン。' },
    ]);
    // the inner choice's branch, a still, an example (never shown) and a condition
    const all: Line[] = [];
    walk(l, (x) => all.push(x));
    expect(all.some((x) => x.k === 'branch' && x.key === 'hold2')).toBe(true);
    expect(all.find((x) => x.k === 'still')).toEqual({ k: 'still', id: 'D01-S001-1', desc: '雲まで届く石の門', arrival: true });
    expect(all.find((x) => x.k === 'example')).toMatchObject({ text: '「波の音」' });
    expect(all.find((x) => x.k === 'when')).toMatchObject({ cond: 'nosong' });
    expect(scenes[1].lines).toEqual([{ k: 'say', who: 'MONBAN', text: '誰だお前…' }, { k: 'goto', to: 'D01-S009' }]);
  });

  it('reports what leads nowhere and who is not in the cast yet', () => {
    const r = check(scenes, ['KIMORIN']);
    expect(r.issues.map((i) => i.msg)).toContain('行き先の場面 D01-S009 がない');
    expect([...r.unknownSpeakers.keys()]).toEqual(['MONBAN']);
    expect(r.stills).toHaveLength(1);
    expect(r.videos.has('1')).toBe(true);
  });
});

import { Story } from './runtime';

describe('story runtime', () => {
  const story = new Story(parseFile(MD, 'P01', 'P01/c01.md'));
  const o = { notes: false, states: [] };
  const run = (picks: number[]) => {
    let st = story.start();
    const seen: string[] = [];
    for (let n = 0; n < 40; n++) {
      const { st: s, shown } = story.next(st, o);
      st = s;
      if (shown.k === 'end') break;
      if (shown.k === 'choice') {
        const opt = shown.options[picks.shift() ?? 0];
        seen.push(`?${opt.label}`);
        st = story.choose(st, opt);
        continue;
      }
      seen.push(shown.k === 'say' ? `${shown.who}:${shown.text}` : shown.k === 'narr' ? `N:${shown.text}` : shown.k === 'sceneStart' ? `#${shown.scene.id}` : shown.k);
      st = story.advance(st);
    }
    return seen;
  };
  it('plays the chosen branch, skips the others, follows a scene jump', () => {
    const open = run([0, 0]);
    expect(open.slice(0, 5)).toEqual(['#D01-S001', 'video', 'N:宛名はない。', '?封を開く', 'card']);
    expect(open).not.toContain('N:封筒は光りつづける。');
    expect(open).toContain('?本部へ向かう');
    expect(open).toContain('#D01-S002');
    expect(open).toContain('MONBAN:誰だお前…');
  });
  it('a later branch key goes on with the lines after the branches', () => {
    const hold = run([1]);
    expect(hold).toContain('N:封筒は光りつづける。');
    expect(hold).not.toContain('card');
  });
});
