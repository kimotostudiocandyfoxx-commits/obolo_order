"""Picture comparison (R17, client 2026-11-25: cheaper anime-capable picture models).

The same four prompts the app sends (scripts/art-lab/prompts.json: an art piece from a spell, a member look from a
reference photo, a Bati dress-up, a kororin design) painted on each candidate model on Runware and on the current ones
(Seedream 5.0 Pro on Runware, Gemini 2.5 Flash Image on the Gemini API). Every Runware task asks includeCost; every model
is tried on its own (a failure is written down, the rest go on).

Writes art/lab/runware-art/<case>__<model>.jpg, costs.json (Runware's own cost per picture, seconds, errors, the average
per picture in USD and in yen at 160 JPY/USD) and README.md (the table). Run by .github/workflows/runware-art-test.yml
with RUNWARE_API_KEY (and GEMINI_API_KEY for the Gemini picture) from Secret Manager. Nothing is deployed.
"""
import base64, json, os, sys, time, urllib.request, uuid

KEY = os.environ.get("RUNWARE_API_KEY", "")
GEMINI = os.environ.get("GEMINI_API_KEY", "")
OUT = os.environ.get("OUT", "art/lab/runware-art")
ONLY = [m for m in os.environ.get("MODELS", "").split(",") if m.strip()]
USD_JPY = 160
SIDE = 1024
os.makedirs(OUT, exist_ok=True)

CASES = json.load(open(os.path.join(os.path.dirname(__file__), "prompts.json"), encoding="utf-8"))

# (slug, AIR id, how it takes the reference pictures, what it is)
MODELS = [
    ("seedream-5-pro", "bytedance:seedream@5.0-pro", "refs", "current: the looks, Bati, kororin (R16)"),
    ("gemini-2-5-flash-image", "gemini-2.5-flash-image", "gemini", "current: the art (R16), Gemini API"),
    ("flux2-klein-4b", "runware:400@4", "refs", "FLUX.2 [klein] 4B (already the MV painter)"),
    ("flux2-klein-9b", "runware:400@2", "refs", "FLUX.2 [klein] 9B"),
    ("flux3-klein", "bfl:flux@3-image-klein", "refs", "FLUX 3 Image Klein"),
    ("qwen-image-2-1-turbo", "alibaba:qwen-image@2.1-turbo", "refs", "Qwen-Image 2.1 Turbo"),
    ("seedream-5-flash", "bytedance:seedream@5.0-flash", "refs", "Seedream 5.0 Flash"),
    ("nano-banana-2-lite", "google:nano-banana@2-lite", "refs", "Nano Banana 2 Lite (on Runware)"),
    ("z-image-turbo", "runware:z-image@turbo", "none", "Z-Image Turbo (words only: the references are left out)"),
    ("animagine-xl-4", "search:Animagine XL 4.0", "ip", "Animagine XL 4.0 (SDXL anime) + IP-Adapter"),
    ("illustrious-xl", "search:Illustrious XL", "ip", "an Illustrious-XL anime checkpoint + IP-Adapter"),
]
IP_ADAPTER = "runware:55@1"
NEGATIVE = "lowres, bad anatomy, bad hands, text, watermark, signature, worst quality, low quality, photo, realistic, 3d, nsfw, nude"


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


def data_uri(path):
    mime = "image/png" if path.endswith(".png") else "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(open(path, "rb").read()).decode()


def find_checkpoint(search):
    got = runware([{"taskType": "modelSearch", "taskUUID": str(uuid.uuid4()), "search": search, "category": "checkpoint", "architecture": "sdxl", "limit": 10}], 60)
    rows = [r for d in got.get("data", []) for r in d.get("results", [])]
    word = search.split()[0].lower()
    pick = [r for r in rows if word in f"{r.get('name', '')} {r.get('version', '')}".lower() and not any(x in f"{r.get('name', '')}".lower() for x in ("nsfw", "hentai", "porn"))]
    if not pick:
        raise RuntimeError(f"no {search} on Runware: {[r.get('name') for r in rows][:10]}")
    print(f"  {search} → {pick[0].get('name')} {pick[0].get('version', '')} ({pick[0].get('air')})")
    return pick[0]["air"]


def paint_runware(air, how, case):
    refs = [data_uri(p) for p in case["refs"]] if how != "none" else []
    task = {"taskType": "imageInference", "taskUUID": str(uuid.uuid4()), "model": air, "positivePrompt": case["prompt"][:1900 if how == "ip" else 3000],
            "width": SIDE, "height": SIDE, "numberResults": 1, "outputType": "URL", "outputFormat": "JPG", "includeCost": True}
    if how == "ip":
        task.update({"negativePrompt": NEGATIVE, "steps": 28, "CFGScale": 5})
        if refs:
            task["ipAdapters"] = [{"model": IP_ADAPTER, "guideImage": refs[0], "weight": 0.6}]
    elif refs:
        task["referenceImages"] = refs[:4] if air.startswith(("runware:400@", "bfl:")) else refs
    got = runware([task])
    if got.get("errors") and refs and how == "refs":
        # some models take the references inside `inputs` (Runware's newer schema)
        task.pop("referenceImages", None)
        task["inputs"] = {"referenceImages": refs[:4]}
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


def paint_gemini(model, case):
    if not GEMINI:
        raise RuntimeError("no GEMINI_API_KEY")
    parts = [{"inlineData": {"mimeType": "image/jpeg", "data": base64.b64encode(open(p, "rb").read()).decode()}} for p in case["refs"]]
    body = {"contents": [{"role": "user", "parts": parts + [{"text": case["prompt"]}]}], "generationConfig": {"responseModalities": ["IMAGE"]}}
    req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", data=json.dumps(body).encode(),
                                 headers={"content-type": "application/json", "x-goog-api-key": GEMINI})
    with urllib.request.urlopen(req, timeout=180) as r:
        j = json.loads(r.read())
    out = (j.get("usageMetadata") or {}).get("candidatesTokenCount", 1290)
    cost = (j.get("usageMetadata") or {}).get("promptTokenCount", 0) * 0.3e-6 + out * 30e-6
    for p in j.get("candidates", [{}])[0].get("content", {}).get("parts", []):
        if p.get("inlineData", {}).get("data"):
            return base64.b64decode(p["inlineData"]["data"]), round(cost, 5)
    raise RuntimeError("Gemini returned no picture")


results = {}
for slug, air, how, what in MODELS:
    if ONLY and slug not in ONLY:
        continue
    print(f"== {slug} ({what})")
    row = {"model": air, "about": what, "cases": {}}
    results[slug] = row
    try:
        if air.startswith("search:"):
            air = find_checkpoint(air[len("search:"):])
            row["model"] = air
    except Exception as e:  # the model is not there: written down, the next one goes on
        row["error"] = str(e)[:600]
        print("  FAILED", e, file=sys.stderr)
        continue
    for case in CASES:
        t0 = time.time()
        try:
            img, cost = paint_gemini(air, case) if how == "gemini" else paint_runware(air, how, case)
            name = f"{case['id']}__{slug}.jpg"
            open(os.path.join(OUT, name), "wb").write(img)
            row["cases"][case["id"]] = {"file": name, "cost_usd": cost, "seconds": round(time.time() - t0, 1), **({"note": "references left out"} if how == "none" and case["refs"] else {})}
            print(f"  {case['id']}: ${cost} in {row['cases'][case['id']]['seconds']} s")
        except Exception as e:
            row["cases"][case["id"]] = {"error": str(e)[:600], "seconds": round(time.time() - t0, 1)}
            print(f"  {case['id']}: FAILED {e}", file=sys.stderr)
    costs = [c["cost_usd"] for c in row["cases"].values() if isinstance(c.get("cost_usd"), (int, float))]
    if costs:
        row["avg_usd"] = round(sum(costs) / len(costs), 5)
        row["avg_jpy"] = round(row["avg_usd"] * USD_JPY, 2)

json.dump({"usd_jpy": USD_JPY, "side": SIDE, "cases": [{k: c[k] for k in ("id", "use", "refs")} for c in CASES], "models": results}, open(os.path.join(OUT, "costs.json"), "w"), ensure_ascii=False, indent=2)
lines = ["# Picture comparison (R17)", "", f"Runware's own cost per picture (includeCost), {SIDE}×{SIDE}, ¥ at {USD_JPY} JPY/USD. Prompts: scripts/art-lab/prompts.json.", "",
         "| model | " + " | ".join(c["id"] for c in CASES) + " | avg ¥ |", "|---|" + "---|" * (len(CASES) + 1)]
for slug, row in results.items():
    cells = []
    for c in CASES:
        r = row["cases"].get(c["id"], {})
        cells.append(f"[¥{r['cost_usd'] * USD_JPY:.2f}]({r['file']})" if isinstance(r.get("cost_usd"), (int, float)) else ("—" if not r else "failed"))
    lines.append(f"| {slug} `{row['model']}` | " + " | ".join(cells) + f" | {row.get('avg_jpy', '—')} |")
open(os.path.join(OUT, "README.md"), "w").write("\n".join(lines) + "\n")
ok = sum(1 for r in results.values() for c in r["cases"].values() if "file" in c)
print(f"{ok} pictures; costs in {OUT}/costs.json")
sys.exit(0 if ok else 1)
