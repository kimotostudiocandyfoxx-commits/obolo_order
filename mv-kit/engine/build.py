#!/usr/bin/env python3
"""MV kit — build one project into a single page (<project>/index.html).

  python3 mv-kit/engine/build.py <project-dir>

The project folder (keep it outside any public repository — it holds the song and, often, real people):
  project.json          everything that belongs to this song (lyrics + timing + placement, scenes, title, lights ...)
  song.mp3              the song (name can be changed with "song" in project.json)
  art/<img>.jpg         one square painting per scene image named in project.json (1440 px is plenty)
  art/card.jpg          (optional) jacket for the studio page
  layers/<img>-fg.webp  (optional) cut-out figure  } made by tools/make_layers.py + tools/plate_bg.py;
  layers/<img>-bg.webp  (optional) clean plate    } a scene with "layers" in project.json uses them for depth
  work/vocals.wav       (optional) the separated singing voice (tools/separate.sh): light breathes with the voice
  vid/<clip>.mp4        (optional, only after the MV is finished and you decided to animate: MANUAL.md step 12)
"""
import base64, hashlib, io, json, os, subprocess, sys
from PIL import Image
import numpy as np

KIT = os.path.dirname(os.path.abspath(__file__))
PRJ = os.path.abspath(sys.argv[1])
P = json.load(open(os.path.join(PRJ, 'project.json'), encoding='utf-8'))
SONG = os.path.join(PRJ, P.get('song', 'song.mp3'))

def webp(im, q=80, maxw=None):
    if maxw and im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6); return b.getvalue()

def uri(data, mime): return f'data:{mime};base64,' + base64.b64encode(data).decode()

def pcm(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768

def energy_curve(x, hz=10):
    """loudness envelope of the song, 10 values per second, smoothed (sigma 0.8 s), normalised 0..1"""
    hop = 8000 // hz; n = len(x) // hop
    db = 20 * np.log10(np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1) + 1e-9))
    k = np.exp(-0.5 * (np.arange(-30, 31) / 8.0) ** 2); k /= k.sum()
    db = np.convolve(np.pad(db, 30, mode='edge'), k, mode='valid')
    lo, hi = np.percentile(db, 5), np.percentile(db, 98)
    return [round(float(v), 3) for v in np.clip((db - lo) / (hi - lo), 0, 1)]

def vox_curve(x, hz=10):
    """loudness of the separated singing voice, 10 per second, lightly smoothed (sigma .25 s), gated, 0..1"""
    hop = 8000 // hz; n = len(x) // hop
    db = 20 * np.log10(np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1) + 1e-9))
    k = np.exp(-0.5 * (np.arange(-8, 9) / 2.5) ** 2); k /= k.sum()
    db = np.convolve(np.pad(db, 8, mode='edge'), k, mode='valid')
    lo, hi = np.percentile(db, 40), np.percentile(db, 99)
    return [round(float(v), 3) for v in np.clip((db - lo) / (hi - lo), 0, 1) ** 1.3]

# ---- fonts: subset to exactly the characters this project uses (cached per text) ----
texts = [l['text'] for l in P['lines']] + [str(v) for k in ('credit', 'studio') for v in (P.get(k) or {}).values() if isinstance(v, str)]
TEXT = ''.join(sorted(set(''.join(texts) + '0123456789')))
fdir = os.path.join(PRJ, '.cache', 'fonts-' + hashlib.sha1(TEXT.encode()).hexdigest()[:10])
subprocess.run([sys.executable, os.path.join(KIT, 'fetch_fonts.py'), fdir, TEXT], check=True)
font_css = ''
for fam, f, wt, st in (('MVCinzel', 'cinzel.woff2', '400 900', 'normal'), ('MVMincho', 'mincho600.woff2', '600', 'normal'), ('MVMincho', 'mincho800.woff2', '800', 'normal'),
                       ('MVScript', 'pinyon.woff2', '400', 'normal'), ('MVSerif', 'cormorant500.woff2', '500', 'normal'), ('MVSerif', 'cormorant500i.woff2', '500', 'italic'), ('MVHand', 'klee600.woff2', '600', 'normal')):
    font_css += "@font-face{font-family:'%s';font-weight:%s;font-style:%s;font-display:block;src:url(%s) format('woff2')}\n" % (
        fam, wt, st, uri(open(os.path.join(fdir, f), 'rb').read(), 'font/woff2'))

# ---- pictures ----
assets = {'song': uri(open(SONG, 'rb').read(), 'audio/mpeg'),
          'feather': uri(open(os.path.join(KIT, 'assets', 'feather.png'), 'rb').read(), 'image/png')}
card = os.path.join(PRJ, 'art', 'card.jpg')
if os.path.exists(card): assets['card'] = uri(webp(Image.open(card).convert('RGB'), 78, 480), 'image/webp')
missing = []
for img in sorted({s['img'] for s in P['scenes']}):
    bgf, fgf = (os.path.join(PRJ, 'layers', f'{img}-{k}.webp') for k in ('bg', 'fg'))
    wants = any(s['img'] == img and s.get('layers') for s in P['scenes'])
    if wants and os.path.exists(bgf) and os.path.exists(fgf):      # depth layers replace the flat painting
        assets[img + '-bg'] = uri(open(bgf, 'rb').read(), 'image/webp')
        assets[img + '-fg'] = uri(open(fgf, 'rb').read(), 'image/webp')
    else:
        f = next((os.path.join(PRJ, 'art', img + e) for e in ('.jpg', '.jpeg', '.png', '.webp') if os.path.exists(os.path.join(PRJ, 'art', img + e))), None)
        if not f: missing.append(img); continue
        assets[img] = uri(webp(Image.open(f).convert('RGB'), 90, 1440), 'image/webp')
if missing: print('WARNING: no picture for', missing, '(those scenes render black)')

def key_green(im):
    """green-screen picture -> RGBA: pure-ish green becomes transparent (soft edge), green spill on the edges pulled back"""
    a = np.asarray(im.convert('RGB')).astype(np.float32); r, g, bl = a[..., 0], a[..., 1], a[..., 2]
    gness = g - np.maximum(r, bl)                       # how much greener than the other channels
    alpha = np.clip(1 - (gness - 40) / 60, 0, 1)        # >100 -> transparent, <40 -> opaque
    a[..., 1] = np.minimum(g, np.maximum(r, bl) + 12)   # despill
    return Image.fromarray(np.dstack([a.clip(0, 255), alpha * 255]).astype(np.uint8), 'RGBA')

# foreground stills over scenes (scene.fg.still: a picture on a green background, keyed here)
for st in sorted({s['fg']['still'] for s in P['scenes'] if s.get('fg') and s['fg'].get('still')}):
    f = os.path.join(PRJ, 'art', st + '.jpg')
    if os.path.exists(f):
        kim = key_green(Image.open(f)); kim = kim.crop(kim.getbbox() or (0, 0, kim.width, kim.height))
        bio = io.BytesIO(); kim.save(bio, 'WEBP', quality=90, method=6); assets['fg-' + st] = uri(bio.getvalue(), 'image/webp')

# ---- optional moving paintings: vid/<clip>.mp4 -> vid/<clip>.f/f0001.jpg ... (every source frame, no rate conversion) ----
VID, vids = os.path.join(PRJ, 'vid'), {}
if P.get('video') and os.path.isdir(VID):
    for f in sorted(os.listdir(VID)):
        if not f.endswith('.mp4'): continue
        vid, d = f[:-4], os.path.join(VID, f[:-4] + '.f')
        fr = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', os.path.join(VID, f)], capture_output=True, text=True, check=True).stdout.strip()
        num, den = (fr.split('/') + ['1'])[:2]
        keyed = vid in (P['video'].get('keyed') or [])     # a green-screen clip used as a foreground layer: PNG frames with alpha
        if not os.path.isdir(d) or not os.listdir(d):
            os.makedirs(d, exist_ok=True)
            if keyed:
                tmp = os.path.join(d, 'tmp'); os.makedirs(tmp, exist_ok=True)
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(VID, f), '-vf', 'scale=720:720:flags=lanczos', '-fps_mode', 'passthrough', os.path.join(tmp, 'f%04d.png')], check=True)
                for fn in sorted(os.listdir(tmp)):
                    key_green(Image.open(os.path.join(tmp, fn))).save(os.path.join(d, fn)); os.remove(os.path.join(tmp, fn))
                os.rmdir(tmp)
            else:
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(VID, f), '-vf', 'scale=1080:1080:flags=lanczos', '-fps_mode', 'passthrough', '-q:v', '3', os.path.join(d, 'f%04d.jpg')], check=True)
        vids[vid] = {'n': len([x for x in os.listdir(d) if x.endswith(('.jpg', '.png'))]), 'fps': round(float(num) / float(den), 3)}
    print('videos', vids)

# ---- song analysis ----
x = pcm(SONG)
P['end'] = round(len(x) / 8000, 3)
voc = os.path.join(PRJ, 'work', 'vocals.wav')
vox = vox_curve(pcm(voc)) if os.path.exists(voc) else []

src = open(os.path.join(KIT, 'src.html'), encoding='utf-8').read()
lines = ''.join(f'  {json.dumps(k)}: "{v}",\n' for k, v in assets.items())
out = (src.replace('  /*ASSETS*/\n', lines).replace('/*FONTS*/', font_css)
          .replace('/*PROJECT*/', json.dumps(P, ensure_ascii=False))
          .replace('/*ENERGY*/', json.dumps(energy_curve(x)))
          .replace('/*VIDS*/', json.dumps(vids))
          .replace('/*VOX*/', json.dumps(vox)))
open(os.path.join(PRJ, 'index.html'), 'w', encoding='utf-8').write(out)
print('built', os.path.join(PRJ, 'index.html'), 'scenes', len(P['scenes']), 'lines', len(P['lines']), 'song', P['end'], 's', 'size MB', round(len(out) / 1e6, 2))
