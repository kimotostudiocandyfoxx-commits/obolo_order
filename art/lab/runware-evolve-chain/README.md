# Step-by-step look changes: model comparison (client 2026-11-27)

Each model edits its own previous picture: 4 steps told by words, then 1 step told with a reference picture.

| model | pictures | average cost |
|---|---|---|
| flux2-klein-4b | 10 | ¥0.3 ($0.0019) |
| flux2-klein-9b | 10 | ¥0.48 ($0.00299) |
| seedream-5-flash | 10 | ¥3.08 ($0.01926) |
| qwen-image-2-1-turbo | 10 | ¥2.26 ($0.01413) |

Sheets: `sheet__<subject>__<model>.jpg` (start → steps).
