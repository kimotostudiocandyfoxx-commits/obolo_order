#!/usr/bin/env python3
"""
The client's picks → the pictures the app uses (client plan 2026-10-13). Run by
.github/workflows/story-assets.yml when design/story-picks.json changes.

  picks: { "cast": { "エビ": "2" | "client" | "client:5" }, "places": { "mercury-beach": "1" | "client" } }
  "client:N": the client's folder holds several forms (01-…, 02-…; 99-… are reference sheets, skipped):
  each becomes <id>-f<k>.webp, and form N is also the standing picture <id>.webp

- people: the candidate (public/story/candidates/cast/<id>/<n>.jpg) or the client's first picture
  (design/story/cast/<name>/) is cut out of its background unless it already has one transparent —
  rembg with isnet-anime (an anime-trained matting model, Apache-2.0) — trimmed to the figure and saved
  as public/story/cast/<id>.webp (at most 1280 tall)
- places: cropped to 9:16 and saved as public/story/places/<id>.jpg (720×1280, nothing above 720p)
A pick is promoted once; public/story/promoted.json records what went in (change the pick to redo it).
"""
import json
import os
import sys
from pathlib import Path

from PIL import Image

PUB = Path("apps/web/public")
picks = json.loads(Path("design/story-picks.json").read_text())
assets = json.loads((PUB / "story/assets.json").read_text())
IMG = (".png", ".jpg", ".jpeg", ".webp")
log = []
_session = None
RECORD = PUB / "story/promoted.json"
done = json.loads(RECORD.read_text()) if RECORD.exists() else {}


def cutout(img: Image.Image) -> Image.Image:
    global _session
    if img.mode == "RGBA" and img.getchannel("A").getextrema()[0] < 250:
        return img  # already transparent
    from rembg import new_session, remove

    if _session is None:
        _session = new_session("isnet-anime")
    return remove(img.convert("RGB"), session=_session, alpha_matting=False)


def person(src: Path) -> Image.Image:
    """cut out, trimmed to the figure, at most 1280 tall"""
    img = cutout(Image.open(src).convert("RGBA"))
    box = img.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox()
    if box:
        m = int(0.02 * max(img.size))
        img = img.crop((max(0, box[0] - m), max(0, box[1] - m), min(img.width, box[2] + m), min(img.height, box[3] + m)))
    if img.height > 1280:
        img = img.resize((round(img.width * 1280 / img.height), 1280), Image.LANCZOS)
    (PUB / "story/cast").mkdir(parents=True, exist_ok=True)
    return img


def source(kind: str, entry: dict, pick: str) -> Path | None:
    if pick.startswith("client"):
        folder = Path("design/story") / kind / entry["name"]
        files = sorted(p for p in folder.glob("*") if p.suffix.lower() in IMG) if folder.exists() else []
        return files[0] if files else None
    p = PUB / "story/candidates" / kind / entry["id"] / f"{pick}.jpg"
    return p if p.exists() else None


for name, pick in (picks.get("cast") or {}).items():
    entry = next((c for c in assets["cast"] if c["name"] == name or name in (c.get("aliases") or [])), None)
    if not entry:
        log.append(f"- ❌ 人物 {name}: assets.json にない名前")
        continue
    src = source("cast", entry, str(pick))
    out = PUB / "story/cast" / f"{entry['id']}.webp"
    if not src:
        log.append(f"- ❌ 人物 {name}: 選んだ絵（{pick}）が見つからない")
        continue
    if out.exists() and done.get(f"cast:{name}") == str(pick):
        continue
    if str(pick).startswith("client:"):
        # several forms: every picture in the folder, form N also as the standing picture
        folder = Path("design/story/cast") / entry["name"]
        forms = sorted(p for p in folder.glob("*") if p.suffix.lower() in IMG and not p.name.startswith("99-"))
        n = int(str(pick).split(":")[1])
        for k, f in enumerate(forms, 1):
            img = person(f)
            img.save(PUB / "story/cast" / f"{entry['id']}-f{k}.webp", "WEBP", quality=90, method=6)
            if k == n:
                img.save(out, "WEBP", quality=90, method=6)
        done[f"cast:{name}"] = str(pick)
        log.append(f"- ✅ 人物 {name}：{len(forms)}形態（標準は{n}）")
        continue
    img = person(src)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "WEBP", quality=90, method=6)
    done[f"cast:{name}"] = str(pick)
    log.append(f"- ✅ 人物 {name} ← {src}（{img.width}×{img.height}）")

for name, pick in (picks.get("places") or {}).items():
    entry = next((p for p in assets["places"] if p["name"] == name), None)
    if not entry:
        log.append(f"- ❌ 場所 {name}: assets.json にない名前")
        continue
    src = source("places", entry, str(pick))
    out = PUB / "story/places" / f"{entry['id']}.jpg"
    if not src:
        log.append(f"- ❌ 場所 {name}: 選んだ絵（{pick}）が見つからない")
        continue
    if out.exists() and done.get(f"places:{name}") == str(pick):
        continue
    img = Image.open(src).convert("RGB")
    # centre crop to 9:16, then 720×1280
    w, h = img.size
    if w / h > 9 / 16:
        nw = round(h * 9 / 16)
        img = img.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = round(w * 16 / 9)
        img = img.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    img = img.resize((720, 1280), Image.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "JPEG", quality=88)
    done[f"places:{name}"] = str(pick)
    log.append(f"- ✅ 場所 {name} ← {src}")

RECORD.write_text(json.dumps(done, ensure_ascii=False, indent=1))
report = "\n".join([f"# 物語の素材・本番入れ", "", *(log or ["（新しく入れるものなし）"]), ""])
Path("docs/story-import/assets-promote-last-run.md").write_text(report)
print(report)
sys.exit(1 if any(l.startswith("- ❌") for l in log) else 0)
