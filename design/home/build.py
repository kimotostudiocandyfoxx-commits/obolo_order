# Build the self-contained prototype: design/home/home-inline.html (art as data URIs; sprites keyed from green)
import base64, io, json, os, numpy as np
from PIL import Image
R='/home/user/obolo_order'; O=R+'/design/mv-art/out'; H=R+'/design/home'
def uri(im, q=80): b=io.BytesIO(); im.save(b,'WEBP',quality=q,method=6); return 'data:image/webp;base64,'+base64.b64encode(b.getvalue()).decode()
def key(im):
    a=np.asarray(im.convert('RGB')).astype(np.float32); r,g,b=a[...,0],a[...,1],a[...,2]
    gn=g-np.maximum(r,b); al=np.clip(1-(gn-28)/55,0,1); a[...,1]=np.minimum(g,np.maximum(r,b)+12)
    k=Image.fromarray(np.dstack([a.clip(0,255),al*255]).astype(np.uint8),'RGBA'); return k.crop(k.getbbox())
A={}
for p in 'saturn jupiter mercury mars venus uranus pluto neptune'.split():
    f=f'{O}/home-bg-{p}.jpg'
    if os.path.exists(f): im=Image.open(f).convert('RGB'); im.thumbnail((720,1280)); A['bg-'+p]=uri(im,76)
for p in 'saturn jupiter mercury mars venus uranus pluto neptune'.split():
    f=f'{O}/home2-bg-{p}.jpg'
    if os.path.exists(f): im=Image.open(f).convert('RGB'); im.thumbnail((720,1280)); A['bg2-'+p]=uri(im,76)
for s in 'korolin butterfly ship ufo radio balloon book bubble'.split():
    f=f'{O}/home2-sp-{s}.jpg'
    if os.path.exists(f): k=key(Image.open(f)); k.thumbnail((240,240)); A['sp2-'+s]=uri(k,86)
for s in 'korolin butterfly ship ufo radio balloon book bubble'.split():
    f=f'{O}/home-sp-{s}.jpg'
    if os.path.exists(f): k=key(Image.open(f)); k.thumbnail((240,240)); A['sp-'+s]=uri(k,86)
for r in 'venus-longg venus-bossg mercury-freezie mercury-salmon mars-hippo uranus-croco neptune-boombox pluto-ribbon'.split():
    f=f'{O}/res-{r}.jpg'
    if os.path.exists(f): k=key(Image.open(f)); k.thumbnail((360,640)); A['res-'+r]=uri(k,86)
t=open(H+'/template.html').read().replace('/*ASSETS*/{}',json.dumps(A))
open(H+'/home-inline.html','w').write(t); print(len(A),'assets',round(len(t)/1e6,2),'MB')
