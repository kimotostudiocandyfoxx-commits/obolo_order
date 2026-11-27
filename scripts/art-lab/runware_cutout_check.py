#!/usr/bin/env python3
"""
Client 2026-11-27: the cut-out's background-removal model (CUTOUT_MODEL, RemBG 1.4 `runware:109@1`) has never been run
against the real API. This sends ONE picture through exactly the task the API sends
(packages/ai/src/images.ts runwareCutoutTask: removeBackground, the picture inline as a data URI, a PNG back by URL,
includeCost) and checks what media/cutting.ts cutByModel needs of the answer: a PNG with an alpha channel, part of it
cut away and part of it kept. Saved into art/lab/runware-cutout-check: the request (without the picture), Runware's
answer, the cut PNG, a dark | light sheet and result.json. Run by .github/workflows/runware-cutout-test.yml.
About $0.0006 (one call; never more than one).
"""
import base64, io, json, os, sys, time, uuid
sys.path.insert(0, os.path.dirname(__file__))
from runware_planet_avatar import USD_JPY, runware  # noqa: E402
import urllib.request
from PIL import Image

OUT = "art/lab/runware-cutout-check"
MODEL = os.environ.get("CUTOUT_MODEL") or "runware:109@1"
SAMPLE = os.environ.get("SAMPLE") or "art/lab/runware-planet-avatar/mercury-ship__A-fox__flux2-klein-4b.jpg"


def sheet(cut, side=384):
    """the cut on dark and on light, side by side (what the vision check looks at)"""
    out = Image.new("RGB", (side * 2, side))
    fig = cut.convert("RGBA")
    fig.thumbnail((side, side))
    for i, bg in enumerate([(28, 22, 48), (255, 255, 255)]):
        tile = Image.new("RGBA", (side, side), bg + (255,))
        tile.alpha_composite(fig, ((side - fig.width) // 2, (side - fig.height) // 2))
        out.paste(tile.convert("RGB"), (i * side, 0))
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    data = open(SAMPLE, "rb").read()
    mime = "image/png" if data[:1] == b"\x89" else "image/jpeg"
    src = Image.open(io.BytesIO(data))
    task = {"taskType": "removeBackground", "taskUUID": str(uuid.uuid4()), "model": MODEL,
            "inputImage": f"data:{mime};base64,{base64.b64encode(data).decode()}", "outputType": "URL", "outputFormat": "PNG", "includeCost": True}
    result = {"model": MODEL, "sample": SAMPLE, "sample_size": list(src.size), "request": {**task, "inputImage": f"data:{mime};base64,<{len(data)} bytes>"}}
    ok = False
    t0 = time.time()
    try:
        got = runware([task], 120)
        result["seconds"] = round(time.time() - t0, 1)
        result["response"] = got
        d = (got.get("data") or [{}])[0]
        url = d.get("imageURL")
        if got.get("errors") or not url:
            raise RuntimeError("no picture came back: " + json.dumps(got.get("errors") or got, ensure_ascii=False)[:600])
        with urllib.request.urlopen(url, timeout=120) as r:
            png = r.read()
        open(os.path.join(OUT, "cut.png"), "wb").write(png)
        cut = Image.open(io.BytesIO(png))
        alpha = cut.convert("RGBA").getchannel("A")
        hist = alpha.histogram()
        n = cut.width * cut.height
        gone, kept = sum(hist[:11]) / n, sum(hist[128:]) / n
        cost = d.get("cost")
        result.update({"cost_usd": cost, "cost_jpy": round(cost * USD_JPY, 4) if isinstance(cost, (int, float)) else None,
                       "format": cut.format, "mode": cut.mode, "size": list(cut.size), "same_size_as_sample": list(cut.size) == list(src.size),
                       "has_alpha": cut.mode in ("RGBA", "LA", "PA") or "transparency" in cut.info, "removed_share": round(gone, 4), "kept_share": round(kept, 4)})
        sheet(cut).save(os.path.join(OUT, "sheet.jpg"), quality=88)
        # what cutByModel needs: a PNG with alpha, a background cut away, a figure kept, the cost reported for the meter
        checks = {"png": cut.format == "PNG", "alpha": result["has_alpha"], "background_removed": gone > 0.05, "figure_kept": kept > 0.04, "cost_reported": isinstance(cost, (int, float))}
        result["checks"] = checks
        ok = all(checks.values())
    except Exception as e:  # noqa: BLE001
        result["error"] = str(e)[:800]
    result["ok"] = ok
    json.dump(result, open(os.path.join(OUT, "result.json"), "w"), ensure_ascii=False, indent=2)
    print(json.dumps({k: v for k, v in result.items() if k not in ("request", "response")}, ensure_ascii=False, indent=2))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
