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
for f in sorted(os.listdir(H+'/kororin')):
    if f.endswith('.webp'): im=Image.open(H+'/kororin/'+f).convert('RGBA'); im.thumbnail((200,200)); A['kor-'+f[:-5]]=uri(im,86)
for f in sorted(os.listdir(H+'/puni')):
    if f.endswith('.png'): im=Image.open(H+'/puni/'+f).convert('RGBA'); im.thumbnail((200,200)); A['puni-'+f[:-4]]=uri(im,88)
for k in 'user kimorin monban mikie brother sister'.split():
    f=f'{O}/chibi-{k}.jpg'
    if os.path.exists(f): kk=key(Image.open(f)); kk.thumbnail((300,300)); A['chibi-'+k]=uri(kk,86)
for k in 'mine dachi oshi'.split():
    f=f'{O}/ball-{k}.jpg'
    if os.path.exists(f): kk=key(Image.open(f)); kk.thumbnail((160,160)); A['ball-'+k]=uri(kk,88)
_RM=H+('/saturn-record-mask2.png' if os.environ.get('SATURN_BG','home2-bg-saturn-cutea2').endswith('cutea2') else '/saturn-record-mask.png')
if os.path.exists(_RM): mk=Image.open(_RM).convert('L'); mk.thumbnail((720,1280)); ma=Image.new('RGBA',mk.size,(255,255,255,0)); ma.putalpha(mk); b2=io.BytesIO(); ma.save(b2,'PNG',optimize=True); A['rec-mask']='data:image/png;base64,'+base64.b64encode(b2.getvalue()).decode()
# 8 korolin colours: tint the pearl ball (soft colour, highlights kept) and bake a soft shadow under it
_pearl=f'{O}/ball-dachi.jpg'
if os.path.exists(_pearl):
    from PIL import ImageFilter
    base=key(Image.open(_pearl)); base.thumbnail((160,160)); ba=np.asarray(base).astype(np.float32)
    for name,(r,g,b) in {'pearl':(255,255,255),'gold':(255,196,70),'pink':(255,150,190),'mint':(120,230,195),'lavender':(185,160,255),'sky':(130,195,255),'peach':(255,180,140),'night':(90,95,150)}.items():
        rgb=ba[...,:3]/255; lum=rgb.mean(2,keepdims=True); tint=np.array([r,g,b])/255
        col=np.clip(lum*tint*1.15+(lum**3)*.35,0,1) if name!='pearl' else rgb
        im=Image.fromarray(np.dstack([col*255,ba[...,3]]).astype(np.uint8),'RGBA')
        W,Hh=im.size; cv=Image.new('RGBA',(W,Hh+14),(0,0,0,0)); sh=Image.new('RGBA',(W,Hh+14),(0,0,0,0))
        from PIL import ImageDraw as _D; _D.Draw(sh).ellipse((W*.18,Hh-6,W*.82,Hh+10),fill=(30,10,40,90)); sh=sh.filter(ImageFilter.GaussianBlur(5))
        cv.alpha_composite(sh); cv.alpha_composite(im,(0,0)); cv=cv.crop((0,0,W,Hh))
        A['ballc-'+name]=uri(cv,88)
# painted korolin (white background): cut the sphere out as a clean circle
for n,pre in [(n,pre) for pre in ('kor2','kor3') for n in range(1,31)]:
    f=f'{O}/{pre}-{n:02d}.jpg'
    if not os.path.exists(f): continue
    from PIL import ImageDraw as _D2, ImageFilter as _F2
    im=Image.open(f).convert('RGB'); a=np.asarray(im).astype(int); m=(a.min(2)<232)|((a.max(2)-a.min(2))>18)
    ys,xs=np.where(m); x0,x1=np.percentile(xs,[.5,99.5]); y0,y1=np.percentile(ys,[.5,99.5]); cx,cy=(x0+x1)/2,(y0+y1)/2; r=min(x1-x0,y1-y0)/2-2
    S=4; mk=Image.new('L',(im.width*S,im.height*S),0); _D2.Draw(mk).ellipse(((cx-r)*S,(cy-r)*S,(cx+r)*S,(cy+r)*S),fill=255); mk=mk.resize(im.size,Image.LANCZOS)
    o=im.convert('RGBA'); o.putalpha(mk); o=o.crop((int(cx-r-2),int(cy-r-2),int(cx+r+2),int(cy+r+2))); o.thumbnail((200,200),Image.LANCZOS); A[f'{pre}-{n:02d}']=uri(o,88)
SAT=os.environ.get('SATURN_BG','home2-bg-saturn-cutea2')
RECMASK=H+('/saturn-record-mask2.png' if SAT.endswith('cutea2') else '/saturn-record-mask.png')
if SAT and os.path.exists(f'{O}/{SAT}.jpg'): im=Image.open(f'{O}/{SAT}.jpg').convert('RGB'); im.thumbnail((720,1280)); A['bg2-saturn']=uri(im,78)
if SAT.startswith('home2-bg-saturn-cutea') and os.path.exists(RECMASK):
    import numpy as np
    from PIL import ImageFilter
    src=Image.open(f'{O}/{SAT}.jpg').convert('RGB'); mk=np.array(Image.open(RECMASK).convert('L').resize(src.size))>128
    Hh,Ww=mk.shape; yy,xx=np.mgrid[0:Hh,0:Ww]; cx,cy,rx,ry=.481*Ww,.702*Hh,.574*Ww,.1885*Hh
    inside=((xx-cx)/rx)**2+((yy-cy)/ry)**2<1
    fg=(~mk)&(yy>cy)&((~inside)|(yy>cy+.6*ry))
    al=Image.fromarray((fg*255).astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.6))
    fi=src.convert('RGBA'); fi.putalpha(al); fi.thumbnail((720,1280)); A['sat-fg']=uri(fi,82)
t=open(H+'/template.html').read().replace('/*ASSETS*/{}',json.dumps(A))
open(H+'/home-inline.html','w').write(t); print(len(A),'assets',round(len(t)/1e6,2),'MB')
