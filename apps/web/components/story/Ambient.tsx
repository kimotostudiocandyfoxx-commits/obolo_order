'use client';

/**
 * Ambient — the living background of a story scene from day 3 on (the row scenes): the sky moves a little behind the
 * figures, and a light, planet-like effect drifts in front of them. What each planet shows is data
 * (lib/story/ambient.ts, the story team's spec of 2026-11-23); this file only draws it.
 *
 * ── Mount API ─────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 *   <AmbientSky   {...props} />   behind the figures, over the background picture
 *   <AmbientFront {...props} />   in front of the figures, under the subtitles / UI
 *   <Ambient      {...props} />   both, stacked in one box (review pages; not for the row, where figures go between)
 *
 *   props (AmbientProps):
 *     planet       Planet ('moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'sun'
 *                  | 'pluto' | 'earth' | 'space'); planetOf(sceneId, still) in lib/story/ambient.ts finds it
 *     sceneId      the script scene ('D04-S003', 'M-PLUTO-S001' …) for per-scene overrides; null is fine
 *     plate?       { src, horizonY?, floorY?, skyMask?, aspect? } the picture behind: a plate (lib/onboarding/plates.ts)
 *                  or a still ('/onboarding/s/moon-temple.jpg'). Its file name picks the still's entry (painted objects,
 *                  sky rule; 'plate-<still>' counts as <still>). horizonY (0..1 of its height) bounds the sky; skyMask
 *                  = a grey PNG of the same aspect, white = sky (else the mask is computed in the browser from the
 *                  picture: above the horizon + a luminance/colour rule + a feathered edge). Without a plate the sky
 *                  layer draws its effects over the whole box (no mask, no parallax copy, no painted-object motion).
 *     camera?      { x, y, scale } the row camera: x/y = its pan in CSS px (the translate the row/plate gets), scale = its
 *                  zoom. The sky copy moves against it by a few px (parallax, clamped to ±8 px); the front particles
 *                  move with it a little, the near ones more.
 *     intensity?   0..1.5 (default 1): scales every alpha and the particle counts
 *     paused?      stop the clock (the loops also stop by themselves while the tab is hidden)
 *     avoid?       boxes the front layer keeps clear: [{ x, y, w, h }] in fractions of its box — the figures' head boxes
 *                  (and anything else); the lower third (subtitles) is always kept clear (see subtitleTop)
 *     subtitleTop? where the subtitles' area starts (fraction of the front box's height, default 0.64): nothing in
 *                  front is drawn below it, and it fades out over the 0.1 above
 *     fit?         how the sky box holds the picture: 'fill' (default when the box is exactly the plate image's box —
 *                  mount AmbientSky inside the same transformed wrapper as the plate <img>, sized like the img) or
 *                  'cover' (the box is larger/smaller; the picture covers it like object-fit: cover at `position`)
 *     position?    [x, y] 0..1 for fit 'cover' (default [0.5, 0.5]; TalkScene's place uses [0.5, 0.3])
 *     plateRect?   front layer only: where the picture is, in px of the front box ({ left, top, width, height }), so the
 *                  lamp / neon glows sit on their lamps; default = the picture covering the front box (fit cover)
 *     still?       a still id ('s/moon-temple') when there is no plate src: used for the lookup and as the picture
 *     quality?     'auto' (default: the sky steps down its resolution / frame rate when frames run long, and draws
 *                  rarely on a software GL) or 'full' (pinned to the top step: review captures only)
 *
 * Mounting in the row (TalkScene): AmbientSky as the plate <img>'s sibling inside the plate's wrapper (fit 'fill' on a
 * box of the img's size and place, z just above the img), so the camera that moves the plate moves it too;
 * AmbientFront in screen space between the figures (z 6) and the subtitles/UI, with `avoid` = the figures' head boxes.
 *
 * Rules kept here: transforms and opacity only in the DOM; DPR capped at 2 (and the sky shader's pixel budget capped);
 * the sky at ~30 fps, the front at the display's rate; prefers-reduced-motion = one still frame; the loop stops while
 * hidden or paused; the WebGL context is lost and freed on unmount. The sky is one WebGL full-screen quad with a small
 * noise shader (no libraries); canvas2D fallback when WebGL is missing.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ambientFor, rgb, stillKey, type Ambient as AmbientDef, type FrontLayer, type Planet, type SkyLayer, type SkyMaskRule, type Sprite } from '@/lib/story/ambient';

export type AmbientPlate = { src: string; horizonY?: number; floorY?: number; skyMask?: string; aspect?: number };
export type AmbientCamera = { x: number; y: number; scale: number };
export type AmbientBox = { x: number; y: number; w: number; h: number };
export type AmbientProps = {
  planet: Planet;
  sceneId: string | null;
  plate?: AmbientPlate;
  camera?: AmbientCamera;
  intensity?: number;
  paused?: boolean;
  avoid?: AmbientBox[];
  subtitleTop?: number;
  fit?: 'fill' | 'cover';
  position?: [number, number];
  plateRect?: { left: number; top: number; width: number; height: number };
  still?: string;
  quality?: 'auto' | 'full';
};

const DPR_CAP = 2;
/** the sky shader's pixel budget (CSS px × DPR × scale ≤ this) */
const SKY_PIXELS = 300_000;
const SKY_FPS = 30;
/**
 * the sky's quality steps (the governor below steps down when frames run long, and starts at the bottom on a software
 * GL): [resolution scale, fps]; the last step only redraws every 2 s
 */
const SKY_STEPS: [number, number][] = [[1, SKY_FPS], [0.6, SKY_FPS], [0.4, 15], [0.3, 0.5]];

// ---------------------------------------------------------------------------------------------------------------
// shared bits
// ---------------------------------------------------------------------------------------------------------------
function usePrefersReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return r;
}

function useHidden() {
  const [h, setH] = useState(false);
  useEffect(() => {
    const on = () => setH(document.visibilityState === 'hidden');
    on();
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return h;
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** a clock that runs only while `running`; t in seconds, kept across pauses */
function makeClock() {
  let acc = 0;
  let last = -1;
  return {
    tick(now: number, running: boolean) {
      if (running && last >= 0) acc += Math.min(0.1, (now - last) / 1000);
      last = running ? now : -1;
      return acc;
    },
  };
}

function srcOf(p: AmbientProps): string | null {
  if (p.plate?.src) return p.plate.src;
  if (!p.still) return null;
  const id = p.still.includes('/') ? p.still : `s/${p.still}`;
  return `/onboarding/${id}.jpg`;
}

function useAmbient(p: AmbientProps): AmbientDef {
  const key = stillKey(p.plate?.src ?? p.still ?? null);
  return useMemo(() => ambientFor(p.planet, key, p.sceneId), [p.planet, key, p.sceneId]);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** the picture's box inside a box of w×h */
function pictureRect(w: number, h: number, aspect: number, fit: 'fill' | 'cover', pos: [number, number]) {
  if (fit === 'fill') return { left: 0, top: 0, width: w, height: h };
  const s = Math.max(w / aspect, h); // height of the picture
  const width = s * aspect;
  return { left: (w - width) * pos[0], top: (h - s) * pos[1], width, height: s };
}

// ---------------------------------------------------------------------------------------------------------------
// the sky mask (image space, small): white alpha = sky
// ---------------------------------------------------------------------------------------------------------------
const MASK_W = 96;

/** computed in the browser: above the horizon, the pixels the rule keeps, a feathered edge */
export function computeSkyMask(img: HTMLImageElement, rule: SkyMaskRule, horizonY?: number): HTMLCanvasElement {
  const mw = MASK_W;
  const mh = Math.max(8, Math.round((MASK_W * img.naturalHeight) / img.naturalWidth));
  const c = document.createElement('canvas');
  c.width = mw;
  c.height = mh;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, mw, mh);
  const d = g.getImageData(0, 0, mw, mh);
  const px = d.data;
  const y = horizonY ?? rule.y;
  const t = rule.t ?? 0.3;
  const m = new Float32Array(mw * mh);
  for (let j = 0; j < mh; j++) {
    const v = (j + 0.5) / mh;
    const vert = 1 - smooth(y - 0.06, y + 0.01, v);
    if (vert <= 0) continue;
    for (let i = 0; i < mw; i++) {
      const k = (j * mw + i) * 4;
      const r = px[k] / 255;
      const gg = px[k + 1] / 255;
      const b = px[k + 2] / 255;
      const lum = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
      let keep = 1;
      if (rule.keep === 'dark') keep = 1 - smooth(t * 0.7, t * 1.3, lum);
      else if (rule.keep === 'bright') keep = smooth(t * 0.85, t * 1.15, lum);
      else if (rule.keep === 'notdark') keep = smooth(t * 0.7, t * 1.3, lum);
      else if (rule.keep === 'cool') keep = smooth(0.0, 0.12, b - Math.max(r * 0.85, gg));
      m[j * mw + i] = vert * keep;
    }
  }
  // feather: two box blurs (radius 2)
  const tmp = new Float32Array(m.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < mh; j++)
      for (let i = 0; i < mw; i++) {
        let s = 0;
        let n = 0;
        for (let o = -2; o <= 2; o++) {
          const ii = i + o;
          if (ii >= 0 && ii < mw) (s += m[j * mw + ii]), n++;
        }
        tmp[j * mw + i] = s / n;
      }
    for (let j = 0; j < mh; j++)
      for (let i = 0; i < mw; i++) {
        let s = 0;
        let n = 0;
        for (let o = -2; o <= 2; o++) {
          const jj = j + o;
          if (jj >= 0 && jj < mh) (s += tmp[jj * mw + i]), n++;
        }
        m[j * mw + i] = s / n;
      }
  }
  for (let k = 0; k < m.length; k++) {
    px[k * 4] = px[k * 4 + 1] = px[k * 4 + 2] = 255;
    px[k * 4 + 3] = Math.round(Math.min(1, m[k]) * 255);
  }
  g.putImageData(d, 0, 0);
  return c;
}

/** a hand-made mask (grey, white = sky) → the same white-alpha canvas */
function maskFromImage(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = MASK_W;
  c.height = Math.max(8, Math.round((MASK_W * img.naturalHeight) / img.naturalWidth));
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let k = 0; k < d.data.length; k += 4) {
    d.data[k + 3] = d.data[k];
    d.data[k] = d.data[k + 1] = d.data[k + 2] = 255;
  }
  g.putImageData(d, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------------------------------------------
// the sky shader
// ---------------------------------------------------------------------------------------------------------------
const MAX_LAYERS = 6;
const KIND: Record<SkyLayer['kind'], number> = { stars: 1, aurora: 2, clouds: 3, haze: 4, bands: 5, komorebi: 6, glow: 7, flares: 8, ripples: 9, ring: 10, river: 11, ufo: 12, lightning: 13 };

const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_res;uniform float u_t;uniform vec4 u_rect;uniform float u_asp;uniform float u_hasImg;
uniform sampler2D u_mask;uniform sampler2D u_img;
uniform vec4 u_a[${MAX_LAYERS}];uniform vec4 u_b[${MAX_LAYERS}];uniform vec4 u_c[${MAX_LAYERS}];uniform vec4 u_d[${MAX_LAYERS}];uniform float u_k[${MAX_LAYERS}];
float h21(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+vec2(17.1,9.2);a*=.5;}return s;}
float band(float v,float y0,float y1){return smoothstep(y0-.05,y0+.02,v)*(1.-smoothstep(y1-.08,y1,v));}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float starf(vec2 q,float dens,float tw,float sz,float t){vec2 c=floor(q),f=fract(q);float h=h21(c);if(h>dens)return 0.;
 vec2 o=vec2(h21(c+3.7),h21(c+9.1))*.7+.15;float d=length(f-o);float b=.55+.45*sin(t*tw*6.283*(.5+h21(c+1.3))+h*40.);
 return smoothstep(.09*sz,0.,d)*b*(.4+.6*h21(c+5.5));}
void main(){
 vec2 s=vec2(gl_FragCoord.x/u_res.x,1.-gl_FragCoord.y/u_res.y);
 vec2 uv=(s-u_rect.xy)/u_rect.zw;
 if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.){gl_FragColor=vec4(0.);return;}
 vec2 p=vec2(uv.x,uv.y*u_asp);
 float m=texture2D(u_mask,uv).a;
 vec3 im=texture2D(u_img,uv).rgb;float lum=mix(.3,dot(im,vec3(.2126,.7152,.0722)),u_hasImg);
 float dark=1.-smoothstep(.2,.55,lum);
 vec3 C=vec3(0.);float A=0.;float t=u_t;
 for(int i=0;i<${MAX_LAYERS};i++){
  float k=u_k[i];if(k<.5)break;
  vec4 a=u_a[i],b=u_b[i],c=u_c[i],d=u_d[i];
  float w=b.w>.5?m:1.;if(w<.003)continue;
  vec3 e=vec3(0.);float oa=0.;vec3 oc=a.rgb;
  if(k<1.5){ // stars
   vec2 q=(p+d.xy*t)*90.;e=a.rgb*starf(q,c.x*.6,c.y,c.z,t)*dark;
  }else if(k<2.5){ // aurora
   float x=p.x,sp=c.z;
   float yb=c.x+.035*sin(x*3.1+t*sp*2.)+.06*(vn(vec2(x*2.2+t*sp,t*sp*.4))-.5);
   float dd=yb-uv.y;
   float sh=dd>0.?exp(-dd/c.y*2.2):exp(dd/.012);
   float rays=.45+.55*vn(vec2(x*38.+t*sp*2.5,dd*3.));
   float fold=.55+.45*vn(vec2(x*3.5-t*sp*.8,7.));
   e=mix(a.rgb,b.rgb,clamp(dd/c.y,0.,1.))*sh*rays*fold;
  }else if(k<3.5){ // clouds
   float n=fbm((p+c.zw*0.+d.xy*t)*c.x+vec2(0.,t*.002));
   float dn=smoothstep(1.-c.y,1.-c.y+.35,n);
   oa=dn*band(uv.y,c.z,c.w);oc=a.rgb*(.82+.3*n);
  }else if(k<4.5){ // haze
   float n=fbm((p+d.xy*t)*c.x);oa=(.35+.65*n)*band(uv.y,c.z,c.w);
  }else if(k<5.5){ // bands
   float v=uv.y;float x=p.x+t*c.y*(1.+.6*sin(v*37.));
   float n=fbm(vec2(x*3.,v*22.));float st=.5+.5*sin((v+.025*n)*c.x*70.);
   oa=band(v,c.z,c.w)*(.4+.6*n);oc=mix(b.rgb,a.rgb,st);
  }else if(k<6.5){ // komorebi
   float n=fbm(p*c.x+vec2(t*c.y*.3,t*c.y*.21))*.6+fbm(p*c.x*1.7-vec2(t*c.y*.17,0.))*.4;
   e=a.rgb*smoothstep(.48,.72,n)*smoothstep(.35,.85,lum);
  }else if(k<7.5){ // glow
   float g=d.x>.5?exp(-pow(length(p-vec2(c.z,c.w*u_asp))/max(c.y,.01),2.)*2.):smoothstep(.5,.9,lum);
   float u=.5+.5*sin(t*c.x*6.283+fbm(p*3.+t*.05)*5.);e=a.rgb*g*u;
  }else if(k<8.5){ // flares
   vec2 r=p-vec2(c.x,c.y*u_asp);float rl=length(r);float an=atan(r.y,r.x);
   float n=fbm(vec2(an*2.6,rl*9.-t*c.w*9.));float up=.55+.45*clamp(-r.y/max(rl,.001),0.,1.);
   e=a.rgb*smoothstep(.5,.82,n)*exp(-max(rl-c.z,0.)/(c.z*1.3))*smoothstep(c.z*.8,c.z*1.05,rl)*up;
  }else if(k<9.5){ // ripples
   vec2 r=p-vec2(c.x,c.y*u_asp);r.y/=max(d.y,.05);float rl=length(r);
   float ph=(rl-t*c.z)/c.w;float ring=pow(.5+.5*cos(ph*6.283),14.);
   e=a.rgb*ring*(1.-smoothstep(0.,d.x,rl))*smoothstep(0.,c.w*.6,rl);
  }else if(k<10.5){ // ring
   vec2 r0=p-vec2(c.x,c.y*u_asp);vec2 r=rot(-d.x)*r0;
   float el=length(vec2(r.x/c.z,r.y/c.w));
   float bd=smoothstep(.6,.7,el)*(1.-smoothstep(.96,1.04,el));
   float th=atan(r.y/c.w,r.x/c.z);
   float gl=pow(.5+.5*cos(th-t*d.y*6.283),16.);
   float gr=vn(vec2(th*26.-t*d.y*30.,el*36.));
   float occ=(r.y<0.&&length(r0)<d.z)?0.:1.;
   e=a.rgb*(gl*.7+gr*.25)*bd*occ*smoothstep(.35,.75,lum);
  }else if(k<11.5){ // river
   vec2 r=rot(-c.z)*(p-vec2(c.x,c.y*u_asp));float bnd=exp(-pow(r.y/c.w,2.)*3.);
   vec2 q=vec2(r.x-t*d.x,r.y);
   float st=starf(q*140.,.5,.4,.8,t)+starf(q*70.+3.,.25,.25,1.,t);
   e=a.rgb*(st+.35*fbm(q*vec2(5.,9.)))*bnd*dark;
  }else if(k<12.5){ // ufo
   float P=c.z;float cy=floor(t/P);float f=fract(t/P)/.22;
   if(f<1.){float dir=h21(vec2(cy,2.))>.5?1.:-1.;float x=dir>0.?mix(-.1,1.1,f):mix(1.1,-.1,f);
    float y=mix(c.x,c.y,h21(vec2(cy,5.)))+.006*sin(f*30.);vec2 o=vec2(x,y*u_asp);float dl=length(p-o);
    float tr=exp(-pow((p.y-o.y)/.003,2.))*exp(-max((o.x-p.x)*dir,0.)*60.)*step(0.,(o.x-p.x)*dir);
    e=a.rgb*((exp(-dl*dl/.00002)+.35*exp(-dl*dl/.0003))*(.75+.25*sin(t*18.))+tr*.25);}
  }else{ // lightning
   float P=d.x;float cy=floor(t/P);float f=(t-cy*P);
   float env=exp(-f*11.)+.75*step(.17,f)*exp(-max(f-.17,0.)*13.);
   if(env>.01){float bx=mix(c.x,c.y,h21(vec2(cy,1.)));
    float yy=clamp((uv.y-c.z)/(c.w-c.z),0.,1.);
    float xb=bx+.05*(fbm(vec2(uv.y*9.,cy*3.))-.5)*2.+.012*(vn(vec2(uv.y*40.,cy))-.5);
    float bolt=exp(-abs(uv.x-xb)*700.)*step(c.z,uv.y)*step(uv.y,c.w)*(1.-yy*.5);
    float fl=(1.-smoothstep(0.,.4,length(vec2(uv.x-bx,(uv.y-(c.z+c.w)*.5)*.7))));
    e=a.rgb*env*(bolt*1.2+fl*.35);}
  }
  float al=a.w*w;
  if(oa>0.){float q=oa*al;C=oc*q+C*(1.-q);A=q+A*(1.-q);}
  C+=e*al;
 }
 gl_FragColor=vec4(C,A);
}`;

type GL = WebGLRenderingContext;

function packLayers(layers: SkyLayer[], intensity: number, hasMask: boolean) {
  const a = new Float32Array(MAX_LAYERS * 4);
  const b = new Float32Array(MAX_LAYERS * 4);
  const c = new Float32Array(MAX_LAYERS * 4);
  const d = new Float32Array(MAX_LAYERS * 4);
  const k = new Float32Array(MAX_LAYERS);
  layers.slice(0, MAX_LAYERS).forEach((l, i) => {
    const o = i * 4;
    const col = rgb(l.color);
    a.set([...col, l.alpha * intensity], o);
    b[o + 3] = l.mask !== false && hasMask ? 1 : 0;
    k[i] = KIND[l.kind];
    const deg = Math.PI / 180;
    switch (l.kind) {
      case 'stars': c.set([l.density, l.twinkle, l.size ?? 1, 0], o); d.set([l.drift?.[0] ?? 0, l.drift?.[1] ?? 0, 0, 0], o); break;
      case 'aurora': b.set(rgb(l.color2), o); c.set([l.y, l.height, l.speed, 0], o); break;
      case 'clouds': c.set([l.scale, l.cover, l.y0, l.y1], o); d.set([l.speed[0], l.speed[1], 0, 0], o); break;
      case 'haze': c.set([l.scale, 0, l.y0, l.y1], o); d.set([l.speed[0], l.speed[1], 0, 0], o); break;
      case 'bands': b.set(rgb(l.color2), o); c.set([l.scale, l.speed, l.y0, l.y1], o); break;
      case 'komorebi': c.set([l.scale, l.speed, 0, 0], o); break;
      case 'glow': c.set([l.speed, l.radius ?? 0.3, l.at?.[0] ?? 0, l.at?.[1] ?? 0], o); d[o] = l.at ? 1 : 0; break;
      case 'flares': c.set([l.at[0], l.at[1], l.radius, l.speed], o); break;
      case 'ripples': c.set([l.at[0], l.at[1], l.speed, l.spacing], o); d.set([l.reach, l.flat, 0, 0], o); break;
      case 'ring': c.set([l.at[0], l.at[1], l.rx, l.ry], o); d.set([l.angle * deg, l.speed, l.planetR, 0], o); break;
      case 'river': c.set([l.at[0], l.at[1], l.angle * deg, l.width], o); d[o] = l.speed; break;
      case 'ufo': c.set([l.y0, l.y1, l.period, 0], o); break;
      case 'lightning': c.set([l.x0, l.x1, l.y0, l.y1], o); d[o] = l.period; break;
    }
  });
  return { a, b, c, d, k };
}

/** one WebGL sky: returns draw/resize/dispose, or null when WebGL is not there */
function createSkyGL(canvas: HTMLCanvasElement) {
  const gl = (canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }) ??
    canvas.getContext('experimental-webgl')) as GL | null;
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };
  let prog: WebGLProgram;
  let vs: WebGLShader, fs: WebGLShader;
  try {
    vs = sh(gl.VERTEX_SHADER, VERT);
    fs = sh(gl.FRAGMENT_SHADER, FRAG);
    prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
  } catch (e) {
    console.warn('[ambient] WebGL sky failed, using the canvas fallback', e);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n: string) => gl.getUniformLocation(prog, n);
  const u = { res: U('u_res'), t: U('u_t'), rect: U('u_rect'), asp: U('u_asp'), hasImg: U('u_hasImg'), mask: U('u_mask'), img: U('u_img'), a: U('u_a'), b: U('u_b'), c: U('u_c'), d: U('u_d'), k: U('u_k') };
  const tex = (unit: number) => {
    const t = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    return t;
  };
  const maskTex = tex(0);
  const imgTex = tex(1);
  gl.uniform1i(u.mask, 0);
  gl.uniform1i(u.img, 1);
  gl.uniform1f(u.hasImg, 0);
  gl.clearColor(0, 0, 0, 0);
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  return {
    /** a GL drawn by the CPU (SwiftShader, llvmpipe …): the sky is drawn rarely and small there */
    software: /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer),
    setMask(src: TexImageSource) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, maskTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    },
    setImage(src: TexImageSource) {
      // a small copy is plenty: it is only read for its brightness
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = Math.round(256 * ((src as HTMLImageElement).naturalHeight / (src as HTMLImageElement).naturalWidth || 1.78));
      c.getContext('2d')!.drawImage(src as CanvasImageSource, 0, 0, c.width, c.height);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.uniform1f(u.hasImg, 1);
    },
    setLayers(p: ReturnType<typeof packLayers>) {
      gl.uniform4fv(u.a, p.a);
      gl.uniform4fv(u.b, p.b);
      gl.uniform4fv(u.c, p.c);
      gl.uniform4fv(u.d, p.d);
      gl.uniform1fv(u.k, p.k);
    },
    draw(t: number, rect: [number, number, number, number], asp: number) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.t, t);
      gl.uniform4f(u.rect, ...rect);
      gl.uniform1f(u.asp, asp);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteTexture(maskTex);
      gl.deleteTexture(imgTex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

/** the canvas2D fallback: stars, and soft blobs of each layer's colour drifting, clipped to the mask */
function createSky2D(canvas: HTMLCanvasElement) {
  const g = canvas.getContext('2d');
  if (!g) return null;
  let mask: HTMLCanvasElement | null = null;
  let layers: SkyLayer[] = [];
  let intensity = 1;
  const rnd = (i: number) => {
    const x = Math.sin(i * 127.1) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    setMask(m: HTMLCanvasElement) {
      mask = m;
    },
    setImage() {},
    set(l: SkyLayer[], k: number) {
      layers = l;
      intensity = k;
    },
    draw(t: number, rect: [number, number, number, number]) {
      const W = canvas.width;
      const H = canvas.height;
      g.clearRect(0, 0, W, H);
      const [rx, ry, rw, rh] = [rect[0] * W, rect[1] * H, rect[2] * W, rect[3] * H];
      g.globalCompositeOperation = 'lighter';
      for (const l of layers) {
        const [r, gg, b] = rgb(l.color).map((v) => Math.round(v * 255));
        const a = l.alpha * intensity;
        if (l.kind === 'stars' || l.kind === 'river') {
          for (let i = 0; i < 70; i++) {
            const tw = 0.55 + 0.45 * Math.sin(t * 2 + i * 7.3);
            g.fillStyle = `rgba(${r},${gg},${b},${a * tw * 0.8})`;
            g.fillRect(rx + rnd(i) * rw, ry + rnd(i + 99) * rh * 0.6, 1.5, 1.5);
          }
        } else if (l.kind !== 'ufo' && l.kind !== 'lightning') {
          for (let i = 0; i < 5; i++) {
            const x = rx + ((rnd(i + 7) * rw + t * 4 * (i + 1)) % (rw * 1.2)) - rw * 0.1;
            const y = ry + rh * (0.08 + rnd(i + 13) * 0.35);
            const rad = rw * (0.18 + rnd(i + 3) * 0.2);
            const gr = g.createRadialGradient(x, y, 0, x, y, rad);
            gr.addColorStop(0, `rgba(${r},${gg},${b},${a * 0.25 * (0.6 + 0.4 * Math.sin(t * 0.5 + i))})`);
            gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
            g.fillStyle = gr;
            g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
          }
        }
      }
      if (mask) {
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(mask, rx, ry, rw, rh);
      }
      g.globalCompositeOperation = 'source-over';
    },
    dispose() {},
  };
}

// ---------------------------------------------------------------------------------------------------------------
// AmbientSky
// ---------------------------------------------------------------------------------------------------------------
export function AmbientSky(props: AmbientProps) {
  const { camera, intensity = 1, paused = false, fit = 'fill', position = [0.5, 0.5], quality = 'auto' } = props;
  const def = useAmbient(props);
  const src = srcOf(props);
  const reduced = usePrefersReducedMotion();
  const hidden = useHidden();
  const [box, size] = useSize<HTMLDivElement>();
  const holderRef = useRef<HTMLDivElement>(null);
  const driftRef = useRef<HTMLDivElement>(null);
  const regionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [maskUrl, setMaskUrl] = useState<string | null>(null);
  const maskCanvas = useRef<HTMLCanvasElement | null>(null);
  const camRef = useRef(camera);
  camRef.current = camera;

  // the picture and its mask
  useEffect(() => {
    let dead = false;
    setImg(null);
    setMaskUrl(null);
    maskCanvas.current = null;
    if (!src) return;
    (async () => {
      try {
        const im = await loadImage(src);
        let m: HTMLCanvasElement;
        if (props.plate?.skyMask) m = maskFromImage(await loadImage(props.plate.skyMask));
        else m = computeSkyMask(im, def.skyMask, props.plate?.horizonY);
        if (dead) return;
        maskCanvas.current = m;
        setImg(im);
        setMaskUrl(m.toDataURL('image/png'));
      } catch {
        /* no picture: effects only */
      }
    })();
    return () => {
      dead = true;
    };
  }, [src, def.skyMask, props.plate?.skyMask, props.plate?.horizonY]);

  const aspect = img ? img.naturalWidth / img.naturalHeight : (props.plate?.aspect ?? 9 / 16);
  const pr = pictureRect(size.w, size.h, aspect, fit, position);

  // the WebGL (or 2D) sky
  useEffect(() => {
    const holder = holderRef.current;
    if (!holder || !size.w || !size.h) return;
    // a fresh canvas each time: a canvas whose context was lost cannot give a new one
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    holder.appendChild(canvas);
    const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    const base = Math.min(1, Math.sqrt(SKY_PIXELS / (size.w * size.h * dpr * dpr)));
    const fitCanvas = (q: number) => {
      canvas.width = Math.max(1, Math.round(size.w * dpr * base * q));
      canvas.height = Math.max(1, Math.round(size.h * dpr * base * q));
    };
    fitCanvas(1);
    const gl = createSkyGL(canvas);
    const g2 = gl ? null : createSky2D(canvas);
    const hasMask = !!maskCanvas.current;
    if (gl) {
      if (maskCanvas.current) gl.setMask(maskCanvas.current);
      if (img) gl.setImage(img);
      gl.setLayers(packLayers(def.sky, intensity, hasMask));
    } else if (g2) {
      if (maskCanvas.current) g2.setMask(maskCanvas.current);
      g2.set(def.sky, intensity);
    }
    // the governor: frames longer than ~28 ms on average (30 frames) step the sky down; a software GL starts at the bottom
    let step = gl?.software && quality === 'auto' ? SKY_STEPS.length - 1 : 0;
    if (step) fitCanvas(SKY_STEPS[step][0]);
    let acc = 0;
    let count = 0;
    let prev = -1;
    const rect: [number, number, number, number] = [pr.left / size.w, pr.top / size.h, pr.width / size.w, pr.height / size.h];
    const asp = 1 / aspect;
    const clock = makeClock();
    const running = !paused && !hidden && !reduced;
    let raf = 0;
    let lastDraw = -1e9;
    const drift = def.drift ?? 3;
    const frame = (now: number) => {
      const t = clock.tick(now, running) + (reduced ? 12 : 0);
      if (prev >= 0 && running) {
        acc += now - prev;
        if (++count === 30) {
          if (quality === 'auto' && acc / count > 28 && step < SKY_STEPS.length - 1) {
            step++;
            fitCanvas(SKY_STEPS[step][0]);
            lastDraw = -1e9;
          }
          acc = count = 0;
        }
      }
      prev = now;
      if (now - lastDraw >= 1000 / SKY_STEPS[step][1] - 2 || !running) {
        lastDraw = now;
        if (gl) gl.draw(t, rect, asp);
        else g2?.draw(t, rect);
      }
      // the sky copy: its own slow drift + the camera's parallax (a few px)
      const cam = camRef.current;
      const clamp = (v: number) => Math.max(-8, Math.min(8, v));
      if (driftRef.current) {
        const dx = drift * Math.sin((t * 2 * Math.PI) / 55) + clamp(-(cam?.x ?? 0) * 0.04);
        const dy = drift * 0.5 * Math.cos((t * 2 * Math.PI) / 70) + clamp(-(cam?.y ?? 0) * 0.04);
        driftRef.current.style.transform = `translate3d(${dx.toFixed(2)}px,${dy.toFixed(2)}px,0)`;
      }
      def.regions?.forEach((r, i) => {
        const el = regionRefs.current[i];
        if (!el) return;
        const ph = (t * 2 * Math.PI) / r.period;
        el.style.transform =
          r.motion === 'turn' ? `rotate(${(r.amp * Math.sin(ph)).toFixed(3)}deg)` : `translate3d(${(r.amp * Math.sin(ph)).toFixed(2)}px,${(r.amp * 0.6 * Math.cos(ph * 0.8)).toFixed(2)}px,0)`;
      });
      if (running) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      gl?.dispose();
      g2?.dispose();
      canvas.remove();
    };
    // pr is derived from size/aspect/fit/position
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h, img, maskUrl, def, intensity, paused, hidden, reduced, aspect, fit, position[0], position[1], quality]);

  const picStyle: CSSProperties = { position: 'absolute', left: pr.left, top: pr.top, width: pr.width, height: pr.height, backgroundImage: src ? `url("${src}")` : undefined, backgroundSize: '100% 100%' };
  return (
    <div ref={box} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" data-ambient="sky">
      {img && maskUrl && (
        <div ref={driftRef} style={{ ...picStyle, WebkitMaskImage: `url(${maskUrl})`, maskImage: `url(${maskUrl})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%', willChange: 'transform' }} />
      )}
      {img &&
        def.regions?.map((r, i) => {
          const R = r.r * pr.width;
          const cx = r.at[0] * pr.width;
          const cy = r.at[1] * pr.height;
          const m = `radial-gradient(circle ${R}px at ${cx}px ${cy}px, #000 0, #000 ${R * 0.66}px, transparent ${R}px)`;
          return (
            <div
              key={i}
              ref={(el) => {
                regionRefs.current[i] = el;
              }}
              style={{ ...picStyle, WebkitMaskImage: m, maskImage: m, transformOrigin: `${cx}px ${cy}px`, willChange: 'transform' }}
            />
          );
        })}
      <div ref={holderRef} className="absolute inset-0" />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// AmbientFront
// ---------------------------------------------------------------------------------------------------------------
type Particle = { x: number; y: number; z: number; s: number; ph: number; sp: number; rot: number };

const SPRITE_PX = 48;
/** a soft sprite of a colour; blur 0 (sharp) … 3 (soft, near) */
function makeSprite(kind: Sprite, color: string, blur: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE_PX;
  const g = c.getContext('2d')!;
  const [r, gg, b] = rgb(color).map((v) => Math.round(v * 255));
  const col = (a: number) => `rgba(${r},${gg},${b},${a})`;
  const h = SPRITE_PX / 2;
  const core = [0.32, 0.22, 0.12, 0.04][blur];
  if (kind === 'dot' || kind === 'glint') {
    const gr = g.createRadialGradient(h, h, 0, h, h, h);
    gr.addColorStop(0, col(1));
    gr.addColorStop(core, col(0.9));
    gr.addColorStop(Math.min(0.95, core + 0.3), col(0.25));
    gr.addColorStop(1, col(0));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(h, h, kind === 'glint' ? h * 0.5 : h, 0, Math.PI * 2);
    g.fill();
    if (kind === 'glint') {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const lg = g.createLinearGradient(h - dx * h, h - dy * h, h + dx * h, h + dy * h);
        lg.addColorStop(0, col(0));
        lg.addColorStop(0.5, col(0.9));
        lg.addColorStop(1, col(0));
        g.fillStyle = lg;
        const th = 1.2 + blur;
        g.fillRect(dx ? 0 : h - th / 2, dy ? 0 : h - th / 2, dx ? SPRITE_PX : th, dy ? SPRITE_PX : th);
      }
    }
  } else if (kind === 'fluff') {
    g.strokeStyle = col(0.55);
    g.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      g.beginPath();
      g.moveTo(h, h);
      g.lineTo(h + Math.cos(a) * h * 0.85, h + Math.sin(a) * h * 0.85);
      g.stroke();
      g.fillStyle = col(0.8);
      g.beginPath();
      g.arc(h + Math.cos(a) * h * 0.85, h + Math.sin(a) * h * 0.85, 1.6, 0, Math.PI * 2);
      g.fill();
    }
    const gr = g.createRadialGradient(h, h, 0, h, h, h * 0.4);
    gr.addColorStop(0, col(1));
    gr.addColorStop(1, col(0));
    g.fillStyle = gr;
    g.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
  } else if (kind === 'streak') {
    const lg = g.createLinearGradient(h, 0, h, SPRITE_PX);
    lg.addColorStop(0, col(0));
    lg.addColorStop(0.7, col(0.8));
    lg.addColorStop(1, col(0));
    g.fillStyle = lg;
    g.fillRect(h - 0.8 - blur * 0.4, 0, 1.6 + blur * 0.8, SPRITE_PX);
  } else if (kind === 'ring') {
    g.strokeStyle = col(0.85);
    g.lineWidth = 2.2 + blur;
    g.beginPath();
    g.arc(h, h, h * 0.7, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = col(0.9);
    g.beginPath();
    g.arc(h - h * 0.3, h - h * 0.3, h * 0.12, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function rotated45(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = src.width;
  const g = c.getContext('2d')!;
  g.translate(c.width / 2, c.height / 2);
  g.rotate(Math.PI / 4);
  g.drawImage(src, -c.width / 2, -c.height / 2);
  return c;
}

function radialSprite(color: string, soft = 0.0): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const [r, gg, b] = rgb(color).map((v) => Math.round(v * 255));
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  gr.addColorStop(0.25 + soft, `rgba(${r},${gg},${b},0.45)`);
  gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
}

function mistSprite(color: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  const [r, gg, b] = rgb(color).map((v) => Math.round(v * 255));
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 18; i++) {
    const x = 30 + rnd() * 196;
    const y = 20 + rnd() * 24;
    const rad = 14 + rnd() * 22;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${r},${gg},${b},0.35)`);
    gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return c;
}

const rand = (() => {
  let s = 12345;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
})();

export function AmbientFront(props: AmbientProps) {
  const { camera, intensity = 1, paused = false, avoid, subtitleTop = 0.64, plateRect } = props;
  const def = useAmbient(props);
  const reduced = usePrefersReducedMotion();
  const hidden = useHidden();
  const [box, size] = useSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef(camera);
  camRef.current = camera;
  const avoidRef = useRef(avoid);
  avoidRef.current = avoid;
  const rectRef = useRef(plateRect);
  rectRef.current = plateRect;
  const aspect = props.plate?.aspect ?? 9 / 16;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w || !size.h) return;
    const W = size.w;
    const H = size.h;
    const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const g = canvas.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = Math.max(0, intensity);

    // per layer: sprites + particles
    const layers = def.front.filter((l) => l.kind !== 'haze').map((l) => {
      if (l.kind === 'particles') {
        const sprites = [0, 1, 2, 3].map((b) => makeSprite(l.sprite, l.color, b));
        // spin: half of them turned 45° (pre-drawn; no per-frame rotation)
        const turned = l.spin ? sprites.map(rotated45) : sprites;
        const n = Math.round(l.count * Math.min(1.5, k));
        const y0 = l.y0 ?? 0.05;
        const y1 = Math.min(l.y1 ?? subtitleTop, subtitleTop + 0.05);
        const ps: Particle[] = Array.from({ length: n }, () => ({ x: rand(), y: y0 + rand() * (y1 - y0), z: rand(), s: l.size[0] + rand() * (l.size[1] - l.size[0]), ph: rand() * 6.283, sp: 0.6 + rand() * 0.8, rot: rand() * 6.283 }));
        return { l, sprites, turned, ps, y0, y1 };
      }
      if (l.kind === 'glows') return { l, sprites: [...new Set(l.at.map((p) => p[3] ?? l.color))].map((c) => [c, radialSprite(c)] as const) };
      if (l.kind === 'mist') return { l, sprites: [mistSprite(l.color)] };
      return { l };
    });
    const pic = () => rectRef.current ?? pictureRect(W, H, aspect, 'cover', [0.5, 0.5]);

    /** how much may be drawn at (x, y) in px: the lower third and the avoid boxes are kept clear */
    const clear = (x: number, y: number) => {
      let a = 1 - smooth(subtitleTop - 0.1, subtitleTop, y / H);
      if (a <= 0) return 0;
      const av = avoidRef.current;
      if (av)
        for (const b of av) {
          const dx = Math.max(b.x * W - x, 0, x - (b.x + b.w) * W);
          const dy = Math.max(b.y * H - y, 0, y - (b.y + b.h) * H);
          a *= smooth(0, 24, Math.hypot(dx, dy));
        }
      return a;
    };

    const clock = makeClock();
    const running = !paused && !hidden && !reduced;
    let raf = 0;
    let lastT = 0;
    const frame = (now: number) => {
      const t = clock.tick(now, running) + (reduced ? 12 : 0);
      const dt = Math.min(0.05, Math.max(0, t - lastT));
      lastT = t;
      g.clearRect(0, 0, W, H);
      const cam = camRef.current;
      for (const L of layers) {
        const l = L.l as FrontLayer;
        if (l.kind === 'particles' && 'ps' in L && L.ps) {
          g.globalCompositeOperation = l.sprite === 'streak' || l.sprite === 'ring' ? 'source-over' : 'lighter';
          // rain: one path per depth bucket (no sprite, no per-drop state change)
          const streak = l.sprite === 'streak';
          const dir = streak ? Math.atan2(l.speed[1], (l.speed[0] * W) / H) : 0;
          const ux = Math.cos(dir);
          const uy = Math.sin(dir);
          const paths = streak ? [new Path2D(), new Path2D()] : null;
          for (const p of L.ps) {
            const near = 1 - p.z; // 1 = nearest
            const vel = 0.55 + near * 0.9;
            p.x += (l.speed[0] * vel * p.sp * dt * H) / W;
            p.y += l.speed[1] * vel * p.sp * dt;
            // wrap
            if (p.x > 1.08) p.x -= 1.16;
            if (p.x < -0.08) p.x += 1.16;
            if (p.y > L.y1! + 0.04) p.y = L.y0! - 0.03;
            if (p.y < L.y0! - 0.04) p.y = L.y1! + 0.03;
            const sw = l.sway * Math.sin(t * 0.6 * p.sp + p.ph) * H;
            const px = p.x * W + sw + (cam ? cam.x * (0.15 + 0.3 * near) : 0);
            const py = p.y * H + (cam ? cam.y * (0.15 + 0.3 * near) : 0);
            const c = clear(px, py);
            if (c <= 0.05) continue;
            const s = p.s * (0.6 + 1.5 * near) * (l.sprite === 'glint' ? 2.4 : 2);
            if (paths) {
              const path = paths[near > 0.6 ? 0 : 1];
              path.moveTo(px - ux * s * 0.5, py - uy * s * 0.5);
              path.lineTo(px + ux * s * 0.5, py + uy * s * 0.5);
              continue;
            }
            const tw = l.twinkle ? 0.5 + 0.5 * Math.sin(t * l.twinkle * 4 * p.sp + p.ph) : 1;
            const glint = l.sprite === 'glint' ? tw * tw * tw : tw;
            const a = l.alpha * Math.min(1, k) * c * glint * (near > 0.75 ? 0.55 : 0.8 + 0.2 * p.z);
            if (a <= 0.01) continue;
            const blur = near > 0.8 ? 3 : near > 0.6 ? 2 : near > 0.3 ? 1 : 0;
            g.globalAlpha = a;
            g.drawImage((p.rot > 3.14 ? L.turned! : L.sprites!)[blur], px - s / 2, py - s / 2, s, s);
          }
          if (paths) {
            const [cr, cg, cb] = rgb(l.color).map((v) => Math.round(v * 255));
            g.strokeStyle = `rgb(${cr},${cg},${cb})`;
            g.lineCap = 'round';
            g.globalAlpha = l.alpha * Math.min(1, k) * 0.6;
            g.lineWidth = 1.6;
            g.stroke(paths[0]);
            g.globalAlpha = l.alpha * Math.min(1, k);
            g.lineWidth = 0.8;
            g.stroke(paths[1]);
          }
        } else if (l.kind === 'glows' && 'sprites' in L) {
          g.globalCompositeOperation = 'lighter';
          const r0 = pic();
          l.at.forEach(([x, y, r, col], i) => {
            const spr = (L.sprites as (readonly [string, HTMLCanvasElement])[]).find((s) => s[0] === (col ?? l.color))![1];
            const fl = 1 - l.flicker * (0.5 + 0.5 * Math.sin(t * 7.1 + i * 2.3) * Math.sin(t * 3.3 + i));
            const sw = l.sway * Math.sin(t * 0.9 + i * 1.7) * r0.width;
            const cx = r0.left + x * r0.width + sw;
            const cy = r0.top + y * r0.height;
            const c = clear(cx, cy);
            if (c <= 0.01) return;
            const R = r * r0.width;
            g.globalAlpha = l.alpha * Math.min(1, k) * fl * c;
            g.drawImage(spr, cx - R, cy - R, R * 2, R * 2);
          });
        } else if (l.kind === 'mist' && 'sprites' in L) {
          g.globalCompositeOperation = 'source-over';
          const ph = (t % l.every) / l.every;
          const dur = Math.min(1, (2.2 / l.speed) / l.every); // fraction of the cycle it takes to cross
          if (ph < dur) {
            const f = ph / dur;
            const env = Math.sin(Math.PI * f);
            const w = W * 1.4;
            const x = -w + f * (W + w);
            const y = l.y * H;
            const hh = l.height * H;
            const c = clear(x + w / 2, y);
            g.globalAlpha = l.alpha * Math.min(1, k) * env * Math.max(0.25, c);
            g.drawImage((L.sprites as HTMLCanvasElement[])[0], x, y - hh / 2, w, hh);
          }
        } else if (l.kind === 'rings') {
          const r0 = pic();
          const cx = r0.left + l.at[0] * r0.width;
          const cy = r0.top + l.at[1] * r0.height;
          const [cr, cg, cb] = rgb(l.color).map((v) => Math.round(v * 255));
          g.globalCompositeOperation = 'lighter';
          for (let j = 0; j < 2; j++) {
            const f = ((t + j * l.every * 0.5) % l.every) / l.every;
            const R = f * l.size * r0.width;
            const a = l.alpha * Math.min(1, k) * Math.sin(Math.PI * Math.min(1, f * 1.3)) * (1 - f) * clear(cx, cy - R * 0.35);
            if (a < 0.01) continue;
            g.globalAlpha = 1;
            g.strokeStyle = `rgba(${cr},${cg},${cb},${a * 0.35})`;
            g.lineWidth = 6;
            g.beginPath();
            g.ellipse(cx, cy, R, R * 0.36, 0, Math.PI, Math.PI * 2); // the upper half only: never down into the subtitles
            g.stroke();
            g.strokeStyle = `rgba(${cr},${cg},${cb},${a})`;
            g.lineWidth = 1.2;
            g.stroke();
          }
        } else if (l.kind === 'shimmer') {
          g.globalCompositeOperation = 'lighter';
          const [cr, cg, cb] = rgb(l.color).map((v) => Math.round(v * 255));
          const top = l.y0 * H;
          const bot = Math.min(l.y1, subtitleTop) * H;
          g.lineWidth = 1.5;
          for (let i = 0; i < 9; i++) {
            const x0 = ((i + 0.5) / 9) * W;
            const a = l.alpha * Math.min(1, k) * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 1.9));
            g.strokeStyle = `rgba(${cr},${cg},${cb},${a})`;
            g.beginPath();
            for (let y = bot; y >= top; y -= 12) {
              const x = x0 + Math.sin(y * 0.05 + t * 2.2 + i) * 4 + Math.sin(y * 0.013 - t * 0.7) * 6;
              if (y === bot) g.moveTo(x, y);
              else g.lineTo(x, y);
            }
            g.globalAlpha = 1;
            g.stroke();
          }
        } else if (l.kind === 'butterfly') {
          const ph = (t % l.every) / l.every;
          const dur = 7 / l.every;
          if (ph < dur) {
            const f = ph / dur;
            const x = (-0.06 + f * 1.12) * W;
            const y = (0.3 + 0.08 * Math.sin(f * 7) + 0.03 * Math.sin(f * 23)) * H;
            const c = clear(x, y);
            if (c > 0.01) {
              const flap = Math.abs(Math.sin(t * 13));
              const [cr, cg, cb] = rgb(l.color).map((v) => Math.round(v * 255));
              g.globalCompositeOperation = 'lighter';
              g.globalAlpha = l.alpha * Math.min(1, k) * c * Math.sin(Math.PI * f);
              g.fillStyle = `rgba(${cr},${cg},${cb},0.9)`;
              for (const side of [-1, 1]) {
                g.beginPath();
                g.ellipse(x + side * 3.2 * flap, y - 1, 3.4 * flap + 0.4, 2.6, side * 0.5, 0, Math.PI * 2);
                g.ellipse(x + side * 2.2 * flap, y + 2.2, 2.2 * flap + 0.3, 1.7, -side * 0.4, 0, Math.PI * 2);
                g.fill();
              }
              g.fillStyle = `rgba(${cr},${cg},${cb},0.18)`;
              g.beginPath();
              g.arc(x, y, 12, 0, Math.PI * 2);
              g.fill();
            }
          }
        }
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      if (running) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size.w, size.h, def, intensity, paused, hidden, reduced, subtitleTop, aspect]);

  const haze = def.front.filter((l) => l.kind === 'haze');
  return (
    <div ref={box} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" data-ambient="front">
      <style>{`@keyframes ambient-breathe{from{opacity:.55}to{opacity:1}}`}</style>
      {haze.map((l, i) =>
        l.kind === 'haze' ? (
          <div key={i} className="absolute inset-0" style={{ opacity: l.alpha * Math.min(1, intensity) }}>
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom, transparent ${l.y0 * 100}%, ${l.color} ${((l.y0 + l.y1) / 2) * 100}%, transparent ${Math.min(l.y1, subtitleTop) * 100}%)`,
                animation: reduced || paused ? undefined : 'ambient-breathe 7s ease-in-out infinite alternate',
              }}
            />
          </div>
        ) : null,
      )}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

/** both layers in one box (the review page); in the row mount AmbientSky and AmbientFront apart, the figures between */
export function Ambient(props: AmbientProps) {
  return (
    <>
      <AmbientSky {...props} />
      <AmbientFront {...props} />
    </>
  );
}
