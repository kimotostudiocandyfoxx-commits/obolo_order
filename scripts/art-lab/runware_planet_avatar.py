"""Planet-home member figure comparison (one-off, client 2026-11-25).

Every planet's deformed member figure (the 2-heads chibi on Saturn, the kororin ball, the Jupiter butterfly, the Mercury
boat, the Mars UFO, the Venus radio DJ, the Uranus balloons, the Pluto book, the Neptune bubble: scripts/art-lab/
planet_avatar_prompts.json, taken from the story branch's design/mv-art-queue.json) painted from 2-3 real member looks
on each candidate model on Runware, with the look as the FIRST reference and the style references after it, the way the
app sends references (packages/ai/src/images.ts runwareImageTask: 1024x1024, referenceImages, at most 4 on FLUX.2 klein,
3 on Qwen-Image). Every task asks includeCost; every model and case is tried on its own (a failure is written down, the
rest go on). A budget guard stops painting once the spent cost passes BUDGET_USD (default 3.0).

Writes art/lab/runware-planet-avatar/<style>__<look>__<model>.jpg, sheet__<style>__<look>.jpg (the look, then each
model, labelled with the model and its yen cost), costs.json and README.md. Run by
.github/workflows/runware-planet-avatar-test.yml with RUNWARE_API_KEY from Secret Manager. Nothing is deployed.

  --cases PATH     the case file (default scripts/art-lab/planet_avatar_prompts.json)
  --models a,b     only these model slugs      --styles a,b   only these styles      --looks a,b   only these looks
  --dry-run        print the plan and the estimated cost, paint nothing
"""
import argparse, base64, io, json, os, sys, time, urllib.request, uuid

from PIL import Image, ImageDraw, ImageFont

KEY = os.environ.get("RUNWARE_API_KEY", "")
USD_JPY = 160
SIDE = 1024

# (slug, AIR id, max references the app sends, est. USD per picture with references (art/lab/runware-art/costs.json), cheap)
MODELS = [
    ("flux2-klein-4b", "runware:400@4", 4, 0.003, True),
    ("flux2-klein-9b", "runware:400@2", 4, 0.004, True),
    ("seedream-5-flash", "bytedance:seedream@5.0-flash", 10, 0.0193, True),
    ("qwen-image-2-1-turbo", "alibaba:qwen-image@2.1-turbo", 3, 0.0142, True),
    ("seedream-5-pro", "bytedance:seedream@5.0-pro", 10, 0.0482, False),
    ("nano-banana-2-lite", "google:nano-banana@2-lite", 10, 0.036, False),
]


def runware(tasks, timeout=300):
    req = urllib.request.Request("https://api.runware.ai/v1", data=json.dumps(tasks).encode(),
                                 headers={"content-type": "application/json", "Authorization": f"Bearer {KEY}"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        try:
            return json.loads(body)
        except Exception:
            raise RuntimeError(f"HTTP {e.code} {body[:400]}")


def load_ref(spec):
    """a path, or crop:<path>:x,y,w,h (a cell of a style sheet); returns (data URI, PIL image)"""
    if spec.startswith("crop:"):
        _, path, box = spec.split(":", 2)
        x, y, w, h = (int(v) for v in box.split(","))
        im = Image.open(path).convert("RGB").crop((x, y, x + w, y + h))
    else:
        im = Image.open(spec).convert("RGB")
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=92)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode(), im


def paint(air, max_refs, prompt, refs):
    task = {"taskType": "imageInference", "taskUUID": str(uuid.uuid4()), "model": air, "positivePrompt": prompt[:3000],
            "width": SIDE, "height": SIDE, "numberResults": 1, "outputType": "URL", "outputFormat": "JPG", "includeCost": True,
            "referenceImages": refs[:max_refs]}
    got = runware([task])
    if got.get("errors"):
        # some models take the references inside `inputs` (Runware's newer schema)
        task.pop("referenceImages", None)
        task["inputs"] = {"referenceImages": refs[:max_refs]}
        task["taskUUID"] = str(uuid.uuid4())
        got = runware([task])
    if got.get("errors"):
        raise RuntimeError(json.dumps(got["errors"], ensure_ascii=False)[:600])
    d = next((x for x in got.get("data", []) if x.get("taskUUID") == task["taskUUID"]), None)
    for _ in range(60):  # still being made: ask for it by its task
        if d and d.get("imageURL"):
            break
        time.sleep(4)
        poll = runware([{"taskType": "getResponse", "taskUUID": task["taskUUID"]}], 60)
        if poll.get("errors"):
            raise RuntimeError(json.dumps(poll["errors"], ensure_ascii=False)[:600])
        d = next((x for x in poll.get("data", []) if x.get("taskUUID") == task["taskUUID"]), d)
    if not d or not d.get("imageURL"):
        raise RuntimeError("no picture came back")
    with urllib.request.urlopen(d["imageURL"], timeout=120) as r:
        return r.read(), d.get("cost")


def font(size):
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf"):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def contact_sheet(path, title, tiles, tile=300):
    """tiles: [(PIL image or None, label line 1, label line 2)]"""
    pad, lab, top = 8, 44, 34
    W = pad + len(tiles) * (tile + pad)
    sheet = Image.new("RGB", (W, top + tile + lab + pad), "white")
    d = ImageDraw.Draw(sheet)
    d.text((pad, 8), title, fill=(0, 0, 0), font=font(18))
    f = font(13)
    for i, (im, l1, l2) in enumerate(tiles):
        x = pad + i * (tile + pad)
        if im is not None:
            t = im.copy()
            t.thumbnail((tile, tile))
            sheet.paste(t, (x + (tile - t.width) // 2, top + (tile - t.height) // 2))
        else:
            d.rectangle((x, top, x + tile, top + tile), outline=(200, 0, 0), width=2)
            d.text((x + 10, top + tile // 2), "failed", fill=(200, 0, 0), font=f)
        d.text((x, top + tile + 4), l1, fill=(0, 0, 0), font=f)
        d.text((x, top + tile + 22), l2, fill=(90, 90, 90), font=f)
    sheet.save(path, quality=85)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cases", default=os.path.join(os.path.dirname(__file__), "planet_avatar_prompts.json"))
    ap.add_argument("--out", default=os.environ.get("OUT", "art/lab/runware-planet-avatar"))
    ap.add_argument("--models", default=os.environ.get("MODELS", ""))
    ap.add_argument("--styles", default=os.environ.get("STYLES", ""))
    ap.add_argument("--looks", default=os.environ.get("LOOKS", ""))
    ap.add_argument("--budget", type=float, default=float(os.environ.get("BUDGET_USD") or 3.0))
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    only = lambda s: [x.strip() for x in s.split(",") if x.strip()]
    om, os_, ol = only(a.models), only(a.styles), only(a.looks)

    cfg = json.load(open(a.cases, encoding="utf-8"))
    looks = [l for l in cfg["looks"] if not ol or l["id"] in ol]
    styles = [s for s in cfg["styles"] if not os_ or s["id"] in os_]
    models = [m for m in MODELS if not om or m[0] in om]

    # the plan: every style x look on the cheap models, the dear ones only on the looks marked all_models
    plan = [(s, l, m) for s in styles for l in looks for m in models if m[4] or l.get("all_models")]
    est = sum(m[3] for _, _, m in plan)
    print(f"{len(plan)} pictures planned ({len(styles)} styles x {len(looks)} looks x up to {len(models)} models), "
          f"estimated ${est:.2f} (¥{est * USD_JPY:.0f}); budget ${a.budget:.2f}")
    for slug, air, _, usd, cheap in models:
        n = sum(1 for _, _, m in plan if m[0] == slug)
        print(f"  {slug:22s} {air:32s} {n:3d} x ~${usd:.4f} = ${n * usd:.2f}{'' if cheap else '  (dear: only on looks with all_models)'}")
    if a.dry_run:
        return 0
    if not KEY:
        print("no RUNWARE_API_KEY", file=sys.stderr)
        return 1
    os.makedirs(a.out, exist_ok=True)

    style_refs = {k: [load_ref(p) for p in v] for k, v in cfg.get("style_refs", {}).items()}
    look_refs = {l["id"]: load_ref(l["ref"]) for l in looks}
    spent, results, stopped = 0.0, {}, None
    for s in styles:
        for l in looks:
            prompt = s["prompt"].format(pattern=l.get("pattern", "the character's outfit colours"), accessory=l.get("accessory", "the character's glasses or sunglasses, if any"), top=l.get("top", "the character's hair, ears or hood"))
            refs = [look_refs[l["id"]][0]] + [r[0] for k in s.get("style_refs", []) for r in style_refs[k]]
            case_id = f"{s['id']}__{l['id']}"
            row = {"style": s["id"], "planet": s["planet"], "look": l["id"], "refs": 1 + sum(len(style_refs[k]) for k in s.get("style_refs", [])), "prompt": prompt, "models": {}}
            results[case_id] = row
            print(f"== {case_id} ({s['planet']}: {s['what']})")
            for slug, air, max_refs, usd, cheap in models:
                if not cheap and not l.get("all_models"):
                    continue
                if spent >= a.budget:
                    stopped = stopped or f"budget ${a.budget:.2f} reached at {case_id} / {slug}"
                    row["models"][slug] = {"skipped": "budget"}
                    continue
                t0 = time.time()
                try:
                    img, cost = paint(air, max_refs, prompt, refs)
                    name = f"{case_id}__{slug}.jpg"
                    open(os.path.join(a.out, name), "wb").write(img)
                    spent += cost if isinstance(cost, (int, float)) else usd
                    row["models"][slug] = {"model": air, "file": name, "cost_usd": cost, "refs_sent": min(len(refs), max_refs), "seconds": round(time.time() - t0, 1)}
                    print(f"  {slug}: ${cost} in {row['models'][slug]['seconds']} s (spent ${spent:.3f})")
                except Exception as e:
                    row["models"][slug] = {"model": air, "error": str(e)[:600], "seconds": round(time.time() - t0, 1)}
                    print(f"  {slug}: FAILED {e}", file=sys.stderr)
            try:  # the contact sheet of this case: the look, then each model with its yen
                tiles = [(look_refs[l["id"]][1], f"look {l['id']}", "reference")]
                for slug, *_ in models:
                    r = row["models"].get(slug)
                    if not r or r.get("skipped"):
                        continue
                    im = Image.open(os.path.join(a.out, r["file"])).convert("RGB") if r.get("file") else None
                    c = r.get("cost_usd")
                    tiles.append((im, slug, f"¥{c * USD_JPY:.2f} (${c})" if isinstance(c, (int, float)) else ("failed" if r.get("error") else "cost ?")))
                contact_sheet(os.path.join(a.out, f"sheet__{case_id}.jpg"), f"{s['planet']} · {s['id']} · look {l['id']}", tiles)
            except Exception as e:
                print(f"  sheet FAILED {e}", file=sys.stderr)

    per_model = {}
    for row in results.values():
        for slug, r in row["models"].items():
            if isinstance(r.get("cost_usd"), (int, float)):
                per_model.setdefault(slug, []).append(r["cost_usd"])
    summary = {slug: {"pictures": len(c), "total_usd": round(sum(c), 5), "avg_usd": round(sum(c) / len(c), 5), "avg_jpy": round(sum(c) / len(c) * USD_JPY, 2)} for slug, c in per_model.items()}
    json.dump({"usd_jpy": USD_JPY, "side": SIDE, "spent_usd": round(spent, 5), "estimated_usd": round(est, 4), "stopped": stopped,
               "looks": looks, "styles": [{k: s[k] for k in ("id", "planet", "what", "source", "style_refs")} for s in styles],
               "per_model": summary, "cases": results}, open(os.path.join(a.out, "costs.json"), "w"), ensure_ascii=False, indent=2)

    lines = ["# Planet-home member figures: model comparison", "",
             f"Runware's own cost per picture (includeCost), {SIDE}×{SIDE}, ¥ at {USD_JPY} JPY/USD. Prompts: scripts/art-lab/planet_avatar_prompts.json. "
             f"Spent ${spent:.3f} (¥{spent * USD_JPY:.0f}).{' Stopped: ' + stopped if stopped else ''}", "",
             "| model | pictures | avg ¥ | total $ |", "|---|---|---|---|"]
    for slug, air, *_ in models:
        sm = summary.get(slug)
        lines.append(f"| {slug} `{air}` | {sm['pictures'] if sm else 0} | {sm['avg_jpy'] if sm else '—'} | {sm['total_usd'] if sm else '—'} |")
    lines += ["", "| case | " + " | ".join(m[0] for m in models) + " |", "|---|" + "---|" * len(models)]
    for cid, row in results.items():
        cells = []
        for slug, *_ in models:
            r = row["models"].get(slug)
            cells.append("—" if not r or r.get("skipped") else (f"[¥{r['cost_usd'] * USD_JPY:.2f}]({r['file']})" if isinstance(r.get("cost_usd"), (int, float)) else ("failed" if r.get("error") else f"[?]({r['file']})")))
        lines.append(f"| [{row['planet']} {cid}](sheet__{cid}.jpg) | " + " | ".join(cells) + " |")
    open(os.path.join(a.out, "README.md"), "w").write("\n".join(lines) + "\n")
    ok = sum(1 for r in results.values() for m in r["models"].values() if m.get("file"))
    print(f"{ok} pictures, spent ${spent:.3f} (¥{spent * USD_JPY:.0f}); costs in {a.out}/costs.json")
    for slug, sm in summary.items():
        print(f"  {slug}: {sm['pictures']} pictures, avg ¥{sm['avg_jpy']}, total ${sm['total_usd']}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
