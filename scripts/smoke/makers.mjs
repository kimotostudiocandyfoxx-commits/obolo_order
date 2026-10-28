// The makers of days 1–3 against the real API, as a new invited person would meet them:
// invite → accept → NEO look (4) → one refine → choose → Bati egg → hatch → name → kororin designs (Saturn)
// → choose → wallet. Prints timings and errors; saves every picture under smoke-out/ (uploaded as an artifact).
// Env: API (https://…run.app), ADMIN_TOKEN.
import { mkdirSync, writeFileSync } from 'node:fs';

if (process.env.NO_SAVE) process.chdir('/tmp');

const API = process.env.API;
const ADMIN = process.env.ADMIN_TOKEN;
mkdirSync('smoke-out', { recursive: true });
const log = [];
const say = (s) => {
  console.log(s);
  log.push(s);
};
let token = '';
async function req(method, path, body, headers = {}) {
  const t0 = Date.now();
  const r = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(300_000),
  });
  const j = await r.json().catch(() => null);
  const ms = Date.now() - t0;
  say(`${r.ok ? 'OK ' : 'ERR'} ${method} ${path} ${r.status} ${(ms / 1000).toFixed(1)}s${r.ok ? '' : ' ' + JSON.stringify(j).slice(0, 300)}`);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return j;
}
async function save(name, url) {
  const abs0 = url.startsWith('http') ? url : API + url;
  say(`IMG ${name} ${abs0}`);
  if (process.env.NO_SAVE) return;
  try {
    const abs = url.startsWith('http') ? url : API + url;
    const b = Buffer.from(await (await fetch(abs)).arrayBuffer());
    const ext = (url.match(/\.(png|jpe?g|webp)/) ?? [, 'img'])[1];
    writeFileSync(`smoke-out/${name}.${ext}`, b);
    say(`   saved ${name}.${ext} (${Math.round(b.length / 1024)} KB)`);
  } catch (e) {
    say(`   could not save ${name}: ${e}`);
  }
}
const step = async (name, fn) => {
  try {
    return await fn();
  } catch (e) {
    say(`!! ${name} failed: ${e.message ?? e}`);
    return null;
  }
};

const email = `smoke+${Date.now()}@example.com`;
const inv = await req('POST', '/admin/invites', { email, inviterName: '木元' }, { 'x-admin-token': ADMIN });
const acc = await req('POST', `/invites/${inv.code}/accept`, { displayName: 'スモーク' });
token = acc.token;
say(`user ${acc.user.id} day ${acc.user.journeyDay}`);

const looks = await step('look', () => req('POST', '/me/look/candidates', { animal: 'きつね', color: '青と白', mood: 'やさしい', hobby: '音楽' }));
if (looks) for (const [k, c] of looks.candidates.entries()) await save(`look-${k + 1}`, c.url);
const refined = looks?.candidates[0] && (await step('refine', () => req('POST', '/me/look/refine', { mediaId: looks.candidates[0].id, instruction: 'もっと笑顔で、星の髪かざり' })));
if (refined) for (const [k, c] of refined.candidates.entries()) await save(`refine-${k + 1}`, c.url);
const pick = refined?.candidates[0] ?? looks?.candidates[0];
if (pick) await step('choose look', () => req('POST', '/me/look', { mediaId: pick.id }));

await step('egg', () => req('POST', '/me/bati/egg', { food: 'たこ焼き', egg: 'sun' }));
const hatched = await step('hatch', () => req('POST', '/me/bati/hatch'));
if (hatched?.bati?.imageUrl) await save('bati', hatched.bati.imageUrl);
await step('bati name', () => req('POST', '/me/bati/name', { name: 'タコ丸' }));

const designs = await step('kororin designs', () => req('POST', '/me/puni/pic/candidates', { description: 'たこ焼きと音楽が好きな、やさしい青いきつね', useNeoLook: true }));
if (designs) for (const [k, c] of designs.candidates.entries()) await save(`kororin-${k + 1}`, c.url);
if (designs?.candidates[0]) await step('choose kororin', () => req('POST', '/me/puni/pic', { mediaId: designs.candidates[0].id }));

const w = await step('wallet', () => req('GET', '/wallet'));
if (w) say(`mana left ${w.manaBalance}`);
const me = await step('me', () => req('GET', '/me'));
if (me) say(`me: look ${!!me.avatarUrl} bati ${me.bati?.name} pic ${!!me.puniPic}`);
writeFileSync('smoke-out/log.txt', log.join('\n'));
