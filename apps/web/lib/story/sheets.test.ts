import { describe, expect, it } from 'vitest';
import { castSheets, idOf, placeSheets } from './sheets';
import { parseFile } from './parse';
import { Story } from './runtime';
import { formOf } from './voice';

describe('cast / place sheets', () => {
  it('reads one block per person, with design, look, voice and aliases', () => {
    const md = `# 人物表\n\n## エビ\n- デザイン：なし\n- 見た目：手のひらサイズの赤いエビ。\n  青いスカーフ。\n- 性格：せっかち\n- 声：高め、早口\n- 同じ姿でよい呼び方：エビたち、小エビ\n\n## KIMORIN\n- デザイン：あり\n`;
    const [ebi, kimorin] = castSheets(md);
    expect(ebi).toMatchObject({ name: 'エビ', designed: false, look: '手のひらサイズの赤いエビ。 青いスカーフ。', voice: '高め、早口', aliases: ['エビたち', '小エビ'] });
    expect(ebi.id).toMatch(/^c-[a-z0-9]+$/);
    expect(kimorin).toMatchObject({ name: 'KIMORIN', designed: true, id: 'kimorin' });
  });
  it('reads places, and ids stay the same for the same name', () => {
    const [p] = placeSheets(`## mercury-beach\n- 絵：なし\n- 見た目：白い砂の浜\n- 時間・光：夕方\n- 出てくる場面：L2-MERCURY-S001`);
    expect(p).toMatchObject({ id: 'mercury-beach', drawn: false, look: '白い砂の浜', light: '夕方' });
    expect(idOf('エビ')).toBe(idOf('エビ'));
    expect(idOf('エビ')).not.toBe(idOf('カニ'));
  });
});

describe('SE / BGM in the script', () => {
  const md = `### D01-S001｜音\n**本文**\n〔BGM：静かな夜の海〕\n〔SE：扉がきしんで開く〕KIMORIN「来たケン。」\n〔BGM止め〕\n（ナレーション）静か。\n`;
  const [scene] = parseFile(md, 'P01', 'P01/c01.md');
  it('reads them as their own lines', () => {
    expect(scene.lines.slice(0, 3)).toEqual([{ k: 'bgm', name: '静かな夜の海' }, { k: 'se', text: '扉がきしんで開く' }, { k: 'say', who: 'KIMORIN', text: '来たケン。' }]);
    expect(scene.lines[3]).toEqual({ k: 'bgm', name: null });
  });
  it('plays them without stopping the story: SE with the next line, BGM kept in the state', () => {
    const s = new Story([scene]);
    const o = { notes: false, states: [] };
    let r = s.next(s.start(), o); // the title
    r = s.next(s.advance(r.st), o);
    expect(r.shown).toMatchObject({ k: 'say', who: 'KIMORIN' });
    expect(r.se).toEqual(['扉がきしんで開く']);
    expect(r.st.bgm).toBe('静かな夜の海');
    r = s.next(s.advance(r.st), o);
    expect(r.shown).toMatchObject({ k: 'narr' });
    expect(r.st.bgm).toBeNull();
  });
});

describe('forms', () => {
  it('reads a form from how a line is said', () => {
    expect(formOf('第2形態')).toBe(2);
    expect(formOf('第３形態で')).toBe(3);
    expect(formOf('五の姿')).toBe(5);
    expect(formOf('小声で')).toBeNull();
  });
});
