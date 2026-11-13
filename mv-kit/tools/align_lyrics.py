#!/usr/bin/env python3
"""DRAFT lyric timing: each lyric line -> start / sung-end, from the recognised characters (work/asr.json), into project.json "lines".
  python3 mv-kit/tools/align_lyrics.py <project-dir> <lyrics.txt>

lyrics.txt: one lyric line per text line; '／' splits a line into two rows on screen. Punctuation is cleaned the way
the MV shows it: a final 、。 is removed, an inner 、 becomes a wide space, an inner 。 is removed.
Existing "place" entries in project.json are kept (by line number); new lines get a plain bottom placement.

Recognising SUNG Japanese is much harder than speech: some lines are not recognised at all (shown as match 0%).
The result is a draft. Fix it by ear (MANUAL.md step 3): the first lyric must appear exactly when the voice starts."""
import difflib, json, os, re, sys
import pykakasi   # recognised text and lyrics are compared as hiragana readings (未来 / ミライ -> みらい)

KK = pykakasi.kakasi()
def hira(t): return ''.join(x['hira'] for x in KK.convert(t)) if t else ''

PRJ = os.path.abspath(sys.argv[1])
P = json.load(open(os.path.join(PRJ, 'project.json'), encoding='utf-8'))

def clean(l):
    l = re.sub(r'[、。,.!！?？]+$', '', l)
    l = re.sub(r'[、,]', ' ', l)
    return re.sub('。', '', l)

lines = [clean(l.strip()) for l in open(sys.argv[2], encoding='utf-8') if l.strip()]
A = json.load(open(os.path.join(PRJ, 'work', 'asr.json'), encoding='utf-8'))
phrases = A['phrases']; onsets = [a for a, b in phrases]

chars, times = [], []                      # recognised readings, one time per kana
for seg in A['segments']:
    for tk in seg['tokens']:
        for c in hira(tk['tok'].replace('▁', '')):
            chars.append(c); times.append(tk['t'])
flat, owner = [], []                       # lyric readings and the line each kana belongs to
for li, l in enumerate(lines):
    for c in hira(re.sub(r'[／\s ]', '', l)):
        flat.append(c); owner.append(li)

t_of = [None] * len(flat)
for a, b, n in difflib.SequenceMatcher(None, flat, chars, autojunk=False).get_matching_blocks():
    for k in range(n): t_of[a + k] = times[b + k]

def interp(i):
    if t_of[i] is not None: return t_of[i]
    L = next((j for j in range(i, -1, -1) if t_of[j] is not None), None)
    R = next((j for j in range(i, len(flat)) if t_of[j] is not None), None)
    if L is None and R is None: return 0.0
    if L is None: return t_of[R] - .13 * (R - i)
    if R is None: return t_of[L] + .13 * (i - L)
    return t_of[L] + (t_of[R] - t_of[L]) * (i - L) / (R - L)

old = P.get('lines', [])
res = []
for li, l in enumerate(lines):
    idx = [i for i, o in enumerate(owner) if o == li]
    m = [i for i in idx if t_of[i] is not None]
    got = len(m) / max(1, len(idx))
    # start: the voice onset (a phrase start after a pause) nearest to the first recognised kana
    est = (t_of[m[0]] - .13 * (m[0] - idx[0])) if m else interp(idx[0])
    prev_end = res[-1]['e'] if res else 0
    cand = [o for o in onsets if est - 1.6 <= o <= est + .7 and o >= prev_end - .2]
    s = min(cand, key=lambda o: abs(o - est)) if cand else est
    # end: the last recognised kana (+.35 s), not past the end of its phrase
    last = t_of[m[-1]] if m else interp(idx[-1])
    ph = next((b for a, b in phrases if a - .3 <= last <= b + .3), None)
    e = min(last + .35, ph) if ph else last + .35
    s = round(s, 2); e = round(max(e, s + .5), 2)
    if li < len(old) and old[li].get('place'): place = old[li]['place']
    elif '／' in l: place = [{'x': .5, 'y': .835, 'al': 'c', 'k': .95}, {'x': .5, 'y': .925, 'al': 'c', 'k': .95}]
    else: place = [{'x': .5, 'y': .9, 'al': 'c', 'k': .95}]
    res.append({'s': s, 'e': e, 'text': l, 'place': place})
    print(f'{li + 1:2d}  {s:7.2f} - {e:7.2f}  match {got:4.0%}{"   <- check by ear" if got < .5 else ""}  {l}')
if old and old[-1].get('peak'):
    res[-1].update({k: old[-1][k] for k in ('peak', 'hold') if k in old[-1]})
P['lines'] = res
json.dump(P, open(os.path.join(PRJ, 'project.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('project.json "lines" updated. This is a DRAFT: confirm every start by ear (MANUAL.md step 3).')
print('voice onsets (phrase starts after a pause) to pick from:', ' '.join(f'{o:.2f}' for o in onsets))
