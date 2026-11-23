"""A plate's sky mask (M-R251 review, for the ambient layer): white = sky, feathered; the same size as the plate.
Derived from the plate's horizon (horizonY, 0..1 from the top) and its colour: above the horizon, the calm (low
detail) region connected to the top edge is sky; below the horizon nothing is.

python3 scripts/story-images/m-r251/skymask.py <plate.jpg> <horizonY> [out.png]
Look at the result over the plate (a red overlay is written next to it as *-check.jpg) before using it.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

src, hy = sys.argv[1], float(sys.argv[2])
out = sys.argv[3] if len(sys.argv) > 3 else src.rsplit('.', 1)[0] + '-sky.png'
im = Image.open(src).convert('RGB')
W, H = im.size
g = np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(2)), dtype=np.float32)
gy, gx = np.gradient(g)
detail = ndimage.uniform_filter(np.hypot(gx, gy), 15)
calm = detail < np.percentile(detail[: int(H * hy)], 55)
calm[int(H * hy):] = False
lab, n = ndimage.label(calm)
top = set(np.unique(lab[0])) - {0}
sky = np.isin(lab, list(top))
sky = ndimage.binary_closing(sky, iterations=6)
mask = Image.fromarray((sky * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(max(4, W // 200)))
mask.save(out)
check = Image.composite(Image.new('RGB', im.size, (255, 0, 0)), im, mask.point(lambda v: v // 2))
check.save(out.rsplit('.', 1)[0] + '-check.jpg', quality=80)
print(out)
