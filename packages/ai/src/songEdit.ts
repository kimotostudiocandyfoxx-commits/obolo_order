/**
 * Mercury 手直し (client spec 2026-10-07): after a song is finished the member asks for changes in
 * the chat only (no waveform / editing UI). Gemini Flash-Lite is the "command tower": it answers
 * as the partner and, in the same JSON, picks one edit action with its parameters. The API then
 * re-uses everything it can (instrumental, one vocal file per lyric line) and regenerates only
 * what changed:
 *  - VOLUME_TEMPO_EDIT  whole-song speed, vocal / instrumental gain   → re-mix only (no AI cost)
 *  - LYRICS_EDIT        new words for some lines                      → Fish for those lines only
 *  - VOICE_REPLACE      lines sung by the other registered voice      → Fish for those lines only
 *  - TIMING_EDIT        vocal entry delay, silence after a line       → re-mix only (no AI cost)
 *  - GENRE_EDIT         a new instrumental with the same key / tempo  → ACE-Step only, vocal kept
 *  - SONG_EXTEND        2番 / 大サビ / ~2-minute version: new lines     → the longer song sung again
 *  - CHAT               a question / unclear request                  → answer only
 */
import { SongEditCommand, type SongEditAction, type SongMix, type SongPhrase } from '@obolo/shared';
import type { ComposePartner } from './song';
import { extractJson } from './song';

const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface SongEditContext {
  title: string;
  genre: string;
  bpm: number;
  keyRoot: number;
  scale: 'major' | 'minor';
  instrumentalPrompt: string;
  phrases: Pick<SongPhrase, 'index' | 'section' | 'text' | 'slot'>[];
  mix: SongMix;
  /** Bati's voice is registered (VOICE_REPLACE to "bati" is possible) */
  hasBatiVoice: boolean;
}

const SECTION_JA = { verse: 'Aメロ', chorus: 'サビ', bridge: 'Cメロ' } as const;

function persona(p: ComposePartner) {
  return p.isBati
    ? `あなたは「${p.name}」。ユーザーの相棒のバティ。明るくて素直。自然な話し言葉。`
    : 'あなたは「KIMORIN（キモリン）」。秘密結社 OBOLO ORDER の案内人。面倒見のいい兄貴分。語尾に「〜ケン」をよく付ける。';
}

/** The marker SONG_EDIT lets the offline mock / tests recognise the call. */
export function songEditSystem(p: ComposePartner, c: SongEditContext): string {
  const lines = c.phrases.map((ph) => `${ph.index}: [${SECTION_JA[ph.section]}・${ph.slot === 'bati' ? 'バティの声' : '自分の声'}] ${ph.text}`).join('\n');
  const gaps = c.mix.gaps.map((g, i) => (g > 0 ? `${i}の後に${g}秒` : '')).filter(Boolean).join('、') || 'なし';
  return `SONG_EDIT
${persona(p)}
水星で、ユーザーと一緒に作った曲「${c.title}」が完成している。ユーザーはチャットだけで曲の手直しを頼む。
あなたは返事をしながら、裏の音楽システムへの命令を1つだけ決める。
曲の情報:
- ジャンル ${c.genre} / BPM ${c.bpm} / キー ${KEY_NAMES[c.keyRoot % 12]} ${c.scale}
- 伴奏の指示: ${c.instrumentalPrompt}
- 今のミックス: 速さ ${c.mix.tempo}倍 / 歌の音量 ${c.mix.vocalDb}dB / 伴奏の音量 ${c.mix.bgmDb}dB / 歌い出しの遅れ ${c.mix.delayBeats}拍 / 行の後の間 ${gaps}
- 歌詞（番号: [パート・声] 歌詞）:
${lines}
- バティの声: ${c.hasBatiVoice ? '登録済み' : '未登録（VOICE_REPLACE で bati は使えない。登録してねと伝える）'}
命令（action）の選び方:
- VOLUME_TEMPO_EDIT: 曲全体の速さ・歌や伴奏の音量。"tempo" は今の速さに対する倍率（1.1 = 少し速く、0.9 = 少し遅く、変えないなら省略）。"vocal_volume_db" / "bgm_volume_db" は今からの増減（例 +2 / -1.5、変えないなら省略）。
- LYRICS_EDIT: 歌詞の変更。"edits": [{"index": 行番号, "text": "新しい歌詞（日本語、元の行と同じくらいの長さ、40文字以内）"}]。「サビを全部変えて」なら該当する行を全部。新しい歌詞はあなたが考えてよい。
- VOICE_REPLACE: 行を別の声で歌い直す。"indexes": [行番号…], "voice": "self"（自分の声）か "bati"（バティの声）。「声B」「叫び・エモい方」はバティの声のこと。
- TIMING_EDIT: タイミング。"delay_beats": 歌い出しを今から何拍遅らせるか（早めるならマイナス）。"gap_after": 行番号, "gap_seconds": その行の後の間の秒数（0 で間をなくす）。
- GENRE_EDIT: 歌詞と歌はそのままで伴奏だけ作り直す。"prompt": 新しい伴奏の英語の指示（genre, instruments, mood）。BPM とキーは変えられない（自動で今のものが付く）。"no vocals" を含める。
- SONG_EXTEND: 曲を長くする。今の歌詞はそのままで、後ろに新しいパートを足した長い版を歌い直す（1番の歌い方も少し変わる）。"kind" と "sections"（足すパートと新しい歌詞）を出す。
  - "second"（2番を作りたい）: [{"name":"verse","lines":[新しいAメロ4行]},{"name":"chorus","lines":[サビ4行。1番のサビを少し変えてもよい]}]
  - "bigchorus"（大サビ・Cメロ・ラスサビを作りたい）: [{"name":"bridge","lines":[盛り上がるCメロ2〜4行]},{"name":"chorus","lines":[ラストのサビ4行]}]
  - "long"（2分の曲にしたい・フルで聴きたい）: 2番と大サビの両方: verse, chorus, bridge, chorus の4つ。
  新しい歌詞はあなたが考える。1番の続きの物語にして、言葉の長さは1番の行とそろえる（各行40文字以内）。今の曲がもう長い（2番やCメロがある）なら、足せるものだけ足す。
- CHAT: 質問・感想・意味が分からない頼み・できない頼み（BPM やキーの変更等）。返事で聞き返すか、できることを提案する。
ルール:
- reply は1〜2文。キャラクターとして、これから何をするかを短く言う（例「了解！サビだけバティの声で歌い直すね！」）。
- 子どもも使うので健全な言葉で。歌詞も健全に。
出力は JSON だけ:
{"reply":"返事","action":"VOLUME_TEMPO_EDIT|LYRICS_EDIT|VOICE_REPLACE|TIMING_EDIT|GENRE_EDIT|SONG_EXTEND|CHAT", …命令ごとの項目}`;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined);
const clamp = (v: number | undefined, lo: number, hi: number) => (v === undefined ? undefined : Math.max(lo, Math.min(hi, v)));
const round = (v: number | undefined, step: number) => (v === undefined ? undefined : Math.round(v / step) * step);

export interface ParsedSongEdit {
  reply: string;
  action: SongEditAction;
  command?: SongEditCommand;
}

/**
 * Validate the model's answer into one command (clamped, line numbers checked). Mix values stay
 * relative (tempo multiplier, dB / beat deltas) — applyMixEdit applies them. Unusable → CHAT.
 */
export function parseSongEdit(raw: string, c: Pick<SongEditContext, 'phrases' | 'hasBatiVoice'>, partner: ComposePartner): ParsedSongEdit {
  const fallback = partner.isBati ? 'ごめん、うまく分からなかった…もう一回言ってみて！' : 'すまん、よく分からなかったケン。もう一回言ってみろ！';
  let j: Record<string, unknown>;
  try {
    j = extractJson(raw) as Record<string, unknown>;
  } catch {
    return { reply: raw.trim().slice(0, 200) || fallback, action: 'CHAT' };
  }
  const reply = typeof j.reply === 'string' && j.reply.trim() ? j.reply.trim().slice(0, 200) : fallback;
  const n = c.phrases.length;
  const valid = (i: unknown) => {
    const v = num(i);
    return v !== undefined && Number.isInteger(v) && v >= 0 && v < n ? v : undefined;
  };
  let cmd: unknown;
  switch (j.action) {
    case 'VOLUME_TEMPO_EDIT': {
      const tempo = round(clamp(num(j.tempo ?? j.vocal_speed), 0.8, 1.25), 0.01);
      const vocalDb = round(clamp(num(j.vocal_volume_db ?? j.vocalDb), -12, 12), 0.5);
      const bgmDb = round(clamp(num(j.bgm_volume_db ?? j.bgmDb), -12, 12), 0.5);
      if (tempo !== undefined || vocalDb !== undefined || bgmDb !== undefined) cmd = { action: j.action, tempo, vocalDb, bgmDb };
      break;
    }
    case 'LYRICS_EDIT': {
      const list = Array.isArray(j.edits) ? j.edits : j.target_phrase_index !== undefined ? [{ index: j.target_phrase_index, text: j.new_lyrics }] : [];
      const edits = (list as { index?: unknown; text?: unknown }[])
        .map((e) => ({ index: valid(e?.index), text: typeof e?.text === 'string' ? e.text.replace(/\[[^\]]*\]/g, '').trim().slice(0, 40) : '' }))
        .filter((e): e is { index: number; text: string } => e.index !== undefined && !!e.text)
        .slice(0, 8);
      if (edits.length) cmd = { action: j.action, edits };
      break;
    }
    case 'VOICE_REPLACE': {
      const raw2 = Array.isArray(j.indexes) ? j.indexes : j.target_phrase_index !== undefined ? [j.target_phrase_index] : [];
      const indexes = [...new Set((raw2 as unknown[]).map(valid).filter((i): i is number => i !== undefined))];
      const v = String(j.voice ?? j.use_voice_id ?? '');
      const slot = /bati|b$/i.test(v) ? 'bati' : 'self';
      if (slot === 'bati' && !c.hasBatiVoice) {
        return { reply: partner.isBati ? 'わたしの声がまだ登録されてないみたい。声の登録ページで登録してね！' : 'バティの声がまだ登録されてないケン。先に声を登録してくれ！', action: 'CHAT' };
      }
      if (indexes.length) cmd = { action: j.action, indexes, slot };
      break;
    }
    case 'TIMING_EDIT': {
      const delayBeats = round(clamp(num(j.delay_beats ?? j.delayBeats), -16, 16), 0.5);
      const gapAfter = valid(j.gap_after ?? j.insert_silence_after_phrase);
      const gapSeconds = round(clamp(num(j.gap_seconds ?? j.silence_seconds), 0, 8), 0.1);
      if (delayBeats !== undefined || (gapAfter !== undefined && gapSeconds !== undefined))
        cmd = { action: j.action, delayBeats, ...(gapAfter !== undefined && gapSeconds !== undefined ? { gapAfter, gapSeconds } : {}) };
      break;
    }
    case 'SONG_EXTEND': {
      const kind = ['second', 'bigchorus', 'long'].includes(String(j.kind)) ? String(j.kind) : undefined;
      const sections = (Array.isArray(j.sections) ? (j.sections as { name?: unknown; lines?: unknown }[]) : [])
        .map((sec) => ({
          name: ['verse', 'chorus', 'bridge'].includes(String(sec?.name)) ? String(sec.name) : '',
          lines: (Array.isArray(sec?.lines) ? (sec.lines as unknown[]) : [])
            .map((l) => (typeof l === 'string' ? l : typeof (l as { text?: unknown })?.text === 'string' ? String((l as { text: string }).text) : ''))
            .map((l) => l.replace(/\[[^\]]*\]/g, '').trim().slice(0, 40))
            .filter(Boolean)
            .slice(0, 8),
        }))
        .filter((sec) => sec.name && sec.lines.length)
        .slice(0, 4);
      if (kind && sections.length) cmd = { action: j.action, kind, sections };
      break;
    }
    case 'GENRE_EDIT': {
      const p = typeof (j.prompt ?? j.new_ace_step_prompt) === 'string' ? String(j.prompt ?? j.new_ace_step_prompt).trim().slice(0, 400) : '';
      if (p.length >= 3) cmd = { action: j.action, prompt: p };
      break;
    }
  }
  const ok = cmd ? SongEditCommand.safeParse(cmd) : null;
  if (!ok?.success) return { reply, action: 'CHAT' };
  return { reply, action: ok.data.action, command: ok.data };
}

/** Apply a relative command to the mix (VOLUME_TEMPO_EDIT / TIMING_EDIT). */
export function applyMixEdit(mix: SongMix, cmd: SongEditCommand, phraseCount: number): SongMix {
  const m: SongMix = { ...mix, gaps: [...mix.gaps] };
  while (m.gaps.length < phraseCount) m.gaps.push(0);
  if (cmd.action === 'VOLUME_TEMPO_EDIT') {
    if (cmd.tempo !== undefined) m.tempo = Math.round(Math.max(0.8, Math.min(1.25, m.tempo * cmd.tempo)) * 100) / 100;
    if (cmd.vocalDb !== undefined) m.vocalDb = Math.max(-12, Math.min(12, m.vocalDb + cmd.vocalDb));
    if (cmd.bgmDb !== undefined) m.bgmDb = Math.max(-12, Math.min(12, m.bgmDb + cmd.bgmDb));
  } else if (cmd.action === 'TIMING_EDIT') {
    if (cmd.delayBeats !== undefined) m.delayBeats = Math.max(0, Math.min(16, m.delayBeats + cmd.delayBeats));
    if (cmd.gapAfter !== undefined && cmd.gapSeconds !== undefined && cmd.gapAfter < phraseCount) m.gaps[cmd.gapAfter] = cmd.gapSeconds;
  }
  return m;
}

/** Offline answer (no API key): a few keywords → a command, so the edit flow can be tried locally. */
export function mockSongEdit(said: string): string {
  const r = (reply: string, o: Record<string, unknown>) => JSON.stringify({ reply, ...o });
  if (/2番|二番/.test(said))
    return r('2番を作るね！', { action: 'SONG_EXTEND', kind: 'second', sections: [{ name: 'verse', lines: ['ゆうやけのみち かげがのびて', 'きょうのできごと はなしながら', 'ちいさなけんか すぐなかなおり', 'またあるきだす'] }, { name: 'chorus', lines: ['きみとならどこまでも', 'そらはいつもあおいから', 'わらってうたおう いまここで', 'あしたもきっといいひ'] }] });
  if (/大サビ|Cメロ|ラスサビ/.test(said)) return r('大サビを足すね！', { action: 'SONG_EXTEND', kind: 'bigchorus', sections: [{ name: 'bridge', lines: ['もしもあしたが みえなくても', 'このうたが みちしるべ'] }, { name: 'chorus', lines: ['きみとならどこまでも', 'そらはいつもあおいから', 'わらってうたおう いまここで', 'あしたもきっといいひ'] }] });
  if (/ロック|バラード|ジャンル|伴奏を変え/.test(said)) return r('伴奏を作り直すね！', { action: 'GENRE_EDIT', prompt: 'hard rock instrumental, distorted electric guitar, drums, bass, high energy, no vocals' });
  if (/バティ|声B/.test(said)) return r('サビをバティの声で歌い直すね！', { action: 'VOICE_REPLACE', indexes: [4, 5, 6, 7], voice: 'bati' });
  if (/歌詞/.test(said)) return r('最初の行の歌詞を変えるね！', { action: 'LYRICS_EDIT', edits: [{ index: 0, text: 'きょうはとくべつなひ' }] });
  if (/遅らせ|間を/.test(said)) return r('歌い出しを遅らせるね！', { action: 'TIMING_EDIT', delay_beats: 4 });
  if (/速く|早く/.test(said)) return r('少し速くするね！', { action: 'VOLUME_TEMPO_EDIT', tempo: 1.1 });
  if (/遅く/.test(said)) return r('少しゆっくりにするね！', { action: 'VOLUME_TEMPO_EDIT', tempo: 0.9 });
  if (/大きく|小さく|音量/.test(said)) return r('歌を大きくして伴奏を下げるね！', { action: 'VOLUME_TEMPO_EDIT', vocal_volume_db: 2, bgm_volume_db: -1.5 });
  return r('どこをどう変えたい？ 速さ・音量・歌詞・声・伴奏、なんでも言ってね！', { action: 'CHAT' });
}
