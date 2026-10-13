/**
 * The story script reader (client decision 2026-10-12): the story chat writes the whole story as
 * Markdown (docs/story-rewrite/…/Pxx/cxx.md, the notation in docs/handoff/story-script-format.md);
 * this turns it into scenes the player can run, and lists everything that does not fit yet
 * (unknown speakers, choices that lead nowhere, pictures still to paint, screens still to build).
 *
 * Plain functions, no I/O — scripts/story-import.ts reads the files, tests feed strings.
 */

export type Line =
  /** a character line (one 「…」); `act` = the stage note right before it (〔…〕 between name and 「) */
  | { k: 'say'; who: string; text: string; act?: string }
  | { k: 'narr'; text: string }
  /** a stage direction for the screen (shown as a note in the preview; the real look comes from pictures / motions) */
  | { k: 'dir'; text: string }
  | { k: 'video'; id: string }
  /** a still picture to paint (〔一枚絵：…〕 / 〔到着の一枚絵：…〕): `id` is made from the scene */
  | { k: 'still'; id: string; desc: string; arrival: boolean }
  | { k: 'bg'; id: string }
  /** a sound effect (〔SE：…〕 — the text is the order for the sound) */
  | { k: 'se'; text: string }
  /** background music: 〔BGM：name〕 starts it (the same name is the same tune), 〔BGM止め〕 stops it (name null) */
  | { k: 'bgm'; name: string | null }
  /** an app screen (〔画面：…〕), a making flow (〔制作：…〕), an input (〔入力：…〕), a button (〔ボタン：…〕) */
  | { k: 'ui'; kind: 'screen' | 'make' | 'input' | 'button' | 'confirm' | 'done'; text: string; feature: string }
  /** a paper / sign / letter shown as a card: 〔札〕〔招待状〕〔手紙〕… with its text */
  | { k: 'card'; kind: string; text: string }
  | { k: 'choice'; id: string; focus: boolean; options: { label: string; to: string | null }[] }
  /** what one option of a choice leads to (（key）…) */
  | { k: 'branch'; choice: string; key: string; lines: Line[] }
  /** shown only in some case: （nosongのとき）, （mana_low）, （パス） … */
  | { k: 'when'; cond: string; lines: Line[] }
  /** an example answer for the writer (（架空の入力例）): never shown */
  | { k: 'example'; text: string }
  | { k: 'goto'; to: string }
  | { k: 'merge' }
  | { k: 'stop' }
  /** anything the reader could not place (listed in the report) */
  | { k: 'text'; text: string };

export interface Scene {
  id: string;
  title: string;
  part: string;
  file: string;
  lines: Line[];
  /** the 「選択ごとの行き先…」 paragraph, kept as written, and what could be read from it */
  routing: string;
  flags: string[];
  resume: string | null;
  next: string[];
}

export interface Issue {
  scene: string;
  level: 'error' | 'warn';
  msg: string;
}

const SCENE_HEAD = /^###\s+([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-S\d+[a-z]?)\s*[｜|]\s*(.*)$/;
export const SCENE_ID = /\b([A-Z]\d{2}-S\d{3}[a-z]?|L\d-[A-Z]+-S\d{3}[a-z]?)\b/;

/** 〔…〕 / 「…」 aware split of a line into its pieces, in order. */
function pieces(s: string): { t: 'br' | 'q' | 'txt'; v: string }[] {
  const out: { t: 'br' | 'q' | 'txt'; v: string }[] = [];
  let i = 0;
  let buf = '';
  const flush = () => {
    if (buf.trim()) out.push({ t: 'txt', v: buf.trim() });
    buf = '';
  };
  while (i < s.length) {
    const c = s[i];
    const close = c === '〔' ? '〕' : c === '「' ? '」' : null;
    if (close) {
      // nested 「」 inside 「」 (quotes in a line) are kept by depth counting
      let depth = 0;
      let j = i;
      for (; j < s.length; j++) {
        if (s[j] === c) depth++;
        else if (s[j] === close && --depth === 0) break;
      }
      flush();
      out.push({ t: c === '〔' ? 'br' : 'q', v: s.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    buf += c;
    i++;
  }
  flush();
  return out;
}

const CARD_KINDS = /^(札|招待状|手紙|紙|貼り紙|掲示板|帳面|便り|メモ|看板|手紙（[^）]*）)$/;

/** 〔画面：曲づくり｜…〕 — the part before ｜ names the feature (docs/handoff/story-script-format.md 4.) */
function ui(kind: Extract<Line, { k: 'ui' }>['kind'], raw: string): Line {
  const text = raw.trim();
  const head = text.split(/[｜|]/)[0].trim();
  return { k: 'ui', kind, text, feature: head.length <= 16 ? head : '' };
}

/** One 〔…〕 → a line. */
function bracket(v: string, scene: string, n: { still: number }): Line {
  const t = v.trim();
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^動画\s*([0-9０-９A-Za-z][0-9０-９A-Za-z\-ー－]*)/))) return { k: 'video', id: m[1].replace(/[０-９]/g, (d) => String('０１２３４５６７８９'.indexOf(d))).replace(/[ー－]/g, '-') };
  if ((m = t.match(/^(到着の)?一枚絵[：:](.*)$/s))) return { k: 'still', id: `${scene}-${++n.still}`, desc: m[2].trim(), arrival: !!m[1] };
  if ((m = t.match(/^背景[\s：:]+([A-Za-z0-9_\-]+)/))) return { k: 'bg', id: m[1] };
  if ((m = t.match(/^(?:SE|ＳＥ|効果音)[：:](.*)$/s))) return { k: 'se', text: m[1].trim() };
  if (/^(?:BGM|ＢＧＭ)\s*(?:を)?(?:止め|停止|とめ|消)/.test(t)) return { k: 'bgm', name: null };
  if ((m = t.match(/^(?:BGM|ＢＧＭ)[：:](.*)$/s))) return { k: 'bgm', name: m[1].trim() };
  if ((m = t.match(/^画面[：:](.*)$/s))) return ui('screen', m[1]);
  if ((m = t.match(/^制作[：:](.*)$/s))) return ui('make', m[1]);
  if ((m = t.match(/^入力[：:](.*)$/s))) return ui('input', m[1]);
  if ((m = t.match(/^ボタン[：:](.*)$/s))) return ui('button', m[1]);
  if ((m = t.match(/^確認画面[：:]?(.*)$/s))) return ui('confirm', m[1]);
  if ((m = t.match(/^完了画面[：:]?(.*)$/s))) return ui('done', m[1]);
  if (/^(合流|共通の締め|2つとも合流|どちらも)/.test(t)) return { k: 'merge' };
  if (/^(おわり|終了)/.test(t)) return { k: 'stop' };
  if (CARD_KINDS.test(t)) return { k: 'card', kind: t, text: '' };
  return { k: 'dir', text: t };
}


/** One body line → lines (a line can hold several 〔〕 and 「」). */
function lineOf(raw: string, scene: string, n: { still: number; choice: number }): Line[] {
  const s = raw.trim();
  if (!s) return [];
  let m: RegExpMatchArray | null;
  // choice
  if ((m = s.match(/^［選択肢(（焦点）)?[：:](.*)］\s*$/))) {
    const options = m[2].split(/[／]/).map((o) => {
      const [label, to] = o.split('→');
      return { label: label.trim(), to: to ? to.trim().replace(/へ$/, '') : null };
    });
    return [{ k: 'choice', id: `${scene}#c${++n.choice}`, focus: !!m[1], options }];
  }
  if (/^［/.test(s)) return [{ k: 'dir', text: s.replace(/^［|］$/g, '') }];
  // narration
  if ((m = s.match(/^（ナレーション）(.*)$/))) return [{ k: 'narr', text: m[1].trim() }, ...arrow(m[1])];
  if ((m = s.match(/^（架空の入力例）(.*)$/))) return [{ k: 'example', text: m[1].trim() }];
  // everything else: names, 「lines」, 〔notes〕 and text in any order
  //   KIMORIN「…」〔…〕「…」 / 〔…〕たこ焼きシスター「…」 / バティ（丸の中から）「…」 / KIMORIN〔口をふさぐ〕
  const out: Line[] = [];
  const ps = pieces(s);
  let who: string | null = null;
  let act: string | undefined;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.t === 'txt') {
      const name = p.v.match(/^(.*?)([^\s（）〔［「」『』→。、！？＝：・／]{1,16})(?:（([^）]{1,30})）)?$/);
      const nextQ = ps[i + 1]?.t === 'q';
      const nextBr = ps[i + 1]?.t === 'br';
      if (name && (nextQ || (nextBr && i === 0 && !name[1]))) {
        if (name[1].trim()) out.push(...(arrow(name[1]).length ? arrow(name[1]) : [{ k: 'text' as const, text: name[1].trim() }]));
        who = name[2];
        act = name[3];
        continue;
      }
      who = null;
      out.push(...(arrow(p.v).length ? arrow(p.v) : [{ k: 'text' as const, text: p.v }]));
      continue;
    }
    if (p.t === 'q') {
      if (who) {
        out.push({ k: 'say', who, text: p.v.replace(/／/g, '\n'), ...(act ? { act } : {}) });
        act = undefined;
      } else out.push({ k: 'text', text: `「${p.v}」` });
      continue;
    }
    // 〔…〕: between a name and its first 「 it is how the line is said; else a line of its own
    if (who && ps[i + 1]?.t === 'q' && !out.length) {
      act = p.v;
      continue;
    }
    const l = bracket(p.v, scene, n);
    if (l.k === 'card' && ps[i + 1]?.t === 'txt') l.text = ps[++i].v;
    if (l.k === 'dir' && who && ps[i - 1]?.t === 'txt' && ps[i + 1]?.t !== 'q') l.text = `${who}：${l.text}`;
    out.push(l);
  }
  if (out.length) return out;
  if (s.startsWith('→') && arrow(s).length) return arrow(s);
  return [{ k: 'text', text: s }];
}

/** →D01-S002 / →終了 / →enterへ at the end of a piece. */
function arrow(s: string): Line[] {
  // →D01-S007へ（沈黙を…） / →D01-S003の「…」の選択へ: the scene is what counts
  const sc = s.match(new RegExp(`→\\s*${SCENE_ID.source}`));
  if (sc) return [{ k: 'goto', to: sc[1] }];
  const m = s.match(/→\s*([^\s。、／]+?)(?:へ)?[。]?\s*$/);
  if (!m) return [];
  const to = m[1];
  if (/^(終了|おわり)$/.test(to)) return [{ k: 'stop' }];
  if (/^(合流)/.test(to)) return [{ k: 'merge' }];
  return [{ k: 'goto', to }];
}

/**
 * The body lines of one scene → a tree: a choice is followed by its branches (（key）…), which run
 * until the next key of the same choice, 〔合流〕, or the end of the scene; conditions and system cases
 * (（…のとき）, （mana_low）, （パス）) hold the lines on the same row.
 */
function tree(rows: string[], scene: string): Line[] {
  const n = { still: 0, choice: 0 };
  const root: Line[] = [];
  // the open choices (innermost last) and where the current lines go
  const stack: { choice: Extract<Line, { k: 'choice' }>; keys: Set<string>; target: Line[]; branch: Line[] | null }[] = [];
  const sink = () => (stack.length ? (stack[stack.length - 1].branch ?? stack[stack.length - 1].target) : root);
  for (const raw of rows) {
    const s = raw.trim();
    if (!s) continue;
    const lab = s.match(/^（([^）]{1,24})）(.*)$/);
    if (lab && lab[1] !== 'ナレーション' && lab[1] !== '架空の入力例') {
      const key = lab[1];
      // a key of an open choice (inner first): close the inner choices, start this branch
      const at = [...stack].reverse().findIndex((f) => f.keys.has(key));
      if (at >= 0) {
        const depth = stack.length - 1 - at;
        stack.length = depth + 1;
        const f = stack[depth];
        const b: Extract<Line, { k: 'branch' }> = { k: 'branch', choice: f.choice.id, key, lines: [] };
        f.target.push(b);
        f.branch = b.lines;
        b.lines.push(...lineOf(lab[2], scene, n));
        continue;
      }
      if (key === '合流') {
        if (stack.length) stack.pop();
        sink().push({ k: 'merge' });
        continue;
      }
      // a condition on this row only
      sink().push({ k: 'when', cond: key.replace(/のとき$/, ''), lines: lineOf(lab[2], scene, n) });
      continue;
    }
    const ls = lineOf(s, scene, n);
    for (const l of ls) {
      if (l.k === 'merge' && stack.length) {
        stack.pop();
        sink().push(l);
        continue;
      }
      sink().push(l);
      if (l.k === 'choice') {
        const keys = new Set(l.options.map((o) => o.to).filter((t): t is string => !!t && !SCENE_ID.test(t)));
        stack.push({ choice: l, keys, target: sink(), branch: null });
      }
    }
    // a card's text on the following plain lines (〔招待状〕 + the letter)
  }
  return foldCards(root);
}

/** Plain text lines right after a card become the card's text. */
function foldCards(lines: Line[]): Line[] {
  const out: Line[] = [];
  for (const l of lines) {
    const prev = out[out.length - 1];
    if (l.k === 'text' && prev?.k === 'card') {
      prev.text = prev.text ? `${prev.text}\n${l.text}` : l.text;
      continue;
    }
    if (l.k === 'branch' || l.k === 'when') l.lines = foldCards(l.lines);
    out.push(l);
  }
  return out;
}

/** All scenes of one Markdown file. */
export function parseFile(md: string, part: string, file: string): Scene[] {
  const scenes: Scene[] = [];
  const rows = md.split(/\r?\n/);
  let cur: { id: string; title: string; rows: string[] } | null = null;
  const finish = () => {
    if (!cur) return;
    const body: string[] = [];
    let routing = '';
    let mode: 'meta' | 'body' | 'routing' | 'after' = 'meta';
    for (const r of cur.rows) {
      if (/^\*\*本文\*\*/.test(r)) {
        mode = 'body';
        continue;
      }
      if (/^\*\*選択ごとの行き先/.test(r)) {
        mode = 'routing';
        routing += r.replace(/^\*\*[^*]*\*\*[：:]?/, '') + '\n';
        continue;
      }
      if (/^\*\*(この場面だけ|設計注)/.test(r)) {
        mode = 'after';
        continue;
      }
      if (mode === 'body') body.push(r);
      else if (mode === 'routing') routing += r + '\n';
    }
    const flags = [...new Set(routing.match(/\bf_[a-z0-9_]+/g) ?? [])];
    const resume = routing.match(/RESUME@([A-Z0-9\-]+)/)?.[1] ?? null;
    const next = [...new Set((routing.match(new RegExp(SCENE_ID.source, 'g')) ?? []).filter((x) => x !== cur!.id))];
    scenes.push({ id: cur.id, title: cur.title, part, file, lines: tree(body, cur.id), routing: routing.trim(), flags, resume, next });
    cur = null;
  };
  for (const r of rows) {
    const m = r.match(SCENE_HEAD);
    if (m) {
      finish();
      cur = { id: m[1], title: m[2].trim(), rows: [] };
      continue;
    }
    if (/^##\s/.test(r) && cur) finish();
    if (cur) cur.rows.push(r);
  }
  finish();
  return scenes;
}

/** Everything that walks the tree. */
export function walk(lines: Line[], fn: (l: Line) => void) {
  for (const l of lines) {
    fn(l);
    if (l.k === 'branch' || l.k === 'when') walk(l.lines, fn);
  }
}

/** Problems a writer can fix, and lists of what is still to be made. */
export function check(scenes: Scene[], speakers: string[]): { issues: Issue[]; unknownSpeakers: Map<string, number>; stills: { scene: string; id: string; desc: string; arrival: boolean }[]; screens: { scene: string; kind: string; text: string; feature: string }[]; videos: Set<string>; vars: Map<string, number>; sounds: Map<string, string[]>; music: Map<string, string[]>; backgrounds: Map<string, string[]> } {
  const ids = new Set(scenes.map((s) => s.id));
  const issues: Issue[] = [];
  const unknownSpeakers = new Map<string, number>();
  const stills: { scene: string; id: string; desc: string; arrival: boolean }[] = [];
  const screens: { scene: string; kind: string; text: string; feature: string }[] = [];
  const videos = new Set<string>();
  const vars = new Map<string, number>();
  // sound effects / tunes / backgrounds → the scenes that use them
  const sounds = new Map<string, string[]>();
  const music = new Map<string, string[]>();
  const backgrounds = new Map<string, string[]>();
  const use = (m: Map<string, string[]>, k: string, scene: string) => m.set(k, [...new Set([...(m.get(k) ?? []), scene])]);
  const known = new Set(speakers);
  const seen = new Set<string>();
  for (const s of scenes) {
    if (seen.has(s.id)) issues.push({ scene: s.id, level: 'error', msg: `場面IDが重複: ${s.id}` });
    seen.add(s.id);
    if (!s.lines.length) issues.push({ scene: s.id, level: 'error', msg: '本文がない（**本文** の見出しがない？）' });
    const branchKeys = new Set<string>();
    walk(s.lines, (l) => l.k === 'branch' && branchKeys.add(l.key));
    const prefix = s.id.replace(/S\d+[a-z]?$/, '');
    const resolve = (to: string) => (/^S\d{3}/.test(to) ? `${prefix}${to}` : to);
    walk(s.lines, (l) => {
      const text = 'text' in l ? String(l.text) : '';
      for (const v of text.match(/\{[a-z_]+\}/g) ?? []) vars.set(v, (vars.get(v) ?? 0) + 1);
      if (l.k === 'say' && !known.has(l.who) && !/^\{[a-z]+\}$/.test(l.who)) unknownSpeakers.set(l.who, (unknownSpeakers.get(l.who) ?? 0) + 1);
      if (l.k === 'still') stills.push({ scene: s.id, id: l.id, desc: l.desc, arrival: l.arrival });
      if (l.k === 'ui') screens.push({ scene: s.id, kind: l.kind, text: l.text, feature: l.feature });
      if (l.k === 'video') videos.add(l.id);
      if (l.k === 'se') use(sounds, l.text, s.id);
      if (l.k === 'bgm' && l.name) use(music, l.name, s.id);
      if (l.k === 'bg') use(backgrounds, l.id, s.id);
      if (l.k === 'choice') {
        // a choice where no option has → just goes on whichever is picked (fine); a mix is suspicious
        const some = l.options.some((o) => o.to);
        for (const o of l.options) {
          if (!o.to) {
            if (some) issues.push({ scene: s.id, level: 'warn', msg: `選択肢「${o.label}」だけ行き先（→）がない` });
          }
          else if (SCENE_ID.test(resolve(o.to))) {
            if (!ids.has(resolve(o.to).match(SCENE_ID)![1])) issues.push({ scene: s.id, level: 'error', msg: `選択肢「${o.label}」の行き先の場面 ${o.to} がない` });
          } else if (!branchKeys.has(o.to) && !/^(合流|保存|終了|劇場)/.test(o.to)) issues.push({ scene: s.id, level: 'warn', msg: `選択肢「${o.label}」の行き先「${o.to}」の枝（（${o.to}）…）が見つからない` });
        }
      }
      if (l.k === 'goto') {
        const to = resolve(l.to);
        if (SCENE_ID.test(to) && !ids.has(to.match(SCENE_ID)![1])) issues.push({ scene: s.id, level: 'error', msg: `行き先の場面 ${l.to} がない` });
      }
      if (l.k === 'text' && !/^[—―…─-]+$/.test(l.text)) issues.push({ scene: s.id, level: 'warn', msg: `読み取れない行: ${l.text.slice(0, 50)}` });
    });
    for (const nx of s.next) if (!ids.has(nx)) issues.push({ scene: s.id, level: 'warn', msg: `行き先に書かれた場面 ${nx} がない` });
  }
  return { issues, unknownSpeakers, stills, screens, videos, vars, sounds, music, backgrounds };
}
