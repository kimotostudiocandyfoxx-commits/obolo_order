#!/usr/bin/env python3
"""
Client 2026-11-27: every Bati born from now on is "the food itself as a character" in a 2D anime mascot style
(reference: design/refs/2026-11-27-story/09-bati-style-reference-food-characters.jpg). This paints the same foods on
the candidate models, with the reference sheet as a style reference, and saves one sheet per model plus costs into
art/lab/runware-bati-food. Run by .github/workflows/runware-bati-food-test.yml.
"""
import io, json, os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from runware_planet_avatar import MODELS, USD_JPY, contact_sheet, load_ref, paint  # noqa: E402
from PIL import Image

OUT = "art/lab/runware-bati-food"
REF = "design/refs/2026-11-27-story/09-bati-style-reference-food-characters.jpg"
FOODS = [("curry", "Japanese curry rice"), ("ramen", "a bowl of ramen"), ("strawberry", "a strawberry"), ("takoyaki", "takoyaki"),
         ("onigiri", "an onigiri rice ball"), ("hamburger", "a hamburger"), ("pudding", "a caramel custard pudding"), ("yakiniku", "grilled yakiniku beef")]
PROMPT = ("One cute mascot character that IS {food} itself: the food's own shape, colours and texture become its body "
          "(not an animal wearing or holding the food, no bowl or plate unless the food is the bowl). "
          "2D Japanese anime illustration, soft clean line art and gentle cel shading with a slight painterly texture, "
          "big round sparkling eyes with star highlights, a small happy smile, pink blush on the cheeks, "
          "tiny simple arms and legs, standing, facing front, full body, centred, plain pure white background, no text, no shadow on the floor. "
          "Same drawing style, eyes and charm as the characters in the reference image; one single character only.")


def main():
    want = [s for s in os.environ.get("MODELS", "").split(",") if s] or ["flux2-klein-4b", "flux2-klein-9b", "seedream-5-flash"]
    budget = float(os.environ.get("BUDGET_USD", "1.0"))
    os.makedirs(OUT, exist_ok=True)
    ref_uri, _ = load_ref(REF)
    spent, per, rows = 0.0, {}, []
    for slug, air, max_refs, usd, _ in [m for m in MODELS if m[0] in want]:
        tiles = []
        for key, food in FOODS:
            if spent >= budget:
                tiles.append((None, key, "skipped"))
                continue
            t0 = time.time()
            try:
                img, cost = paint(air, max_refs, PROMPT.format(food=food), [ref_uri])
                spent += cost if isinstance(cost, (int, float)) else usd
                file = f"{slug}__{key}.jpg"
                open(os.path.join(OUT, file), "wb").write(img)
                im = Image.open(io.BytesIO(img)).convert("RGB")
                tiles.append((im, key, f"¥{cost * USD_JPY:.2f}" if isinstance(cost, (int, float)) else "cost ?"))
                if isinstance(cost, (int, float)):
                    per.setdefault(slug, []).append(cost)
                rows.append({"model": slug, "food": key, "file": file, "cost_usd": cost, "seconds": round(time.time() - t0, 1)})
                print(f"{slug} {key}: ${cost} (spent ${spent:.3f})", flush=True)
            except Exception as e:
                tiles.append((None, key, "failed"))
                rows.append({"model": slug, "food": key, "error": str(e)[:400]})
                print(f"{slug} {key}: FAILED {str(e)[:300]}", flush=True)
        contact_sheet(os.path.join(OUT, f"sheet__{slug}.jpg"), f"Bati as the food itself — {slug} ({air})", tiles, tile=220)
    summary = {m: {"pictures": len(v), "avg_jpy": round(sum(v) / len(v) * USD_JPY, 2)} for m, v in per.items()}
    json.dump({"spent_usd": round(spent, 4), "per_model": summary, "prompt": PROMPT, "rows": rows}, open(os.path.join(OUT, "costs.json"), "w"), ensure_ascii=False, indent=2)
    print(f"spent ${spent:.3f}", summary)


if __name__ == "__main__":
    main()
