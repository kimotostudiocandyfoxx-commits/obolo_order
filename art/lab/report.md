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
 ## Merge - base + LoRA (scale 0.8) fused and saved in 58s, 4.27 GB
 ## FAILED ``` Traceback (most recent call last):
  File "/home/runner/work/obolo_order/obolo_order/scripts/anime-lab/lab.py", line 84, in <module>
    ort = ORTStableDiffusionImg2ImgPipeline.from_pretrained('work/merged', export=True)
          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/hostedtoolcache/Python/3.11.17/x64/lib/python3.11/site-packages/optimum/onnxruntime/modeling_ort.py", line 737, in from_pretrained
    return super().from_pretrained(
           ^^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/hostedtoolcache/Python/3.11.17/x64/lib/python3.11/site-packages/optimum/modeling_base.py", line 438, in from_pretrained
    return from_pretrained_method(
           ^^^^^^^^^^^^^^^^^^^^^^^
  File "/opt/hostedtoolcache/Python/3.11.17/x64/lib/python3.11/site-packages/optimum/onnxruntime/modeling_ort.py", line 600, in _from_transformers
    return cls._export(
           ^^^^^^^^^^^^
  File "/opt/hostedtoolcache/Python/3.11.17/x64/lib/python3.11/site-packages/optimum/onnxruntime/modeling_diffusion.py", line 341, in _export
    main_export(
  File "/opt/hostedtoolcache/Python/3.11.17/x64/lib/python3.11/site-packages/optimum/exporters/onnx/__main__.py", line 373, in main_export
    onnx_export_from_model(
  File "/opt/hostedtoolcache/Python/3.11.17/x64/lib/python3.11/site-packages/optimum/exporters/onnx/convert.py", line 1193, in onnx_export_from_model
    _, onnx_outputs = export_models(
                      ^^^^^^^^^^^^^^
  File "/opt/hostedtoolcache/Python/3.11.17/x64/lib/python3.11/site-packages/optimum/exporters/onnx/convert.py", line 783, in export_models
    export(
  File "/opt/hostedtoolcache/Python/3.11.17/x64/lib/python3.11/site-packages/optimum/exporters/onnx/convert.py", line 888, in export
    export_output = export_pytorch(
                    ^^^^^^^^^^^^^^^
  File "/opt/hostedtoolcache/Python/3.11.17/x64/lib/python3.11/site-packages/optimum/exporters/onnx/convert.py", line 584, in export_pytorch
    onnx_export(
  File "/opt/hostedtoolcache/Python/3.11.17/x64/lib/python3.11/site-packages/torch/onnx/__init__.py", line 289, in export
    from torch.onnx._internal.exporter import _compat
  File "/opt/hostedtoolcache/Python/3.11.17/x64/lib/python3.11/site-packages/torch/onnx/_internal/exporter/_compat.py", line 16, in <module>
    from torch.onnx._internal.exporter import (
  File "/opt/hostedtoolcache/Python/3.11.17/x64/lib/python3.11/site-packages/torch/onnx/_internal/exporter/_core.py", line 19, in <module>
    import onnxscript
ModuleNotFoundError: No module named 'onnxscript'
 ```
