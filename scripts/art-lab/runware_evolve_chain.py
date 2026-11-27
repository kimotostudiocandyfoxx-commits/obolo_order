#!/usr/bin/env python3
"""
Client 2026-11-27: which model can change a look step by step ("from the picture it is now, change this one thing")?
The day-2 flow lets a Bati evolve and a member transform up to 8 times, each step from the picture before, told by
words or by a reference picture. This paints the same chain of steps on each candidate model, always feeding the
model its OWN previous picture, and saves one contact sheet per subject and model (start → step 1 → … ), the cost
of every picture, costs.json and README.md into art/lab/runware-evolve-chain.

Run by .github/workflows/runware-evolve-test.yml. Env: RUNWARE_API_KEY, MODELS (slugs), BUDGET_USD.
"""
import io, json, os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from runware_planet_avatar import MODELS, USD_JPY, contact_sheet, load_ref, paint  # noqa: E402
from PIL import Image

OUT = "art/lab/runware-evolve-chain"
KEEP = ("Edit the first image. Keep the SAME character: same face, same body shape, same art style, same pose, "
        "same framing and the same plain background. Do not redesign it. Change ONLY this: ")
SUBJECTS = [
    {"id": "bati", "start": "art/review/saturn/gen-tests/bati-earth-いちご.png", "steps": [
        ("wings", "add a pair of small white feathered angel wings on its back.", None),
        ("colour", "make its body colour a soft pastel blue (keep everything else, including the wings).", None),
        ("crown", "put a tiny golden crown on its head (keep the wings and the blue colour).", None),
        ("scarf", "wrap a red knitted scarf around its neck (keep the crown, the wings and the blue colour).", None),
        ("ref-sunglasses", "give it the same round black sunglasses as the character in the second image wears (the second image is only a reference for the sunglasses; keep everything else of the first image).", "art/review/saturn/gen-tests/look-photo2-1.jpg"),
    ]},
    {"id": "member", "start": "art/lab/runware-planet-avatar/refs/look-user.jpg", "steps": [
        ("hair", "change the hair colour to silver.", None),
        ("cloak", "dress the character in a black hooded cloak with gold trim over the clothes (keep the silver hair).", None),
        ("ears", "add two small pointed fox ears on top of the head (keep the cloak and the silver hair).", None),
        ("glow", "add a thin glowing blue pattern on the cheeks (keep the ears, the cloak and the silver hair).", None),
        ("ref-hood", "change the cloak's hood and colours to look like the hooded cloak of the character in the second image (the second image is only a reference for the cloak; keep the face, hair and ears of the first image).", "art/review/saturn/gen-tests/look-photo2-1.jpg"),
    ]},
]


def data_uri(img_bytes):
    import base64
    im = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=92)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode(), im


def main():
    want = [s for s in os.environ.get("MODELS", "").split(",") if s] or ["flux2-klein-4b", "flux2-klein-9b", "qwen-image-2-1-turbo", "seedream-5-flash"]
    budget = float(os.environ.get("BUDGET_USD", "1.5"))
    models = [m for m in MODELS if m[0] in want]
    os.makedirs(OUT, exist_ok=True)
    spent, results = 0.0, []
    for sub in SUBJECTS:
        start_uri, start_im = load_ref(sub["start"])
        for slug, air, max_refs, usd, _ in models:
            cur_uri, tiles, row = start_uri, [(start_im, "start", "")], {"subject": sub["id"], "model": slug, "steps": []}
            for name, change, ref in sub["steps"]:
                if spent >= budget:
                    row["steps"].append({"step": name, "skipped": "budget"})
                    tiles.append((None, name, "skipped"))
                    continue
                refs = [cur_uri] + ([load_ref(ref)[0]] if ref else [])
                t0 = time.time()
                try:
                    img, cost = paint(air, max_refs, KEEP + change, refs)
                    spent += cost if isinstance(cost, (int, float)) else usd
                    file = f"{sub['id']}__{slug}__{len(row['steps']) + 1}-{name}.jpg"
                    open(os.path.join(OUT, file), "wb").write(img)
                    cur_uri, im = data_uri(img)
                    row["steps"].append({"step": name, "file": file, "cost_usd": cost, "seconds": round(time.time() - t0, 1)})
                    tiles.append((im, name, f"¥{cost * USD_JPY:.2f}" if isinstance(cost, (int, float)) else "cost ?"))
                    print(f"{sub['id']} {slug} {name}: ${cost} in {row['steps'][-1]['seconds']} s (spent ${spent:.3f})", flush=True)
                except Exception as e:  # the chain stops for this model at a failed step
                    row["steps"].append({"step": name, "error": str(e)[:500]})
                    tiles.append((None, name, "failed"))
                    print(f"{sub['id']} {slug} {name}: FAILED {str(e)[:300]}", flush=True)
                    break
            contact_sheet(os.path.join(OUT, f"sheet__{sub['id']}__{slug}.jpg"), f"{sub['id']} — {slug} ({air}) — each step from its own picture before", tiles)
            results.append(row)
    per = {}
    for r in results:
        for s in r["steps"]:
            if isinstance(s.get("cost_usd"), (int, float)):
                per.setdefault(r["model"], []).append(s["cost_usd"])
    summary = {m: {"pictures": len(v), "avg_usd": round(sum(v) / len(v), 5), "avg_jpy": round(sum(v) / len(v) * USD_JPY, 2)} for m, v in per.items()}
    json.dump({"usd_jpy": USD_JPY, "spent_usd": round(spent, 4), "per_model": summary, "chains": results}, open(os.path.join(OUT, "costs.json"), "w"), ensure_ascii=False, indent=2)
    lines = ["# Step-by-step look changes: model comparison (client 2026-11-27)", "",
             "Each model edits its own previous picture: 4 steps told by words, then 1 step told with a reference picture.", "",
             "| model | pictures | average cost |", "|---|---|---|"]
    lines += [f"| {m} | {s['pictures']} | ¥{s['avg_jpy']} (${s['avg_usd']}) |" for m, s in summary.items()]
    lines += ["", "Sheets: `sheet__<subject>__<model>.jpg` (start → steps)."]
    open(os.path.join(OUT, "README.md"), "w").write("\n".join(lines) + "\n")
    print(f"spent ${spent:.3f} (¥{spent * USD_JPY:.0f})")


if __name__ == "__main__":
    main()
