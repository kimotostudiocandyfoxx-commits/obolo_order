#!/usr/bin/env python3
"""Anime lab (client request 2026-10-08): can SD 1.5 + J-YOON/animate-lora-sd1.5, merged and run in
ONNX Runtime, redraw the MV キメ絵 on a CPU server — how good, how fast, how big?

Runs on GitHub Actions (.github/workflows/anime-lab.yml; the dev container cannot reach Hugging Face).
Writes art/lab/: report.md (licences, sizes, timings, safety check) and sheet-*.jpg (photo | results).
"""
import glob
import json
import os
import time
import traceback

import torch
from huggingface_hub import hf_hub_download, model_info
from PIL import Image, ImageDraw

BASE = os.environ.get('BASE', 'stable-diffusion-v1-5/stable-diffusion-v1-5')  # runwayml/… was taken down in 2024; this is the official mirror
LORA = os.environ.get('LORA', 'J-YOON/animate-lora-sd1.5')
LORA_FILE = os.environ.get('LORA_FILE', 'animate_v1-000005.safetensors')
LORA_SCALE = float(os.environ.get('LORA_SCALE', '0.8'))
STRENGTHS = [float(s) for s in os.environ.get('STRENGTHS', '0.45,0.6').split(',')]
STEPS = int(os.environ.get('STEPS', '20'))
SIDE = 512
PROMPT = 'anime style illustration, hand-drawn cel animation, clean line art, vibrant colors, soft light'
NEG = 'photo, realistic, lowres, blurry, text, watermark, nsfw, deformed face, extra fingers'
OUT = 'art/lab'
os.makedirs(OUT, exist_ok=True)
rep = ['# Anime lab report', '']


def log(*a):
    line = ' '.join(str(x) for x in a)
    print(line, flush=True)
    rep.append(line)


def save():
    open(f'{OUT}/report.md', 'w').write('\n'.join(rep) + '\n')


def du(path):
    return sum(os.path.getsize(f) for f in glob.glob(f'{path}/**/*', recursive=True) if os.path.isfile(f)) / 1e9


try:
    # 1. licences
    for repo in (BASE, LORA):
        info = model_info(repo, files_metadata=True)
        card = info.card_data.to_dict() if info.card_data else {}
        log(f'## {repo}')
        log(f'- license: **{card.get("license")}**  base_model: {card.get("base_model")}  tags: {", ".join((info.tags or [])[:12])}')
        log(f'- files: {", ".join(s.rfilename for s in info.siblings if not s.rfilename.startswith("."))[:600]}')
        if repo == LORA:
            try:
                readme = open(hf_hub_download(repo, 'README.md')).read()
                log('- README:\n\n```\n' + readme[:2500] + '\n```')
            except Exception as e:  # noqa: BLE001
                log(f'- README: none ({e})')
            names = [s.rfilename for s in info.siblings if s.rfilename.endswith('.safetensors')]
            if LORA_FILE not in names and names:
                log(f'- {LORA_FILE} not found, using {names[0]}')
                LORA_FILE = names[0]
    save()

    # 2. merge: base + LoRA fused into the weights
    from diffusers import StableDiffusionImg2ImgPipeline

    t = time.time()
    pipe = StableDiffusionImg2ImgPipeline.from_pretrained(BASE, torch_dtype=torch.float32, safety_checker=None, requires_safety_checker=False)
    pipe.load_lora_weights(LORA, weight_name=LORA_FILE, adapter_name='anime')
    pipe.fuse_lora(lora_scale=LORA_SCALE)
    pipe.unload_lora_weights()
    pipe.save_pretrained('work/merged')
    del pipe
    log('', '## Merge', f'- base + LoRA (scale {LORA_SCALE}) fused and saved in {time.time() - t:.0f}s, {du("work/merged"):.2f} GB')
    save()

    # 3. ONNX export
    from optimum.onnxruntime import ORTStableDiffusionImg2ImgPipeline

    t = time.time()
    ort = ORTStableDiffusionImg2ImgPipeline.from_pretrained('work/merged', export=True)
    ort.save_pretrained('work/onnx')
    del ort
    os.system('rm -rf work/merged ~/.cache/huggingface/hub/models--stable-diffusion-v1-5*')
    log('', '## ONNX', f'- exported in {time.time() - t:.0f}s, {du("work/onnx"):.2f} GB')
    for f in sorted(glob.glob('work/onnx/**/*.onnx*', recursive=True) + glob.glob('work/onnx/**/*_data', recursive=True)):
        log(f'  - {f[10:]}: {os.path.getsize(f) / 1e6:.0f} MB')
    save()

    # 4. img2img in ONNX Runtime (CPU), on test photos
    t = time.time()
    ort = ORTStableDiffusionImg2ImgPipeline.from_pretrained('work/onnx', provider='CPUExecutionProvider')
    log('', '## Img2img (ONNX Runtime, CPU, ' + str(os.cpu_count()) + ' cores)', f'- load {time.time() - t:.0f}s; {STEPS} steps; prompt: "{PROMPT}"')
    from diffusers.pipelines.stable_diffusion.safety_checker import StableDiffusionSafetyChecker
    from transformers import CLIPImageProcessor

    checker = StableDiffusionSafetyChecker.from_pretrained(BASE, subfolder='safety_checker')
    feat = CLIPImageProcessor.from_pretrained(BASE, subfolder='feature_extractor')
    photos = sorted(glob.glob('work/in/*.jpg'))
    for k, path in enumerate(photos):
        src = Image.open(path).convert('RGB').resize((SIDE, SIDE))
        row = [src]
        for st in STRENGTHS:
            t = time.time()
            img = ort(prompt=PROMPT, negative_prompt=NEG, image=src, strength=st, num_inference_steps=STEPS, guidance_scale=7.0, generator=None).images[0]
            sec = time.time() - t
            with torch.no_grad():
                _, nsfw = checker(images=[torch.zeros(1)], clip_input=feat([img], return_tensors='pt').pixel_values)
            log(f'- {os.path.basename(path)} strength {st}: {sec:.1f}s, safety check: {"FLAGGED" if nsfw[0] else "ok"}')
            row.append(img)
            save()
        sheet = Image.new('RGB', (SIDE * len(row), SIDE + 28), 'white')
        d = ImageDraw.Draw(sheet)
        for i, im in enumerate(row):
            sheet.paste(im, (i * SIDE, 28))
            d.text((i * SIDE + 8, 8), 'photo' if i == 0 else f'strength {STRENGTHS[i - 1]}', fill='black')
        sheet.save(f'{OUT}/sheet-{k}.jpg', quality=85)
    log('', 'done')
except Exception:  # noqa: BLE001
    log('', '## FAILED', '```', traceback.format_exc()[-3000:], '```')
    raise
finally:
    save()
