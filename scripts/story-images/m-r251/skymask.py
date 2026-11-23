"""A plate's sky mask (M-R251 review, for the ambient layer): white = sky, feathered; the same size as the plate.
Derived from the plate's horizon (horizonY, 0..1 from the top) and its colour: above the horizon, the calm (low
detail) region connected to the top edge is sky; below the horizon nothing is.

python3 scripts/story-images/m-r251/skymask.py <plate.jpg> <horizonY> [out.png] [--indoor]
--indoor: the sky is what is seen through the windows / arches (the dark space or the bright sky in them), not the
ceiling: calm regions above the horizon that are very dark (space) or sky-coloured, anywhere.
Look at the result over the plate (a red overlay is written next to it as *-check.jpg) before using it.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

args = [a for a in sys.argv[1:] if not a.startswith('--')]
indoor = '--indoor' in sys.argv
src, hy = args[0], float(args[1])
out = args[2] if len(args) > 2 else src.rsplit('.', 1)[0] + '-sky.png'
im = Image.open(src).convert('RGB')
W, H = im.size
g = np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(2)), dtype=np.float32)
gy, gx = np.gradient(g)
detail = ndimage.uniform_filter(np.hypot(gx, gy), 15)
calm = detail < np.percentile(detail[: int(H * hy)], 30 if indoor else 55)
calm[int(H * hy):] = False
lab, n = ndimage.label(calm)
if indoor:
    rgb = np.asarray(im, dtype=np.float32)
    lum = rgb.mean(axis=2)
    skyish = (lum < 38) | ((rgb[..., 2] > rgb[..., 0] + 25) & (lum > 90))
    keep = []
    for k in range(1, n + 1):
        part = lab == k
        # (a dark ceiling reaches the top edge; a window does not)
        if part.sum() > W * H * 0.004 and skyish[part].mean() > 0.8 and not part[:3].any():
            keep.append(k)
    sky = np.isin(lab, keep)
    sky[int(H * hy):] = False
else:
    top = set(np.unique(lab[0])) - {0}
    sky = np.isin(lab, list(top))
sky = ndimage.binary_closing(sky, iterations=6)
mask = Image.fromarray((sky * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(max(4, W // 200)))
mask.save(out)
check = Image.composite(Image.new('RGB', im.size, (255, 0, 0)), im, mask.point(lambda v: v // 2))
check.save(out.rsplit('.', 1)[0] + '-check.jpg', quality=80)
print(out)
