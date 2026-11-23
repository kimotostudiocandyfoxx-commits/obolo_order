"""Unit checks of scripts/lib/keying.py on synthetic pictures:  python3 scripts/lib/test_keying.py"""
import os
import sys
import unittest

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import keying  # noqa: E402

GREEN = (0, 255, 0)


def canvas(bg=GREEN, h=240, w=200, noise=2.0, seed=0):
    rng = np.random.default_rng(seed)
    a = np.empty((h, w, 3), np.float32)
    a[:] = bg
    return np.clip(a + rng.normal(0, noise, a.shape), 0, 255)


def disc(img, cx, cy, r, colour):
    """an anti-aliased disc (4× supersampled coverage)"""
    h, w = img.shape[:2]
    m = np.zeros((h * 4, w * 4), np.uint8)
    cv2.circle(m, (cx * 4, cy * 4), r * 4, 255, -1)
    cov = cv2.resize(m.astype(np.float32) / 255, (w, h), interpolation=cv2.INTER_AREA)[..., None]
    img[:] = img * (1 - cov) + np.array(colour, np.float32) * cov
    return cov[..., 0]


class Keying(unittest.TestCase):
    def test_disc_clean_edge(self):
        img = canvas()
        cov = disc(img, 100, 120, 60, (200, 40, 60))
        rgba, info = keying.cut(img, 'green')
        al = rgba[..., 3] / 255
        self.assertEqual(al[120, 100], 1)
        self.assertEqual(al[5, 5], 0)
        # the coverage is kept within about a pixel of the true disc
        self.assertLess(abs(al.sum() - cov.sum()) / cov.sum(), 0.04)
        # no green left on the edge: green never above the other two channels where something shows
        edge = (al > 0.05) & (al < 1)
        g, rb = rgba[..., 1].astype(int), np.maximum(rgba[..., 0], rgba[..., 2]).astype(int)
        self.assertTrue(edge.any())
        self.assertLessEqual(int((g - rb)[edge].max()), 12)
        r = keying.audit(rgba, 'green')
        self.assertLess(r['fringe'], 0.02)
        self.assertEqual(r['semi'], 0)

    def test_gap_kept_hole_filled(self):
        img = canvas()
        disc(img, 100, 120, 80, (230, 220, 200))
        disc(img, 70, 120, 18, GREEN)              # a real gap: the key seen through the figure
        disc(img, 135, 100, 9, (10, 245, 15))      # a greenish button: near the key, but part of the figure
        rgba, info = keying.cut(img, 'green')
        al = rgba[..., 3]
        self.assertEqual(al[120, 70], 0, 'the gap stays see-through')
        self.assertEqual(al[100, 135], 255, 'the greenish button is filled back in')
        self.assertGreaterEqual(info['holes_filled'], 1)
        self.assertGreaterEqual(info['gaps_kept'], 1)

    def test_specks_and_shadow_go(self):
        img = canvas()
        disc(img, 100, 100, 50, (40, 60, 200))
        for x, y in [(15, 15), (180, 30), (20, 200)]:
            img[y:y + 2, x:x + 2] = (250, 250, 250)   # specks of noise
        sh = np.zeros(img.shape[:2], np.uint8)
        cv2.ellipse(sh, (100, 200), (60, 12), 0, 0, 360, 255, -1)
        img[sh > 0] = np.array(GREEN, np.float32) * 0.55   # a floor shadow: the key, only darker
        rgba, info = keying.cut(img, 'green')
        al = rgba[..., 3]
        self.assertEqual(al[16, 16], 0)
        self.assertEqual(al[200, 100], 0, 'the shadow is background')
        self.assertEqual(al[100, 100], 255)
        self.assertGreaterEqual(info['islands_removed'], 3)

    def test_grey_key_keeps_grey_shading(self):
        img = canvas((128, 128, 128))
        disc(img, 100, 120, 60, (110, 110, 110))   # a grey figure on grey: hard, but it must not vanish
        rgba, _ = keying.cut(img, (128, 128, 128))
        self.assertEqual(rgba[120, 100, 3], 255)

    def test_choose_key(self):
        img = canvas()
        disc(img, 100, 120, 60, (40, 200, 60))     # a green character: never keyed on green
        al = np.zeros(img.shape[:2], np.float32)
        cv2.circle(al, (100, 120), 55, 1.0, -1)
        name, _, ranked = keying.choose_key(img, al)
        self.assertNotEqual(name, 'green')
        self.assertNotEqual(ranked[-1][0], name)
        img2 = canvas((0, 0, 0))
        disc(img2, 100, 120, 60, (220, 40, 200))    # a magenta character
        name2, _, _ = keying.choose_key(img2, al)
        self.assertNotEqual(name2, 'magenta')

    def test_oklab_roundtrip(self):
        c = np.random.default_rng(1).uniform(0, 255, (1000, 3)).astype(np.float32)
        self.assertLess(np.abs(keying.srgb(keying.oklab(c)) - c).max(), 0.6)


if __name__ == '__main__':
    unittest.main()
