// MV kit — deterministic frame renderer.
// Needs a static server on 127.0.0.1:$PORT serving the project folder (make.sh / qa.sh start one).
//   PROJECT=<dir> node render.js video <out.mp4>        -> all frames piped to ffmpeg + the song muxed (H.264/AAC)
//   PROJECT=<dir> node render.js stills <dir> 3,12.5   -> JPEG stills at those song seconds
//   PROJECT=<dir> node render.js seq <dir> 37.5 12     -> 12 consecutive frames from 37.5 s
// env: SPEED (e.g. 1.2 = 1.2x tempo, pitch kept), GRADE=0 (no film grade), WORKERS, BATCH, PORT
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');

const PRJ = path.resolve(process.env.PROJECT || '.');
const P = JSON.parse(fs.readFileSync(path.join(PRJ, 'project.json'), 'utf8'));
const PORT = +(process.env.PORT || 8795), FPS = 30;
const URL = `http://127.0.0.1:${PORT}/index.html?render=1`;
const SONG = path.join(PRJ, P.song || 'song.mp3');
const DURATION = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', SONG]).toString().trim();
const SPEED = +(process.env.SPEED || P.speed || 1);   // >1 = faster tempo (audio atempo, same pitch); frames follow the song exactly
// film grade (one look for the whole MV): highlights roll off softly, shadows a touch warm, a little richer colour
const GRADE = process.env.GRADE === '0' ? '' : "curves=master='0/0 0.25/0.235 0.6/0.61 0.88/0.87 1/0.955':r='0/0.018 0.5/0.505 1/0.99':g='0/0.008 0.5/0.5 1/0.98':b='0/0 0.5/0.48 1/0.955',eq=saturation=1.04,";
const FRAMES = Math.round(DURATION / SPEED * FPS);
const WORKERS = +(process.env.WORKERS || 3), BATCH = +(process.env.BATCH || 8), QUALITY = 0.95;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('pageerror', String(e)));
  page.on('console', m => { if (m.type() === 'error') console.error('console', m.text()); });
  await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
  await page.evaluate(() => window.mvReady);
  return page;
}
// renders a list of times in one evaluate call, returns base64 JPEG bodies
const grab = (page, times) => page.evaluate(async ({ times, q }) => {
  const cv = document.getElementById('cv'), out = [];
  for (const t of times) { if (window.prepAt) await window.prepAt(t); window.renderAt(t); out.push(cv.toDataURL('image/jpeg', q).slice(23)); }
  return out;
}, { times, q: QUALITY });

async function video(out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-stats',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', SONG, '-map', '0:v:0', '-map', '1:a:0', ...(SPEED !== 1 ? ['-af', `atempo=${SPEED}`] : []),
    '-vf', `${GRADE}scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
  const write = buf => new Promise(res => { if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res); });

  const browser = await chromium.launch();
  const pages = await Promise.all(Array.from({ length: WORKERS }, () => openPage(browser)));
  const results = new Map(); let next = 0, written = 0, wake = null; const t0 = Date.now();
  const batches = []; for (let f = 0; f < FRAMES; f += BATCH) batches.push(f);
  let bi = 0;
  const worker = async page => {
    while (bi < batches.length) {
      const start = batches[bi++], n = Math.min(BATCH, FRAMES - start);
      // back-pressure: don't run too far ahead of the writer
      while (start - written > BATCH * WORKERS * 4) await new Promise(r => setTimeout(r, 20));
      const imgs = await grab(page, Array.from({ length: n }, (_, k) => (start + k) / FPS * SPEED));
      imgs.forEach((b, k) => results.set(start + k, Buffer.from(b, 'base64')));
      if (wake) { const w = wake; wake = null; w(); }
    }
  };
  const writer = (async () => {
    while (next < FRAMES) {
      if (!results.has(next)) { await new Promise(r => { wake = r; }); continue; }
      const buf = results.get(next); results.delete(next); await write(buf); next++; written = next;
      if (next % 300 === 0) console.error(`frames ${next}/${FRAMES}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  })();
  await Promise.all(pages.map(worker)); await writer;
  ff.stdin.end(); await done; await browser.close();
  console.error(`video done in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${out}`);
}

async function stills(dir, times) {
  fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch(); const page = await openPage(browser);
  for (let k = 0; k < times.length; k += BATCH) {
    const ts = times.slice(k, k + BATCH), imgs = await grab(page, ts);
    imgs.forEach((b, j) => fs.writeFileSync(path.join(dir, `t${ts[j].toFixed(2).padStart(6, '0')}.jpg`), Buffer.from(b, 'base64')));
  }
  await browser.close();
}

(async () => {
  const [mode, a, b, c] = process.argv.slice(2);
  if (mode === 'video') await video(path.resolve(a));
  else if (mode === 'stills') await stills(path.resolve(a), b.split(',').map(Number));
  else if (mode === 'seq') await stills(path.resolve(a), Array.from({ length: +(c || 10) }, (_, k) => +b + k / FPS));
  else { console.error('usage: node render.js video <out.mp4> | stills <dir> <t,t,..> | seq <dir> <t0> <n>'); process.exit(2); }
})().catch(e => { console.error(e); process.exit(1); });
