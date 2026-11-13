#!/usr/bin/env python3
"""contact sheet: python3 sheet.py <dir> <out.jpg> [cols] [cell]"""
import sys, glob, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4; s = int(sys.argv[4]) if len(sys.argv) > 4 else 400
fs = sorted(glob.glob(os.path.join(d, '*.jpg')))
rows = (len(fs) + cols - 1) // cols
sh = Image.new('RGB', (cols * s, rows * s), 'black')
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB').resize((s, s), Image.LANCZOS); dr = ImageDraw.Draw(im)
    dr.rectangle([0, 0, 80, 16], fill=(0, 0, 0)); dr.text((3, 2), os.path.basename(f)[1:-4], fill=(255, 255, 0))
    sh.paste(im, ((i % cols) * s, (i // cols) * s))
sh.save(out, quality=85); print(out, len(fs))
