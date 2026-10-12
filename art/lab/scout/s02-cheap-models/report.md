# Model scout — s02-cheap-models

Seedream の代わり候補8種に、同じキモリンの課題（写真1枚＋キモリン／写真4枚の4コマ）を描かせて、費用と出来を比べる。

## Paint tests

### flux2-klein-4b — `runware:400@4`

- ✅ **single** 1024x1024 · refs top · 0.19円 ($0.0013) · 5s → flux2-klein-4b-single.jpg
- ✅ **grid** 1024x1024 · refs top · 0.28円 ($0.0019) · 7s → flux2-klein-4b-grid.jpg

### flux2-klein-9b — `runware:400@2`

- ✅ **single** 1024x1024 · refs top · 0.37円 ($0.00247) · 6s → flux2-klein-9b-single.jpg
- ✅ **grid** 1024x1024 · refs top · 0.51円 ($0.00338) · 9s → flux2-klein-9b-grid.jpg

### flux2-dev — `runware:400@1`

- ✅ **single** 1024x1024 · refs top · 5.76円 ($0.0384) · 18s → flux2-dev-single.jpg
- ❌ **grid**: Error: 400 [{"code":"invalidReferenceImagesCount","message":"Invalid number of elements for 'referenceImages' parameter. Reference images must contain between 0 and 4.","parameter":"referenceImages","type":"string[]","min":0,"max":4,"documentation":"https://runware.ai/docs/image-inference/api-refere

### qwen-edit-plus — `runware:108@22`

- ✅ **single** 1024x1024 · refs top · 0.87円 ($0.0058) · 14s → qwen-edit-plus-single.jpg
- ✅ **grid** 1024x1024 · refs top · 1.25円 ($0.0083) · 19s → qwen-edit-plus-grid.jpg

### qwen-2.1-turbo — `alibaba:qwen-image@2.1-turbo`

- ✅ **single** 1024x1024 · refs top · 2.12円 ($0.014133) · 20s → qwen-2.1-turbo-single.jpg
- ✅ **grid** 1024x1024 · refs top · 2.12円 ($0.014133) · 31s → qwen-2.1-turbo-grid.jpg

### nano-banana-2-lite — `google:nano-banana@2-lite`

- ✅ **single** 1024x1024 · refs top · 5.15円 ($0.0343173) · 7s → nano-banana-2-lite-single.jpg
- ✅ **grid** 1024x1024 · refs top · 5.31円 ($0.0353673) · 10s → nano-banana-2-lite-grid.jpg

### gpt-image-1-mini — `openai:1@2`

- ✅ **single** 1024x1024 · refs top · 5.40円 ($0.036) · 32s → gpt-image-1-mini-single.jpg
- ✅ **grid** 1024x1024 · refs top · 5.40円 ($0.036) · 36s → gpt-image-1-mini-grid.jpg

### kling-image-o3 — `klingai:kling-image@o3`

- ✅ **single** 1024x1024 · refs inputs · 4.20円 ($0.028) · 67s → kling-image-o3-single.jpg
- ✅ **grid** 1024x1024 · refs inputs · 4.20円 ($0.028) · 71s → kling-image-o3-grid.jpg
