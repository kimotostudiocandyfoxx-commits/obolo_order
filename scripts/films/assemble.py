#!/usr/bin/env python3
"""(client 2026-10-26: no OBOLON voice while the film plays)
Prototype cuts of the luxury videos (#1 招待信号, #10 記録 I) for the client to watch: trims the clips
to the timeline, adds the film texture and captions to Record I, mixes score, hits and voices."""
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../apps/web/public')
O = f'{R}/onboarding'
S = os.environ.get('FILM_OUT', '/tmp/obolo-films')
W = f'{S}/lux'
os.makedirs(W, exist_ok=True)
# Shippori Mincho (Google Fonts, OFL): FILM_FONT=path/to/ShipporiMincho-Medium.ttf
FONT = os.environ.get('FILM_FONT', f'{S}/font/sm.ttf')
FPS = 24


def run(*a):
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', *a], check=True)


def seg(name, clip, start, dur, vf='', fade_in=0.0, fade_out=0.0):
    """A silent 720x1280 piece of a clip."""
    f = [f'scale=720:1280,setsar=1,fps={FPS}']
    if vf:
        f.append(vf)
    if fade_in:
        f.append(f'fade=in:st=0:d={fade_in}')
    if fade_out:
        f.append(f'fade=out:st={dur - fade_out}:d={fade_out}')
    out = f'{W}/{name}.mp4'
    src = clip if clip.startswith('/') else f'{O}/m{clip}.mp4'
    run('-ss', str(start), '-t', str(dur), '-i', src, '-vf', ','.join(f), '-an', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', out)
    return out


def black(name, dur):
    out = f'{W}/{name}.mp4'
    run('-f', 'lavfi', '-i', f'color=black:s=720x1280:r={FPS}', '-t', str(dur), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', out)
    return out


def caption_png(name, lines, size=40):
    im = Image.new('RGBA', (720, 1280), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(FONT, size)
    total = len(lines) * (size + 22)
    y = (1280 - total) // 2
    for t in lines:
        w = d.textlength(t, font=f)
        d.text(((720 - w) / 2, y), t, font=f, fill=(240, 226, 190, 255))
        y += size + 22
    p = f'{W}/{name}.png'
    im.save(p)
    return p


def concat(name, parts):
    lst = f'{W}/{name}.txt'
    open(lst, 'w').write(''.join(f"file '{p}'\n" for p in parts))
    out = f'{W}/{name}-v.mp4'
    run('-f', 'concat', '-safe', '0', '-i', lst, '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', out)
    return out


def b36(n):
    d = '0123456789abcdefghijklmnopqrstuvwxyz'
    o = ''
    while True:
        n, r = divmod(n, 36)
        o = d[r] + o
        if not n:
            return o


def voice_key(who, act, text):
    """lib/story/voice.ts voiceKey"""
    s = f'{who}|{act or ""}|{text}'
    h1, h2 = 2166136261, 5381
    for ch in s:
        c = ord(ch)
        h1 = ((h1 ^ c) * 16777619) & 0xFFFFFFFF
        h2 = (h2 * 33 + c) & 0xFFFFFFFF
    return b36(h1) + b36(h2)


def voice(who, text):
    m = json.load(open(f'{R}/story/voices/manifest.json'))
    v = m.get(voice_key(who, None, text))
    return f'{R}{v}' if v else None


def mix(name, video, dur, music, music_vol, cues):
    """cues: [(file, at_seconds, volume)]"""
    ins = ['-i', video, '-i', music]
    flt = [f'[1:a]atrim=0:{dur},afade=t=out:st={dur - 3}:d=3,volume={music_vol}[m]']
    labels = ['[m]']
    for k, (f, at, vol) in enumerate(cues):
        ins += (['-stream_loop', '-1'] if 'projector' in f else []) + ['-i', f]
        flt.append(f'[{k + 2}:a]adelay={int(at * 1000)}|{int(at * 1000)},volume={vol}[c{k}]')
        labels.append(f'[c{k}]')
    flt.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0,alimiter=limit=0.95[a]")
    out = f'{S}/{name}.mp4'
    run(*ins, '-filter_complex', ';'.join(flt), '-map', '0:v', '-map', '[a]', '-t', str(dur), '-c:v', 'libx264', '-crf', '22', '-c:a', 'aac', '-b:a', '160k', '-shortest', out)
    return out


def signal():
    p, t, hits = [], 0.0, []
    p.append(black('s00', 2.0)); t += 2.0
    for k, c in enumerate(['sig-w1', 'sig-w2', 'sig-w3', 'sig-w4', 'sig-w5', 'sig-w6']):
        p.append(seg(f's1{k}', c, 1.2, 2.6, fade_in=0.4 if k == 0 else 0)); t += 2.6
    p.append(seg('s2', 'sig-rise', 0.6, 7.0)); t += 7.0
    p.append(seg('s3', 'sig-streak', 0.3, 4.4)); t += 4.4
    for k, c in enumerate(['sig-f1', 'sig-f2', 'sig-f3', 'sig-f4', 'sig-f5']):
        hits.append(t)
        p.append(seg(f's4{k}', c, 1.5, 1.5)); t += 1.5
    seal_at = t + 1.4
    p.append(seg('s5', 'sig-hand', 0.9, 4.1)); t += 4.1
    # the envelope floats up and streams to the viewer as light — no particular house (client 2026-10-26)
    p.append(seg('s6', 'sig-lift', 0.0, 5.0, fade_out=0.6)); t += 5.0
    p.append(black('s7', 1.0)); t += 1.0
    v = concat('signal', p)
    cues = [(f'{O}/se-sub-hit.mp3', h, 0.9) for h in hits] + [(f'{O}/se-seal-press.mp3', seal_at, 0.8)]
    return mix('opening-signal', v, t, f'{O}/bgm-signal.m4a', 0.85, cues)


FILM = "noise=alls=22:allf=t,eq=saturation=0.75:brightness=-0.02,vignette=PI/4.5,curves=preset=lighter"


def record():
    p, t, cues = [], 0.0, []
    crest = seg('r0', 'rec-crest', 0.3, 4.0, FILM, fade_in=0.6)
    c1 = caption_png('cap1', ['Obolo Order 本部　記録映像', '', 'Obolo Order以外の閲覧を禁ず'], 38)
    out = f'{W}/r0c.mp4'
    run('-i', crest, '-loop', '1', '-i', c1, '-filter_complex', '[1:v]format=rgba,fade=in:st=0.6:d=0.8:alpha=1[c];[0:v][c]overlay=0:0:shortest=1', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', out)
    p.append(out); t += 4.0
    c2 = caption_png('cap2', ['記録 I　ナガレ'], 46)
    b = black('r1b', 2.4)
    out = f'{W}/r1.mp4'
    run('-i', b, '-loop', '1', '-i', c2, '-filter_complex', '[1:v]format=rgba,fade=in:st=0.2:d=0.6:alpha=1,fade=out:st=1.8:d=0.5:alpha=1[c];[0:v][c]overlay=0:0:shortest=1', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', out)
    p.append(out); t += 2.4
    for k, (c, s, d) in enumerate([('rec-wcity', 0.5, 3.2), ('rec-wcanal', 0.5, 3.2)]):
        if os.path.exists(f'{O}/m{c}.mp4'):
            p.append(seg(f'r2{k}', c, s, d, FILM)); t += d
    v1 = voice('OBOLON', 'これが、、、ナガレだ。')
    p.append(seg('r3', 'rec-train', 0.4, 4.2, FILM))
    t += 4.2
    if os.path.exists(f'{O}/mrec-teens.mp4'):
        p.append(seg('r3b', 'rec-teens', 0.4, 3.6, FILM)); t += 3.6
    p.append(seg('r4', 'rec-3am', 0.3, 3.8, FILM)); t += 3.8
    v2 = voice('OBOLON', '終わりなく、、、誰かの暮らしが、流れてくる。')
    p.append(seg('r5', 'rec-feed', 0.2, 4.8, FILM))
    t += 4.8
    p.append(seg('r6', 'rec-meal', 0.3, 3.8, FILM)); t += 3.8
    p.append(seg('r7', 'rec-wait', 0.3, 3.8, FILM)); t += 3.8
    # the colour drains: the city again, saturation falling to grey, sound going under water
    v3 = voice('OBOLON', '眺めているうちに、、、自分の声を、忘れる。')
    drain = 'rec-wcity' if os.path.exists(f'{O}/mrec-wcity.mp4') else 'rec-wcanal'
    p.append(seg('r8', drain, 0.0, 5.0, FILM + ",hue=s='max(0,1-t/4)'"))
    t += 5.0
    p.append(seg('r9', drain, 4.0, 1.0, FILM + ',hue=s=0', fade_out=0.8))
    p.append(black('r9b', 1.6)); t += 2.6
    v = concat('record', p)
    cues.append((f'{O}/se-projector.mp3', 0.0, 0.35))
    out = mix('record-1', v, t, f'{O}/bgm-record.m4a', 0.7, cues)
    return out, [v1, v2, v3]


if __name__ == '__main__':
    which = sys.argv[1:] or ['signal', 'record']
    if 'signal' in which:
        print(signal())
    if 'record' in which:
        print(record())
