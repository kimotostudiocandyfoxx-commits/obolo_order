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
    for n in (1,2):
        f=f'{O}/udance-{n}.jpg'
        if k=='user' and os.path.exists(f): o=unwhite(Image.open(f)); o.thumbnail((260,260),Image.LANCZOS); A[f'udance-{n}']=uri(o,88)
    f=f'{O}/ship4-{k}.jpg'
    if os.path.exists(f): o=unwhite(Image.open(f)); o.thumbnail((260,260),Image.LANCZOS); A['ship4-'+k]=uri(o,88)
for nm,key2 in [('home3-bg-jupiter-porch','bg3-jupiter-porch'),('home3-bg-mercury-pier','bg3-mercury-pier')]:
    f=f'{O}/{nm}.jpg'
    if os.path.exists(f): im=Image.open(f).convert('RGB'); im.thumbnail((720,1280)); A[key2]=uri(im,78)
f=f'{O}/uback.jpg'
if os.path.exists(f): o=unwhite(Image.open(f)); o.thumbnail((420,420),Image.LANCZOS); A['uback']=uri(o,86)
import json as _json
def kkbox(im):
    a=np.asarray(im.convert('RGB')).astype(int); m=(a.mean(2)>196)&(a.mean(2)<251)&((a[...,0]-a[...,2])>3); H_,W_=m.shape; cy,cx=H_//2,W_//2
    def run(v,c):
        l=c
        while l>0 and v[l-1]: l-=1
        r=c
        while r<len(v)-1 and v[r+1]: r+=1
        return l,r
    x0,x1=run(m[cy],cx); y0,y1=run(m[:,cx],cy); return [round(x0/W_,4),round(y0/H_,4),round((x1-x0)/W_,4),round((y1-y0)/H_,4)]
for nm in ['kakejiku','kakejiku2','kakejiku3','kakejiku4']:
    f=f'{O}/{nm}.jpg'
    if not os.path.exists(f): continue
    _k=Image.open(f).convert('RGB')
    if nm=='kakejiku': _k=_k.crop((0,176,_k.width,_k.height))
    o=unwhite(_k); bx=kkbox(Image.alpha_composite(Image.new('RGBA',o.size,(255,255,255,255)),o))
    # make the paper square: keep the top and bottom parts, resize the middle band (side borders + paper) to the paper's width
    W_,H_=o.size; x0=int(bx[0]*W_); y0=int(bx[1]*H_); pw=int(bx[2]*W_); ph=int(bx[3]*H_); y1=y0+ph
    mid=o.crop((0,y0,W_,y1))
    if pw<=ph: mid=mid.crop((0,(ph-pw)//2,W_,(ph-pw)//2+pw))
    else:
        tall=Image.new('RGBA',(W_,pw)); yy=0
        while yy<pw: tall.paste(mid,(0,yy)); yy+=ph
        mid=tall
    q=Image.new('RGBA',(W_,y0+pw+(H_-y1))); q.paste(o.crop((0,0,W_,y0)),(0,0)); q.paste(mid,(0,y0)); q.paste(o.crop((0,y1,W_,H_)),(0,y0+pw))
    bx=[round(x0/W_,4),round(y0/q.height,4),round(pw/W_,4),round(pw/q.height,4)]; o=q
    o.thumbnail((560,760),Image.LANCZOS); A[nm]=uri(o,86); A['box-'+nm]=_json.dumps(bx); A['ar-'+nm]=str(round(o.height/o.width,4))
for nm in ['plaque-1','plaque-2']:
    f=f'{O}/{nm}.jpg'
    if os.path.exists(f): o=unwhite(Image.open(f)); o.thumbnail((620,260),Image.LANCZOS); A[nm]=uri(o,86)
for nm,k2 in [('home2-bg-saturn-close','bg2-saturn-close'),('home2-bg-saturn-close2','bg2-saturn-close2')]:
    f=f'{O}/{nm}.jpg'
    if os.path.exists(f): im=Image.open(f).convert('RGB'); im.thumbnail((720,1280)); A[k2]=uri(im,78)
f=f'{O}/home2-bg-saturn-needle.jpg'
if os.path.exists(f): im=Image.open(f).convert('RGB'); im.thumbnail((720,1280)); A['bg2-saturn-needle']=uri(im,78)
f=f'{O}/home2-bg-saturn-top.jpg'
if os.path.exists(f):
    from PIL import ImageDraw as _D3
    im=Image.open(f).convert('RGB'); W_,H_=im.size; cx,cy,R=int(.5*W_),int(.494*H_),int(.73*W_)
    big=Image.new('RGBA',(2*R,2*R),(0,0,0,0)); big.paste(im,(R-cx,R-cy)); mk=Image.new('L',(8*R,8*R),0); _D3.Draw(mk).ellipse((0,0,8*R-1,8*R-1),fill=255); big.putalpha(mk.resize((2*R,2*R),Image.LANCZOS))
    big.thumbnail((900,900),Image.LANCZOS); A['rec-top']=uri(big,84); A['rectop-geo']='[0.5,0.494,0.73]'
    im2=im.copy(); im2.thumbnail((720,1280)); A['bg2-saturn-top']=uri(im2,78)
for nm,k2 in [('home3-bg-jupiter-atelier','bg3-jupiter-atelier'),('home3-bg-mercury-beach','bg3-mercury-beach')]:
    f=f'{O}/{nm}.jpg'
    if os.path.exists(f): im=Image.open(f).convert('RGB'); im.thumbnail((720,1280)); A[k2]=uri(im,78)
f=f'{O}/speaker3.jpg'
if os.path.exists(f):
    o=unwhite(Image.open(f)); a_=np.asarray(Image.alpha_composite(Image.new('RGBA',o.size,(255,255,255,255)),o).convert('RGB')).astype(int)
    g_=(np.abs(a_[...,0]-a_[...,1])<12)&(np.abs(a_[...,1]-a_[...,2])<12)&(a_.mean(2)>150)&(a_.mean(2)<235)
    h_,w_=g_.shape; ys,xs=np.where(g_[:h_//2]);
    if len(xs)>50: A['spk-panel']=_json.dumps([round(np.percentile(xs,3)/w_,3),round(np.percentile(ys,3)/h_,3),round((np.percentile(xs,97)-np.percentile(xs,3))/w_,3),round((np.percentile(ys,97)-np.percentile(ys,3))/h_,3)])
    o.thumbnail((260,260),Image.LANCZOS); A['speaker3']=uri(o,86); A['spk-ar']=str(round(o.width/o.height,4))
VD=os.environ.get('VOICE_DIR')
if VD:
    for n in range(1,6):
        f=f'{VD}/line-{n:02d}.mp3'
        if os.path.exists(f): A[f'voice-{n:02d}']='data:audio/mpeg;base64,'+base64.b64encode(open(f,'rb').read()).decode()
        f=f'{VD}/stitle-{n}.mp3'
        if os.path.exists(f): A[f'stitle-{n}']='data:audio/mpeg;base64,'+base64.b64encode(open(f,'rb').read()).decode()
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
