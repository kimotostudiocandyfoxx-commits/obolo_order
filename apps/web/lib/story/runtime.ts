/**
 * Runs the imported scenes (parse.ts) one shown line at a time: choices play their branch and then
 * the common lines after it, conditions show only for what was chosen (or a state toggled in the
 * preview), →場面 jumps, a scene that ends goes on to the next one. Pure state → state, so the
 * preview can go back a step and save where it was.
 */
import { SCENE_ID, walk, type Line, type Scene } from './parse';

export interface Frame {
  /** where the lines are: the scene's own lines, or a path of indexes into branches / conditions */
  path: number[];
  i: number;
  /** the scene's title has been shown (its own frame only) */
  started?: boolean;
}

export interface RunState {
  scene: string;
  stack: Frame[];
  /** branch keys chosen so far (for （xxxのとき）) */
  chosen: string[];
  /** the last still / background put up, and who spoke last */
  picture: { kind: 'still' | 'bg' | 'video'; id: string; desc?: string } | null;
}

export interface Options {
  /** show 〔演出〕 notes as lines (the preview's switch) */
  notes: boolean;
  /** states for conditions that are not choices: mana_low, mana_ok, … */
  states: string[];
}

export type Shown = Exclude<Line, { k: 'branch' | 'when' | 'example' | 'merge' | 'goto' | 'bg' }> | { k: 'sceneStart'; scene: Scene } | { k: 'end' };

export class Story {
  readonly byId = new Map<string, Scene>();
  constructor(readonly scenes: Scene[]) {
    for (const s of scenes) this.byId.set(s.id, s);
  }

  start(scene = this.scenes[0]?.id): RunState {
    return { scene, stack: [{ path: [], i: -1 }], chosen: [], picture: null };
  }

  private lines(scene: Scene, path: number[]): Line[] {
    let ls = scene.lines;
    for (const p of path) {
      const l = ls[p];
      ls = l && (l.k === 'branch' || l.k === 'when') ? l.lines : [];
    }
    return ls;
  }

  /** The scene after this one: the only scene its routing names, else the next in story order. */
  private after(scene: Scene): string | null {
    if (scene.next.length === 1 && this.byId.has(scene.next[0])) return scene.next[0];
    const k = this.scenes.indexOf(scene);
    return this.scenes[k + 1]?.id ?? null;
  }

  private jump(st: RunState, to: string): RunState | null {
    const scene = this.byId.get(st.scene)!;
    const prefix = scene.id.replace(/S\d+[a-z]?$/, '');
    const id = /^S\d{3}/.test(to) ? `${prefix}${to}` : to;
    const m = id.match(SCENE_ID);
    if (m && this.byId.has(m[1])) return { ...st, scene: m[1], stack: [{ path: [], i: -1 }] };
    // →enterへ: a branch of this scene by its key
    let found: number[] | null = null;
    const find = (ls: Line[], path: number[]) => {
      ls.forEach((l, k) => {
        if (found) return;
        if (l.k === 'branch' && l.key === to) found = [...path, k];
        else if (l.k === 'branch' || l.k === 'when') find(l.lines, [...path, k]);
      });
    };
    find(scene.lines, []);
    if (found) return { ...st, stack: [...st.stack, { path: found, i: -1 }] };
    return null;
  }

  /** Move to the next line that is shown, and return it. */
  next(prev: RunState, o: Options): { st: RunState; shown: Shown } {
    let st: RunState = { ...prev, stack: prev.stack.map((f) => ({ ...f })) };
    for (let guard = 0; guard < 5000; guard++) {
      const scene = this.byId.get(st.scene);
      if (!scene) return { st, shown: { k: 'end' } };
      const top = st.stack[st.stack.length - 1];
      if (!top) {
        const nx = this.after(scene);
        if (!nx) return { st, shown: { k: 'end' } };
        st = { ...st, scene: nx, stack: [{ path: [], i: -1 }] };
        continue;
      }
      // a scene's first step announces it
      if (st.stack.length === 1 && top.path.length === 0 && !top.started) {
        top.started = true;
        top.i = -1; // advance() after the title moves to the first line
        return { st, shown: { k: 'sceneStart', scene } };
      }
      if (top.i === -1) top.i = 0;
      const ls = this.lines(scene, top.path);
      if (top.i >= ls.length) {
        st.stack.pop();
        // back in the parent: step past the branch / condition we were in
        const parent = st.stack[st.stack.length - 1];
        if (parent) parent.i++;
        continue;
      }
      const l = ls[top.i];
      switch (l.k) {
        case 'branch':
          // branches are entered by their choice only; in order they are skipped
          top.i++;
          continue;
        case 'when':
          if (st.chosen.includes(l.cond) || o.states.includes(l.cond)) {
            st.stack.push({ path: [...top.path, top.i], i: 0 });
          } else top.i++;
          continue;
        case 'example':
        case 'merge':
          top.i++;
          continue;
        case 'bg':
          st.picture = { kind: 'bg', id: l.id };
          top.i++;
          continue;
        case 'goto': {
          top.i++;
          const j = this.jump(st, l.to);
          if (j) st = j;
          continue;
        }
        case 'dir':
          if (!o.notes) {
            top.i++;
            continue;
          }
          break;
        case 'still':
          st.picture = { kind: 'still', id: l.id, desc: l.desc };
          break;
        case 'video':
          st.picture = { kind: 'video', id: l.id };
          break;
        default:
          break;
      }
      return { st, shown: l as Shown };
    }
    return { st, shown: { k: 'end' } };
  }

  /** After a shown line: step past it (then call next()). */
  advance(st: RunState): RunState {
    const stack = st.stack.map((f) => ({ ...f }));
    const top = stack[stack.length - 1];
    if (top) top.i++;
    return { ...st, stack };
  }

  /** Pick an option of the choice on screen. */
  choose(st: RunState, option: { to: string | null }): RunState {
    const scene = this.byId.get(st.scene)!;
    const top = st.stack[st.stack.length - 1];
    const ls = this.lines(scene, top.path);
    const choice = ls[top.i];
    let s = this.advance(st);
    if (!option.to || choice?.k !== 'choice') return s;
    s = { ...s, chosen: [...s.chosen, option.to] };
    // the branch for this option, among the lines after the choice
    const at = ls.findIndex((l, k) => k > top.i && l.k === 'branch' && l.choice === choice.id && l.key === option.to);
    if (at >= 0) return { ...s, stack: [...s.stack, { path: [...top.path, at], i: 0 }] };
    return this.jump(s, option.to) ?? s;
  }

  /** An answer on an input screen (声／文字／選択／パス): later （パス） lines follow it. */
  answer(st: RunState, key: string): RunState {
    return this.advance({ ...st, chosen: [...st.chosen, key] });
  }

  /** All scene ids with a title, for the scene list. */
  list() {
    return this.scenes.map((s) => ({ id: s.id, title: s.title, part: s.part }));
  }
}

/** How many lines a scene shows (for the list). */
export function sceneSize(s: Scene) {
  let n = 0;
  walk(s.lines, (l) => (l.k === 'say' || l.k === 'narr' ? n++ : 0));
  return n;
}
