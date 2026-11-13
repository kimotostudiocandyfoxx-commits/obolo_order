#!/usr/bin/env python3
"""Download the MV fonts into <dir> (once): Shippori Mincho B1 600/800 subset to <text> (the lyrics and credits),
Cinzel, Pinyon Script (calligraphy) and Cormorant Garamond (tracked caps / italic) for the latin title and ending.
  python3 fetch_fonts.py <dir> <text>"""
import os, re, subprocess, sys, urllib.parse
OUT, TEXT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

def get(url): return subprocess.run(['curl', '-sS', '--fail', '-A', UA, url], check=True, capture_output=True).stdout

def fetch(css_url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 1000: return
    css = get(css_url).decode()
    urls = re.findall(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', css)
    assert urls, css[:300]
    open(dest, 'wb').write(get(urls[-1]))   # with &text= there is a single subset; otherwise the last block is basic latin
    print('font', os.path.basename(dest), os.path.getsize(dest))

fetch('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800', os.path.join(OUT, 'cinzel.woff2'))
for w in (600, 800):
    fetch(f'https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@{w}&text=' + urllib.parse.quote(TEXT), os.path.join(OUT, f'mincho{w}.woff2'))
LAT = urllib.parse.quote("ÀÁÂÉÈÊËÎÏÔÖÙÛÜÇàáâéèêëîïôöùûüçœŒMmOoNnCcHhEeRrTtKkAaDdIiUuBbPpSsYyFfXxGgLlVvWwZzQqJj -—'.,&!?0123456789")
fetch('https://fonts.googleapis.com/css2?family=Pinyon+Script&text=' + LAT, os.path.join(OUT, 'pinyon.woff2'))
fetch('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&text=' + LAT, os.path.join(OUT, 'cormorant500.woff2'))
fetch('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500&text=' + LAT, os.path.join(OUT, 'cormorant500i.woff2'))
