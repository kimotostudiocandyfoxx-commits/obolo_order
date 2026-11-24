"""M-R262: the Saturn record's colour mask, rebuilt (the provided design/home/saturn-record-mask.png keeps the vinyl's
shiny reflection bands out, so a colour showed dark diagonal streaks). The record = the ellipse fitted to the provided
mask's outer edge (closed, holes filled), minus the centre label (an ellipse fitted to the mask's largest hole), the play
button (the round hole), and the tonearm / needle base (their mint and cream paint, found in the background, grown a
little and filled). Edge softened ~1.5 px. Writes an alpha PNG at half size.

  python3 scripts/planet-home/saturn-record-mask.py <background.jpg> <provided-mask.png> <out.png> [preview.jpg]
"""
import sys
import cv2
import numpy as np
from PIL import Image

bg_p, mask_p, out_p = sys.argv[1:4]
prev_p = sys.argv[4] if len(sys.argv) > 4 else None
bg = np.asarray(Image.open(bg_p).convert('RGB')).astype(np.int16)
m = (np.asarray(Image.open(mask_p).convert('L')) > 127).astype(np.uint8)
H, W = m.shape

# 1. the record's ellipse: close the provided mask, fill its holes, fit the outer contour (points on the frame's edge left out)
closed = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
cnts, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
outer = max(cnts, key=cv2.contourArea)
filled = np.zeros_like(m)
cv2.drawContours(filled, [outer], -1, 1, -1)
pts = outer[:, 0, :]
pts = pts[(pts[:, 0] > 3) & (pts[:, 0] < W - 4) & (pts[:, 1] < H - 4)]
ell = cv2.fitEllipse(pts.astype(np.float32))
rec = np.zeros_like(m)
cv2.ellipse(rec, ell, 1, -1)
# the ellipse covers the reflection bands the provided outline lost; the provided outline (closed, filled) keeps the
# record's ends at the frame's sides where the ellipse falls short
record = rec | filled
# the record is convex: in each column it runs from its top edge to its bottom edge (closes the notches the reflection
# bands leave where they reach the frame's side)
for x in range(W):
    ys = np.flatnonzero(record[:, x])
    if len(ys):
        record[ys[0]:ys[-1] + 1, x] = 1

# 2. the holes of the provided mask inside the record: the label (largest) and the play button (round)
holes = (filled == 1) & (m == 0)
n, lab, stats, cent = cv2.connectedComponentsWithStats(holes.astype(np.uint8), 8)
order = sorted(range(1, n), key=lambda i: -stats[i, cv2.CC_STAT_AREA])
keep_out = np.zeros_like(m)
label = order[0]
lpts = np.column_stack(np.where(lab == label))[:, ::-1].astype(np.float32)
(lc, (la, lb), lang) = cv2.fitEllipse(lpts)
# the label with its rim
cv2.ellipse(keep_out, (lc, (la * 1.12, lb * 1.12), lang), 1, -1)
for i in order[1:]:
    x, y, w, h, a = stats[i]
    if a < 2000:
        continue
    fill_ratio = a / float(w * h)
    if 0.65 < w / h < 1.6 and fill_ratio > 0.6:  # round: the play button
        cv2.ellipse(keep_out, ((float(cent[i][0]), float(cent[i][1])), (w * 1.12, h * 1.12), 0), 1, -1)

# 3. the tonearm and the needle base: their mint / cream paint on the record, grown and filled
R, G, B = bg[..., 0], bg[..., 1], bg[..., 2]
mint = (G - R > 18) & (np.max(bg, 2) - np.min(bg, 2) > 28)
cream = (R - B > 40) & (R > 150) & (G > 130)
# (not the label's own pastel clouds: its ellipse, grown, is left out first)
near_label = cv2.dilate(keep_out, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
arm = ((mint | cream) & (record == 1) & (near_label == 0)).astype(np.uint8)
n, lab, stats, _ = cv2.connectedComponentsWithStats(arm, 8)
big = np.zeros_like(m)
for i in range(1, n):
    if stats[i, cv2.CC_STAT_AREA] >= 1500:
        big[lab == i] = 1
big = cv2.morphologyEx(big, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (45, 45)))
# fill what the paint encloses (the headshell's pink parts), then grow a little
cs, _ = cv2.findContours(big, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
cv2.drawContours(big, cs, -1, 1, -1)
big = cv2.dilate(big, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
keep_out |= big

final = (record & (1 - keep_out)).astype(np.float32)
final = cv2.GaussianBlur(final, (0, 0), 1.5)
alpha = (final * 255).astype(np.uint8)
img = Image.new('RGBA', (W, H), (255, 255, 255, 0))
img.putalpha(Image.fromarray(alpha))
img = img.resize((W // 2, H // 2), Image.LANCZOS)
img.save(out_p, optimize=True)
print('ellipse', [round(v, 1) for v in (*ell[0], *ell[1], ell[2])], 'covered', round(float(alpha.mean()) / 255, 3))

if prev_p:  # a preview: pink, screen-blended at 0.85
    a = (alpha.astype(np.float32) / 255)[..., None] * 0.85
    base = bg.astype(np.float32)
    col = np.array([255, 122, 200], np.float32)
    screen = 255 - (255 - base) * (255 - col) / 255
    out = base * (1 - a) + screen * a
    Image.fromarray(out.clip(0, 255).astype(np.uint8)).crop((0, 900, W, H)).resize((540, 510)).save(prev_p, quality=88)
    Image.fromarray(alpha).crop((0, 900, W, H)).resize((540, 510)).save(prev_p.replace('.jpg', '-alpha.jpg'))
