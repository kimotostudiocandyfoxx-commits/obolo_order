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
    f2=f.replace('/chibi-','/chibi2-')
    if os.path.exists(f2): kk=key(Image.open(f2)); kk.thumbnail((300,300)); A['chibi-'+k]=uri(kk,86)
for k in 'mine dachi oshi'.split():
    f=f'{O}/ball-{k}.jpg'
    if os.path.exists(f): kk=key(Image.open(f)); kk.thumbnail((160,160)); A['ball-'+k]=uri(kk,88)
_RM=H+{'2':'/saturn-record-mask2.png','3':'/saturn-record-mask3.png'}.get(os.environ.get('SATURN_BG','home2-bg-saturn-cutea3')[-1],'/saturn-record-mask.png')
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
# Jupiter v3 (2026-11-24): forest with your tree, butterflies, sample art
f=f'{O}/home3-bg-jupiter2.jpg' if os.path.exists(f'{O}/home3-bg-jupiter2.jpg') else f'{O}/home3-bg-jupiter.jpg'
if os.path.exists(f): im=Image.open(f).convert('RGB'); im.thumbnail((720,1280)); A['bg3-jupiter']=uri(im,78)
for n in range(1,5):
    f=f'{O}/bfly3-{n}.jpg'
    if os.path.exists(f): kk=key(Image.open(f)); kk.thumbnail((200,200)); A[f'bfly3-{n}']=uri(kk,86)
for n in range(1,6):
    f=f'{O}/jart-{n}.jpg'
    if os.path.exists(f): im=Image.open(f).convert('RGB'); im.thumbnail((360,360)); A[f'jart-{n}']=uri(im,80)
# Mercury v3: sea with your island, music boats, song clips
f=f'{O}/home3-bg-mercury.jpg'
if os.path.exists(f): im=Image.open(f).convert('RGB'); im.thumbnail((720,1280)); A['bg3-mercury']=uri(im,78)
for n in range(1,5):
    f=f'{O}/ship3-{n}.jpg'
    if os.path.exists(f): kk=key(Image.open(f)); kk.thumbnail((220,220)); A[f'ship3-{n}']=uri(kk,86)
for n in range(1,6):
    f=f'{H}/songs/song-{n}.mp3'
    if os.path.exists(f): A[f'song-{n}']='data:audio/mpeg;base64,'+base64.b64encode(open(f,'rb').read()).decode()
for k in 'user kimorin monban mikie brother sister'.split():
    f=f'{O}/chibi3-{k}.jpg'
    if os.path.exists(f): kk=key(Image.open(f)); kk.thumbnail((260,260)); A['chibi3-'+k]=uri(kk,86)
    f=f'{O}/chibi4-{k}.jpg'
    if os.path.exists(f): kk=key(Image.open(f)); kk.thumbnail((260,260)); A['chibi4-'+k]=uri(kk,86)
# profile korolin (white background, ears/hair stick out): remove only the white that touches the border
def unwhite(im):
    from PIL import ImageFilter as _F
    a=np.asarray(im.convert('RGB')).astype(int); h,w,_=a.shape; wh=(a.min(2)>228)
    seen=np.zeros((h,w),bool); st=[(0,x) for x in range(w)]+[(h-1,x) for x in range(w)]+[(y,0) for y in range(h)]+[(y,w-1) for y in range(h)]
    while st:
        y,x=st.pop()
        if y<0 or y>=h or x<0 or x>=w or seen[y,x] or not wh[y,x]: continue
        seen[y,x]=True; st+= [(y+1,x),(y-1,x),(y,x+1),(y,x-1)]
    al=Image.fromarray(((~seen)*255).astype('uint8')).filter(_F.MinFilter(3)).filter(_F.GaussianBlur(1.2))
    o=im.convert('RGBA'); o.putalpha(al); return o.crop(o.getbbox())
for k in 'user kimorin monban mikie brother sister'.split():
    f=f'{O}/kor4-{k}.jpg'
    if os.path.exists(f): o=unwhite(Image.open(f)); o.thumbnail((220,220),Image.LANCZOS); A['kor4-'+k]=uri(o,88)
    f=f'{O}/ship4-{k}.jpg'
    if os.path.exists(f): o=unwhite(Image.open(f)); o.thumbnail((260,260),Image.LANCZOS); A['ship4-'+k]=uri(o,88)
VD=os.environ.get('VOICE_DIR')
if VD:
    for n in range(1,6):
        f=f'{VD}/line-{n:02d}.mp3'
        if os.path.exists(f): A[f'voice-{n:02d}']='data:audio/mpeg;base64,'+base64.b64encode(open(f,'rb').read()).decode()
        f=f'{VD}/title-{n}.mp3'
        if os.path.exists(f): A[f'vtitle-{n}']='data:audio/mpeg;base64,'+base64.b64encode(open(f,'rb').read()).decode()
SAT=os.environ.get('SATURN_BG','home2-bg-saturn-cutea3')
RECMASK=H+{'2':'/saturn-record-mask2.png','3':'/saturn-record-mask3.png'}.get(SAT[-1],'/saturn-record-mask.png')
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
open(os.environ.get('OUT_HTML') or H+'/home-inline.html','w').write(t); print(len(A),'assets',round(len(t)/1e6,2),'MB')
