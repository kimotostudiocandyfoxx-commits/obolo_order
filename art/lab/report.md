# Anime lab report

## stable-diffusion-v1-5/stable-diffusion-v1-5
- license: **creativeml-openrail-m**  base_model: None  tags: diffusers, safetensors, stable-diffusion, stable-diffusion-diffusers, text-to-image, arxiv:2207.12598, arxiv:2112.10752, arxiv:2103.00020, arxiv:2205.11487, arxiv:1910.09700, license:creativeml-openrail-m, endpoints_compatible
- files: README.md, feature_extractor/preprocessor_config.json, model_index.json, safety_checker/config.json, safety_checker/model.fp16.safetensors, safety_checker/model.safetensors, safety_checker/pytorch_model.bin, safety_checker/pytorch_model.fp16.bin, scheduler/scheduler_config.json, text_encoder/config.json, text_encoder/model.fp16.safetensors, text_encoder/model.safetensors, text_encoder/pytorch_model.bin, text_encoder/pytorch_model.fp16.bin, tokenizer/merges.txt, tokenizer/special_tokens_map.json, tokenizer/tokenizer_config.json, tokenizer/vocab.json, unet/config.json, unet/diffusion_pytorch_mod
## J-YOON/animate-lora-sd1.5
- license: **mit**  base_model: runwayml/stable-diffusion-v1-5  tags: diffusers, stable-diffusion, stable-diffusion-diffusers, lora, image-generation, anime, landscape, text-to-image, base_model:runwayml/stable-diffusion-v1-5, base_model:adapter:runwayml/stable-diffusion-v1-5, license:mit, region:us
- files: README.md, animate_v1-000005.safetensors, images/example_dog_animate.png, images/example_rainy_walk_animate.png, images/reference_dog_photo.jpg, images/reference_rainy_walk_photo.jpg, metadata/animation_training_log.txt, metadata/painting_script_caption.txt, metadata/painting_v1_20231211-043052.json
- README:

```
---
pipeline_tag: text-to-image
library_name: diffusers
license: mit
base_model: runwayml/stable-diffusion-v1-5
widget:
  - text: "sms landscape, dog by the water, soft sky, anime background art"
    output:
      url: images/example_dog_animate.png
  - text: "sms landscape, rainy evening street, walking home, reflective wet road, cinematic anime background"
    output:
      url: images/example_rainy_walk_animate.png
tags:
  - stable-diffusion
  - stable-diffusion-diffusers
  - lora
  - diffusers
  - image-generation
  - anime
  - landscape
---

# animate-lora-sd1.5

LoRA adapter for cinematic anime-style landscape generation on top of **Stable Diffusion 1.5**.

## Model summary

- Base model: `runwayml/stable-diffusion-v1-5`
- Trigger words: `landscape`, `sms landscape`
- Adapter file: `animate_v1-000005.safetensors`
- Intended style: cinematic anime-style scenery, sky-rich composition, stylized background art

## Intended use

This adapter is intended for stylized landscape generation, scenic diary illustrations, and anime-inspired background imagery.

It works best as a style adapter layered on top of SD1.5 rather than as a broad general-purpose object model.

## Related project

- Companion app repo: <https://github.com/J-Y00N/Multimodal-Picture-Diary>
- Live demo page: <https://multimodal-picture-diary-25vtwte77q6nxwtbdhhpp9.streamlit.app/>

This model repo is maintained by the same author as the companion app, but published separately so the LoRA release and the application code can be versioned independently.

## Preserved training evidence

Preserved local artifacts suggest the original training run used:

- resolution: `512x512`
- network_dim: `25`
- network_alpha: `25`
- train_batch_size: `16`
- text_encoder_lr: `5e-05`
- unet_lr: `0.0001`
- optimizer: `AdamW`
- max_train_steps: `93750`
- lr_warmup_steps: `9375`
- xformers enabled
- dataset tag frequencies preserved in `metadata/animation_training_log.txt`

Preserved configs and logs indicate a `kohya_ss`-based LoRA training workflow.

See `metadata/painting_v1_20231211-043052.json`, `metadata/painting_script_caption.txt`, and `metadata/animation_training_log.txt` for the preserved config snapshot and training notes.

## Dataset reference

- Related public dataset reference: [Hugging Face - Fung804/makoto-shinkai-picture](https://huggingface.co/datasets/Fung804/makoto-shinkai-picture)

This link is included as a public dataset reference related to the preserved landscape/anime-style training art
```
 ## Merge - base + LoRA (scale 0.8) fused and saved in 24s, 4.27 GB
 ## ONNX - exported in 8127s, 4.27 GB
  - text_encoder/model.onnx: 493 MB
  - unet/model.onnx: 1 MB
  - unet/model.onnx_data: 3438 MB
  - unet/model.onnx_data: 3438 MB
  - vae_decoder/model.onnx: 198 MB
  - vae_encoder/model.onnx: 137 MB
 ## Img2img (ONNX Runtime, CPU, 4 cores) - load 20s; 20 steps; prompt: "sms landscape, anime style illustration, hand-drawn cel animation, clean line art, vibrant colors, soft light"
- p1005.jpg strength 0.45: 119.5s, safety check: ok
- p1005.jpg strength 0.6: 146.1s, safety check: ok
- p1011.jpg strength 0.45: 117.4s, safety check: ok
- p1011.jpg strength 0.6: 146.2s, safety check: ok
- p1025.jpg strength 0.45: 117.2s, safety check: ok
