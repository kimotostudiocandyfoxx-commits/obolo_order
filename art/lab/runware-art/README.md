# Picture comparison (R17)

Runware's own cost per picture (includeCost), 1024×1024, ¥ at 160 JPY/USD. Prompts: scripts/art-lab/prompts.json.

| model | 1-art | 2-look | 3-bati | 4-kororin | avg ¥ |
|---|---|---|---|---|---|
| seedream-5-pro `bytedance:seedream@5.0-pro` | [¥7.70](1-art__seedream-5-pro.jpg) | [¥7.70](2-look__seedream-5-pro.jpg) | [¥7.70](3-bati__seedream-5-pro.jpg) | [¥7.70](4-kororin__seedream-5-pro.jpg) | 7.7 |
| gemini-2-5-flash-image `gemini-2.5-flash-image` | [¥6.20](1-art__gemini-2-5-flash-image.jpg) | [¥6.23](2-look__gemini-2-5-flash-image.jpg) | [¥6.22](3-bati__gemini-2-5-flash-image.jpg) | [¥6.22](4-kororin__gemini-2-5-flash-image.jpg) | 6.22 |
| flux2-klein-4b `runware:400@4` | [¥0.18](1-art__flux2-klein-4b.jpg) | [¥0.18](2-look__flux2-klein-4b.jpg) | [¥0.34](3-bati__flux2-klein-4b.jpg) | [¥0.34](4-kororin__flux2-klein-4b.jpg) | 0.26 |
| flux2-klein-9b `runware:400@2` | [¥0.21](1-art__flux2-klein-9b.jpg) | [¥0.44](2-look__flux2-klein-9b.jpg) | [¥0.44](3-bati__flux2-klein-9b.jpg) | [¥0.44](4-kororin__flux2-klein-9b.jpg) | 0.38 |
| flux3-klein `bfl:flux@3-image-klein` | failed | [¥0.77](2-look__flux3-klein.jpg) | failed | [¥0.94](4-kororin__flux3-klein.jpg) | 0.86 |
| qwen-image-2-1-turbo `alibaba:qwen-image@2.1-turbo` | [¥2.26](1-art__qwen-image-2-1-turbo.jpg) | [¥2.26](2-look__qwen-image-2-1-turbo.jpg) | [¥2.26](3-bati__qwen-image-2-1-turbo.jpg) | [¥2.26](4-kororin__qwen-image-2-1-turbo.jpg) | 2.26 |
| seedream-5-flash `bytedance:seedream@5.0-flash` | [¥3.08](1-art__seedream-5-flash.jpg) | [¥3.08](2-look__seedream-5-flash.jpg) | [¥3.08](3-bati__seedream-5-flash.jpg) | [¥3.08](4-kororin__seedream-5-flash.jpg) | 3.08 |
| nano-banana-2-lite `google:nano-banana@2-lite` | [¥5.38](1-art__nano-banana-2-lite.jpg) | [¥5.45](2-look__nano-banana-2-lite.jpg) | [¥5.45](3-bati__nano-banana-2-lite.jpg) | [¥5.44](4-kororin__nano-banana-2-lite.jpg) | 5.43 |
| z-image-turbo `runware:z-image@turbo` | [¥0.37](1-art__z-image-turbo.jpg) | [¥0.37](2-look__z-image-turbo.jpg) | [¥0.37](3-bati__z-image-turbo.jpg) | [¥0.37](4-kororin__z-image-turbo.jpg) | 0.37 |
| animagine-xl-4 `civitai:1188071@1408658` | [¥0.48](1-art__animagine-xl-4.jpg) | [¥1.18](2-look__animagine-xl-4.jpg) | [¥1.18](3-bati__animagine-xl-4.jpg) | [¥0.48](4-kororin__animagine-xl-4.jpg) | 0.83 |
| illustrious-xl `x:42@2125353` | [¥0.48](1-art__illustrious-xl.jpg) | [¥1.42](2-look__illustrious-xl.jpg) | [¥0.48](3-bati__illustrious-xl.jpg) | [¥0.48](4-kororin__illustrious-xl.jpg) | 0.72 |
