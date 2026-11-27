# Build the self-contained prototype: design/home/home-inline.html (art as data URIs; sprites keyed from green)
import base64, io, json, os, numpy as np
from PIL import Image
R='/home/user/obolo_order'; O=R+'/design/mv-art/out'; H=R+'/design/home'
def uri(im, q=80): b=io.BytesIO(); im.save(b,'WEBP',quality=q,method=6); return 'data:image/webp;base64,'+base64.b64encode(b.getvalue()).decode()
def key(im):
    a=np.asarray(im.convert('RGB')).astype(np.float32); o0=a.copy(); r,g,b=a[...,0],a[...,1],a[...,2]
    gn=g-np.maximum(r,b); al=np.clip(1-(gn-28)/55,0,1); a[...,1]=np.minimum(g,np.maximum(r,b)+12)
    # M-R325: leftover backdrop-coloured fringes that touch the backdrop go too (flooded from the border by distance to
    # the measured backdrop colour); green parts of the figure that are not backdrop-coloured are kept
    from scipy import ndimage as _nd
    bd=np.concatenate([o0[0],o0[-1],o0[:,0],o0[:,-1]]); bgc=np.median(bd,axis=0)
    near=np.abs(o0-bgc).max(2)<60
    lab,_n=_nd.label(near); ed=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    al[np.isin(lab,list(ed))]=0
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
for k in 'user kimorin monban mikie brother sister sapon gari ebi uni ika shari kani'.split():
    f=f'{O}/chibi-{k}.jpg'
    if os.path.exists(f): kk=key(Image.open(f)); kk.thumbnail((300,300)); A['chibi-'+k]=uri(kk,86)
    f2=f.replace('/chibi-','/chibi2-')
    if os.path.exists(f2): kk=key(Image.open(f2)); kk.thumbnail((300,300)); A['chibi-'+k]=uri(kk,86)
def cleancut(im):
    """white-background cutout without a white halo: the border band gets alpha from how white it is, and its colour is un-mixed from white"""
    from scipy import ndimage as _nd
    o=unwhite(im); a=np.asarray(o).astype(np.float32); rgb=a[...,:3]; al=a[...,3]/255.
    solid=al>0.5
    inner=_nd.binary_erosion(solid,iterations=3); band=_nd.binary_dilation(solid,iterations=2)&~inner
    wh=np.clip((255-rgb.min(2))/70.,0,1)          # 0 = pure white, 1 = clearly coloured
    na=np.where(inner,1.,np.where(band,wh,0.))
    na=_nd.gaussian_filter(na,0.6)*band+inner*1.0
    na=np.clip(na,0,1)
    safe=np.maximum(na,1e-3)[...,None]
    un=np.clip((rgb-(1-na[...,None])*255)/safe,0,255)
    out=np.dstack([np.where(band[...,None],un,rgb),na*255]).astype('uint8')
    o=Image.fromarray(out,'RGBA'); bb=o.getbbox(); return o.crop(bb) if bb else o

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
for k in 'user kimorin monban mikie brother sister sapon gari ebi uni ika shari kani'.split():
    f=f'{O}/chibi3-{k}.jpg'
    if os.path.exists(f): kk=key(Image.open(f)); kk.thumbnail((260,260)); A['chibi3-'+k]=uri(kk,86)
    f=f'{O}/chibi4-{k}.jpg'
    if os.path.exists(f): kk=key(Image.open(f)); kk.thumbnail((260,260)); A['chibi4-'+k]=uri(kk,86)
# profile korolin (white background, ears/hair stick out): remove only the white that touches the border
def unwhite(im):
    """Cut a picture painted on a plain light background (M-R325).
    - the background colour is measured on the border (not assumed pure white)
    - the outside is flooded only through pixels very close to that colour and with no edge (so a white korolin or a
      white shirt that touches the background is not eaten)
    - holes of background enclosed by the figure (between an arm and the body, inside a boat) are removed too, but only
      when they are flat and the figure around them is clearly not background-coloured (so highlights stay)"""
    from PIL import ImageFilter as _F
    from scipy import ndimage as _nd
    a=np.asarray(im.convert('RGB')).astype(np.float32); h,w,_=a.shape
    bd=np.concatenate([a[0],a[-1],a[:,0],a[:,-1]]); bg=np.median(bd,axis=0)
    dist=np.abs(a-bg).max(2)
    lum=a.mean(2); gx=_nd.sobel(lum,1); gy=_nd.sobel(lum,0); grad=np.hypot(gx,gy)
    bgl=(dist<=12)&(grad<60)
    lab,n=_nd.label(bgl)
    edge=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    out=np.isin(lab,list(edge))
    # enclosed background holes
    hole=np.zeros_like(out)
    if n:
        idx=np.arange(1,n+1); area=_nd.sum(np.ones_like(lab),lab,idx)
        md=_nd.mean(dist,lab,idx); sd=_nd.standard_deviation(lum,lab,idx)
        for k,ar,m,sdv in zip(idx,area,md,sd):
            if k in edge or ar<0.0006*h*w or m>7 or sdv>3: continue
            comp=lab==k; ring=_nd.binary_dilation(comp,iterations=3)&~comp
            if dist[ring].mean()>45: hole|=comp
    clear=out|hole
    al=Image.fromarray(((~clear)*255).astype('uint8')).filter(_F.MinFilter(3)).filter(_F.GaussianBlur(1.0))
    o=im.convert('RGBA'); o.putalpha(al); bb=o.getbbox(); return o.crop(bb) if bb else o
for k in 'user kimorin monban mikie brother sister sapon gari ebi uni ika shari kani'.split():
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
for pl in ['mars','venus','uranus','pluto','neptune']:
    for key,k2 in [('main',f'bg5-{pl}'),('hv',f'bg5-{pl}-hv'),('prof',f'bg5-{pl}-prof')]:
        f=f'{O}/home5-{pl}-{key}.jpg'
        if os.path.exists(f): im=Image.open(f).convert('RGB'); im.thumbnail((720,1280)); A[k2]=uri(im,76)
    for k in 'user kimorin monban mikie brother sister sapon gari ebi uni ika shari kani'.split():
        f=f'{O}/p5-{pl}-{k}.jpg'
        if os.path.exists(f): o=unwhite(Image.open(f)); o.thumbnail((220,220),Image.LANCZOS); A[f'p5-{pl}-{k}']=uri(o,84)
for k in ['saturn','jupiter','mercury','mars','venus','uranus','pluto','neptune']:
    f=f'{O}/picon-{k}.jpg'
    if os.path.exists(f): o=unwhite(Image.open(f)); o.thumbnail((140,140),Image.LANCZOS); A['picon-'+k]=uri(o,86)
# sky pieces for every planet (isl-<planet>-<key>) and their backgrounds (exp-<planet>-...)
import glob as _g
for f in sorted(_g.glob(f'{O}/isl-*.jpg')):
    k=os.path.basename(f)[:-4]; o=unwhite(Image.open(f)); bb=o.getbbox(); o=o.crop(bb) if bb else o; o.thumbnail((380,380),Image.LANCZOS); A[k]=uri(o,84)
_REDO=set(json.load(open(H+'/../mv-art-queue.json')).get('redo',[]))
for f in sorted(_g.glob(f'{O}/exp-*.jpg')):
    k=os.path.basename(f)[:-4]
    if k.startswith('exp-mercury') or k in _REDO: continue  # pictures waiting to be redone are left out
    im=Image.open(f).convert('RGB'); im.thumbnail((720,1280)); A[k]=uri(im,76)
for nm in ['map','sea','edm','hiphop','ballad','rock','chill','citypop','anison','jazz','matsuri','rain']+[k+'-pier' for k in ['edm','hiphop','ballad','rock','chill','citypop','anison','jazz','matsuri','rain']]:
    f=f'{O}/exp-mercury-{nm}.jpg'
    if os.path.exists(f): im=Image.open(f).convert('RGB'); im.thumbnail((720,1280)); A[f'exp-mercury-{nm}']=uri(im,76)

# Sapon (M-R333): the first oshi's works on every planet (pictures in out/sapon/, sounds and the MV loop in design/home/sapon/)
for f in sorted(_g.glob(f'{O}/sapon/*.jpg')):
    k='sap-'+os.path.basename(f)[:-4]; im=Image.open(f).convert('RGB'); im.thumbnail((600,600)); A[k]=uri(im,76)
f=f'{O}/sushi/salmon-ref2.jpg'
if os.path.exists(f): o=cleancut(Image.open(f)); o.thumbnail((600,600),Image.LANCZOS); A['sap-game']=uri(o,90)
for f in sorted(_g.glob(H+'/sapon/*')):
    b=os.path.basename(f); k='sap-'+b.rsplit('.',1)[0]; mt={'mp3':'audio/mpeg','mp4':'video/mp4'}.get(b.rsplit('.',1)[1])
    if mt: A[k]=f'data:{mt};base64,'+base64.b64encode(open(f,'rb').read()).decode()
VD=os.environ.get('VOICE_DIR')
if VD:
    for n in range(1,6):
        f=f'{VD}/line-{n:02d}.mp3'
        if os.path.exists(f): A[f'voice-{n:02d}']='data:audio/mpeg;base64,'+base64.b64encode(open(f,'rb').read()).decode()
        f=f'{VD}/stitle-{n}.mp3'
        if os.path.exists(f): A[f'stitle-{n}']='data:audio/mpeg;base64,'+base64.b64encode(open(f,'rb').read()).decode()
        f=f'{VD}/title-{n}.mp3'
        if os.path.exists(f): A[f'vtitle-{n}']='data:audio/mpeg;base64,'+base64.b64encode(open(f,'rb').read()).decode()
# Saturn side-view stage (M-R300): flat backdrop + level pebble ground + speaker walls
f=f'{O}/sat7-bg.jpg'
if os.path.exists(f): im=Image.open(f).convert('RGB'); im.thumbnail((720,1280)); A['bg7-saturn']=uri(im,78)
f=f'{O}/sat6-bg.jpg'
if os.path.exists(f): im=Image.open(f).convert('RGB'); im.thumbnail((720,1280)); A['bg6-saturn']=uri(im,78)
f=f'{O}/sat6-floor.jpg'
if os.path.exists(f):
    o=unwhite(Image.open(f)); bb=o.getbbox(); o=o.crop(bb) if bb else o; o.thumbnail((1200,600),Image.LANCZOS)
    w_,h_=o.size; top=int(h_*.3); body=o.crop((0,top,w_,h_)); bh=body.size[1]; ov=int(bh*.35)
    canvas=Image.new('RGBA',(w_,h_+2*(bh-ov)),(0,0,0,0)); canvas.paste(o,(0,0),o); y=h_-ov
    grad=Image.linear_gradient('L').resize((w_,ov)); 
    for k in range(2):
        piece=body.transpose(Image.FLIP_LEFT_RIGHT) if k%2==0 else body.copy(); m=Image.new('L',piece.size,255); m.paste(grad,(0,0)); 
        canvas.paste(piece,(0,y),m); y+=bh-ov
    A['sat6-floor']=uri(canvas,82)
f=f'{O}/sat6-spk.jpg'
if os.path.exists(f):
    o=unwhite(Image.open(f)); bb=o.getbbox(); o=o.crop(bb) if bb else o; o.thumbnail((300,600),Image.LANCZOS); A['sat6-spk']=uri(o,84)
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
# slim the inline page: big pictures are re-encoded smaller so every planet fits under the 16MB page limit
DROP={'bg7-saturn','exp-mercury-map','rec-top','bg2-saturn-top'}
# SKY_KEEP=saturn,jupiter,mercury : keep the sky pictures of these planets only (the prototype is split into two pages)
_SK=os.environ.get('SKY_KEEP')
if _SK:
    _keep=set(_SK.split(','))
    for k in list(A):
        if (k.startswith('exp-') or k.startswith('isl-')) and k.split('-')[1] not in _keep: del A[k]
for k in list(A):
    if k in DROP: del A[k]
if not os.environ.get('EXTERN'):
    import re as _re2
    for k,v in list(A.items()):
        if not (isinstance(v,str) and v.startswith('data:image/webp;base64,')) or len(v)<40000: continue
        im=Image.open(io.BytesIO(base64.b64decode(v[23:]))); im.load()
        w,h=im.size; big=max(w,h)
        cap=int(os.environ.get('SKY_MAX','960')) if k.startswith('exp-') else 960
        if big>cap: im=im.resize((round(w*cap/big),round(h*cap/big)),Image.LANCZOS)
        elif big>360 and k.startswith('isl-'): im=im.resize((round(w*320/big),round(h*320/big)),Image.LANCZOS)
        b=io.BytesIO(); im.save(b,'WEBP',quality=(int(os.environ.get('SKY_Q','68')) if k.startswith('exp-') else 68) if im.mode=='RGB' else 74,method=6); nv='data:image/webp;base64,'+base64.b64encode(b.getvalue()).decode()
        if len(nv)<len(v): A[k]=nv
# EXTERN=1: pictures and sounds go to files next to the page (a/<key>.<ext>) instead of being inlined, so the page stays small
if os.environ.get('EXTERN'):
    import re as _re
    AD=os.path.join(os.path.dirname(os.path.abspath(os.environ.get('OUT_HTML') or H+'/home-inline.html')),'a'); os.makedirs(AD,exist_ok=True)
    for k,v in list(A.items()):
        m=_re.match(r'data:(image|audio)/([a-z0-9.+-]+);base64,',v) if isinstance(v,str) else None
        if not m or len(v)<6000: continue
        ext={'jpeg':'jpg','svg+xml':'svg','mpeg':'mp3'}.get(m.group(2),m.group(2)); fn=_re.sub(r'[^A-Za-z0-9_-]','_',k)+'.'+ext
        raw=base64.b64decode(v[m.end():]); fp=os.path.join(AD,fn)
        if not (os.path.exists(fp) and open(fp,'rb').read()==raw): open(fp,'wb').write(raw)
        A[k]='a/'+fn

# the other Sushimon (M-R339): works in out/su/<k>/, sounds in design/home/sushi/<k>/, data in design/home/sushi/sushi.json
_SU=json.load(open(H+'/sushi/sushi.json')); _SUX={}
for k,c in _SU.items():
    for f in sorted(_g.glob(f'{O}/su/{k}/*.jpg')):
        im=Image.open(f).convert('RGB'); im.thumbnail((560,560)); A[f'su-{k}-'+os.path.basename(f)[:-4]]=uri(im,74)
    f=f'{O}/sushi/{k}-ref.jpg'
    if os.path.exists(f): o=cleancut(Image.open(f)); o.thumbnail((520,520),Image.LANCZOS); A[f'su-{k}-game']=uri(o,88)
    for f in sorted(_g.glob(f'{H}/sushi/{k}/*')):
        b=os.path.basename(f); mt={'mp3':'audio/mpeg','mp4':'video/mp4'}.get(b.rsplit('.',1)[-1])
        if mt: A[f'su-{k}-'+b.rsplit('.',1)[0]]=f'data:{mt};base64,'+base64.b64encode(open(f,'rb').read()).decode()
    ly=f'{H}/sushi/{k}/lyrics.json'
    _SUX[c['name']]=dict(k=k,p=f'su-{k}-',name=c['name'],saturn=c['saturn'],jupiter=c['jupiter'],song=c['song'],radio=c['radio'],goods=c['goods'],book=c['book'],pages=c['pages'],game=c['game'],kind=c['gameKind'],goodsImg='goods',goodsVoice='goodsv',ly=json.load(open(ly)) if os.path.exists(ly) else [])
_ON=[x for x in os.environ.get('SUSHION','サーぽん').split(',') if x]
_ONK={('sapon' if n=='サーぽん' else _SUX[n]['k']) for n in _ON}
for _k in ['sapon']+list(_SU):
    if _k in _ONK: continue
    for key in list(A):
        if key.endswith('-'+_k) or key.startswith(f'su-{_k}-') or (_k=='sapon' and key.startswith('sap-')): A.pop(key,None)
for _k in os.environ.get('SAP_DROP','').split(','):
    A.pop(_k,None)
t=open(H+'/template.html').read().replace('/*ASSETS*/{}',json.dumps(A)).replace('/*SUSHI*/{}',json.dumps({n:v for n,v in _SUX.items() if n in _ON},ensure_ascii=False)).replace("/*SUSHION*/['サーぽん']",json.dumps(_ON,ensure_ascii=False))
if os.environ.get('PAGELINK'): t=t.replace('/*PAGELINK*/null',os.environ['PAGELINK'])
if os.environ.get('PAGETITLE'): t=t.replace('<title>星のホーム</title>','<title>'+os.environ['PAGETITLE']+'</title>')
open(os.environ.get('OUT_HTML') or H+'/home-inline.html','w').write(t); print(len(A),'assets',round(len(t)/1e6,2),'MB')
