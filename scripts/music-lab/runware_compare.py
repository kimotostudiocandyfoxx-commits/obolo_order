"""Listening test (2026-11-25): the same Japanese lyrics sung by Runware's ACE-Step 1.5 XL SFT and MiniMax Music 2.6.
Writes art/lab/runware-music/{1-ace-step-xl-sft,2-minimax-music-2-6}.mp3 and costs.json (Runware's own cost per task).
Run by .github/workflows/runware-music-test.yml with RUNWARE_API_KEY from Secret Manager."""
import json, os, sys, time, urllib.request, uuid

KEY = os.environ["RUNWARE_API_KEY"]
OUT = os.environ.get("OUT", "art/lab/runware-music")
os.makedirs(OUT, exist_ok=True)

LYRICS = """[Intro]

[Verse]
夜の街に 広がる
青とピンクの 光
シンセの音が 揺れて
ステップを はじめるよ

[Pre-Chorus]
胸のおくで なにかが鳴る
もうすぐ とどきそう

[Chorus]
光の中へ 光の中へ
とけていく 夜の向こう
光の中へ 光の中へ
ふたりで 踊りつづけよう

[Outro]
"""
PROMPT = ("Japanese city pop dance song, female vocal, bright synths, groovy bass, "
          "four-on-the-floor drums, 118 BPM, catchy chorus, polished modern production")

TASKS = [
    ("1-ace-step-xl-sft", {"model": "runware:ace-step@v1.5-xl-sft", "duration": 75,
                           "settings": {"lyrics": LYRICS, "vocalLanguage": "ja"}}),
    ("2-minimax-music-2-6", {"model": "minimax:music@2.6", "settings": {"lyrics": LYRICS}}),
]


def call(body):
    req = urllib.request.Request("https://api.runware.ai/v1", data=json.dumps(body).encode(),
                                 headers={"content-type": "application/json", "Authorization": f"Bearer {KEY}"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.loads(r.read())


costs = {}
failed = False
for name, extra in TASKS:
    task = {"taskType": "audioInference", "taskUUID": str(uuid.uuid4()), "positivePrompt": PROMPT,
            "outputFormat": "MP3", "outputType": "URL", "includeCost": True, "deliveryMethod": "async", **extra}
    t0 = time.time()
    try:
        call([task])
        res = None
        for _ in range(120):  # up to ~10 minutes
            time.sleep(5)
            got = call([{"taskType": "getResponse", "taskUUID": task["taskUUID"]}])
            if got.get("errors"):
                raise RuntimeError(json.dumps(got["errors"], ensure_ascii=False)[:800])
            items = [d for d in got.get("data", []) if d.get("taskUUID") == task["taskUUID"]]
            if items and (items[0].get("audioURL") or items[0].get("status") == "success"):
                res = items[0]
                break
        if not res:
            raise RuntimeError("timed out")
        url = res.get("audioURL") or res.get("audioUrl")
        urllib.request.urlretrieve(url, f"{OUT}/{name}.mp3")
        costs[name] = {"cost_usd": res.get("cost"), "seconds": round(time.time() - t0, 1), "model": extra["model"]}
        print(name, costs[name])
    except Exception as e:  # keep going so the other model is still tried
        failed = True
        costs[name] = {"error": str(e)[:800], "model": extra["model"]}
        print(name, "FAILED", e, file=sys.stderr)

json.dump(costs, open(f"{OUT}/costs.json", "w"), ensure_ascii=False, indent=2)
open(f"{OUT}/lyrics.txt", "w").write(PROMPT + "\n\n" + LYRICS)
sys.exit(1 if failed and len([c for c in costs.values() if "error" in c]) == len(TASKS) else 0)
