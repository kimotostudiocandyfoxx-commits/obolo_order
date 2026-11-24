/**
 * M-R245: each person's bubble colour in a talk — muted tones, a faint vertical gradient (a → b), a 1.5 px line in the
 * same hue and the words in a deepened version of it (never black). iPad feedback: nobody is asked to pick one at the
 * first talk any more — everyone starts with 月光パール (TALK_TONE_DEFAULT) and asks {bati} to change it (the
 * changeable 'talk.bubbleColour', changeables.ts), or changes it in the Moon settings. Kept with the account as
 * Me.story 'sys.talk_color' (users.onboarding_json), as before.
 */
export interface TalkToneDef {
  id: string;
  name: string;
  a: string;
  b: string;
  line: string;
  ink: string;
}
export const TALK_TONES: Record<string, TalkToneDef> = {
  pearl: { id: 'pearl', name: '月光パール', a: '#f7f4fd', b: '#e7e1f6', line: '#9a8fc4', ink: '#2b2550' },
  honey: { id: 'honey', name: 'はちみつクリーム', a: '#fbf0d9', b: '#f0dcb0', line: '#c29a52', ink: '#4a3410' },
  sage: { id: 'sage', name: 'セージ', a: '#eef4ee', b: '#d9e6db', line: '#86a58e', ink: '#253d2c' },
  rose: { id: 'rose', name: 'くすみローズ', a: '#fbeff0', b: '#efd6da', line: '#b98790', ink: '#4a2730' },
  sky: { id: 'sky', name: '霧の空色', a: '#eef4fa', b: '#d6e4f1', line: '#87a3c2', ink: '#22374e' },
  apricot: { id: 'apricot', name: '杏', a: '#fdf1e8', b: '#f5dcc6', line: '#c79a73', ink: '#4a3018' },
  lilac: { id: 'lilac', name: 'ライラック', a: '#f5f0fb', b: '#e3d8f1', line: '#a48cc6', ink: '#35254f' },
  greyblue: { id: 'greyblue', name: '灰青', a: '#eef1f5', b: '#d8dee7', line: '#8a97a9', ink: '#283344' },
};
/** the colours a member may have for their own bubble (honey is {bati}'s; greyblue is for others in a group) */
export const SELF_TALK_TONES = ['pearl', 'sky', 'rose', 'sage', 'apricot', 'lilac'] as const;
/** everyone's bubble colour until they change it */
export const TALK_TONE_DEFAULT = 'pearl';
/** where the member's own colour is kept (Me.story) */
export const TALK_COLOR_KEY = 'sys.talk_color';
/** a stored colour, or the default when there is none (or it is not one of the member's colours) */
export const selfTalkTone = (stored: string | null | undefined): string => ((SELF_TALK_TONES as readonly string[]).includes(stored ?? '') ? stored! : TALK_TONE_DEFAULT);
