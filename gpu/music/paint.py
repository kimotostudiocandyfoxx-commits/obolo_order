"""
OBOLO ORDER — Mars MV scene painter: Animagine XL 4.0 Opt (CreativeML Open RAIL++-M, client choice
2026-10-08) on the same L4 as the music models.

Novita retired its checkpoint txt2img routes (404 since 2026-10), so the anime checkpoint runs here.
It loads on the first POST /paint (not at start-up: a song alone never pays for it):
  1. the single-file checkpoint is copied from the model bucket (CKPT_BUCKET/paint/…, parallel slices);
  2. if it is not there yet, it is fetched from Hugging Face once and put in the bucket for next time.
On the GPU it takes ~7 GB next to ACE-Step and Seed-VC; if the card is too full it runs with CPU
offload (slower, still works).
"""
import base64
import io
import os
import threading
import time
import traceback

PAINT_REPO = os.environ.get("PAINT_REPO", "cagliostrolab/animagine-xl-4.0")
PAINT_FILE = os.environ.get("PAINT_FILE", "animagine-xl-4.0-opt.safetensors")
LOCAL = os.environ.get("PAINT_LOCAL_DIR", "/tmp/paint")

state: dict = {"pipe": None, "error": None, "phase": "idle", "loadSeconds": None}
load_lock = threading.Lock()
paint_lock = threading.Lock()


def _fetch(bucket_name: str) -> str:
    """The checkpoint on local disk (bucket first, else Hugging Face, then saved to the bucket)."""
    path = os.path.join(LOCAL, PAINT_FILE)
    os.makedirs(LOCAL, exist_ok=True)
    if os.path.exists(path):
        return path
    blob = None
    if bucket_name:
        from google.cloud import storage
        from google.cloud.storage import transfer_manager

        blob = storage.Client().bucket(bucket_name).blob(f"paint/{PAINT_FILE}")
        if blob.exists():
            state["phase"] = "copying painter"
            blob.reload()
            transfer_manager.download_chunks_concurrently(blob, path, chunk_size=64 * 1024 * 1024, max_workers=16, worker_type=transfer_manager.THREAD)
            return path
    state["phase"] = "downloading painter"
    from huggingface_hub import hf_hub_download

    got = hf_hub_download(PAINT_REPO, PAINT_FILE, local_dir=LOCAL)
    if blob is not None:
        # into the bucket for the next start, in the background (the pictures do not wait for it)
        keep = got + ".upload"
        os.link(got, keep)

        def save():
            try:
                blob.upload_from_filename(keep, timeout=1800)
                print("paint: checkpoint saved to the bucket", flush=True)
            except Exception as e:  # noqa: BLE001 — next start downloads it again, no harm
                print(f"paint: could not save the checkpoint to the bucket: {e!r}", flush=True)
            finally:
                os.remove(keep)

        threading.Thread(target=save, daemon=True).start()
    return got


def load(bucket_name: str) -> None:
    with load_lock:
        if state["pipe"] is not None:
            return
        t0 = time.time()
        try:
            import torch
            from diffusers import EulerAncestralDiscreteScheduler, StableDiffusionXLPipeline

            path = _fetch(bucket_name)
            state["phase"] = "loading painter"
            pipe = StableDiffusionXLPipeline.from_single_file(path, torch_dtype=torch.float16, use_safetensors=True)
            # Animagine XL 4.0's model card: Euler a
            pipe.scheduler = EulerAncestralDiscreteScheduler.from_config(pipe.scheduler.config)
            free, _ = torch.cuda.mem_get_info()
            if free > 9 * 1024**3:
                pipe.to("cuda")
                where = "gpu"
            else:
                pipe.enable_model_cpu_offload()
                where = "gpu+cpu offload"
            pipe.set_progress_bar_config(disable=True)
            state["pipe"] = pipe
            state["error"] = None
            state["phase"] = "ready"
            state["loadSeconds"] = round(time.time() - t0)
            print(f"painter ready in {time.time() - t0:.0f}s ({where}, {free / 1024**3:.1f} GB free before)", flush=True)
            try:
                os.remove(path)  # /tmp is memory: give it back
            except OSError:
                pass
        except Exception as e:  # noqa: BLE001
            state["error"] = repr(e)[:300]
            state["phase"] = "failed"
            traceback.print_exc()


IP_REPO = os.environ.get("PAINT_IP_REPO", "h94/IP-Adapter")
IP_WEIGHT = os.environ.get("PAINT_IP_WEIGHT", "ip-adapter-plus_sdxl_vit-h.safetensors")


def _ip_adapter(pipe) -> None:
    """IP-Adapter (SDXL, ViT-H): the hero's own picture steers every hero scene, so the creator's
    character looks like itself and the same in every scene (tags alone cannot draw an original
    character). Loaded the first time a reference picture comes."""
    if state.get("ip"):
        return
    import torch
    from transformers import CLIPVisionModelWithProjection

    t = time.time()
    enc = CLIPVisionModelWithProjection.from_pretrained(IP_REPO, subfolder="models/image_encoder", torch_dtype=torch.float16)
    pipe.image_encoder = enc.to("cuda")
    pipe.load_ip_adapter(IP_REPO, subfolder="sdxl_models", weight_name=IP_WEIGHT, image_encoder_folder=None)
    state["ip"] = True
    print(f"paint: IP-Adapter ready in {time.time() - t:.0f}s", flush=True)


def paint(items: list[dict], negative: str, side: int, steps: int, cfg: float, ref_b64: str | None = None, ref_scale: float = 0.6) -> list[str | None]:
    """Each item {prompt, seed, hero} → a JPEG (base64), in order; None where one failed.
    With a reference picture, the hero scenes are painted looking at it (IP-Adapter, ref_scale)."""
    import torch
    from PIL import Image

    pipe = state["pipe"]
    side = max(512, min(1536, side // 64 * 64))
    out: list[str | None] = []
    with paint_lock:
        ref = None
        if ref_b64:
            try:
                _ip_adapter(pipe)
                ref = Image.open(io.BytesIO(base64.b64decode(ref_b64))).convert("RGB")
            except Exception as e:  # noqa: BLE001 — paint without it
                print(f"paint: no IP-Adapter ({e!r})", flush=True)
                traceback.print_exc()
        elif state.get("ip"):
            # loaded but no picture this time: every hero scene paints from its words (scale 0)
            ref = Image.new("RGB", (224, 224), "white")
            ref_scale = 0.0
        for it in items:
            try:
                g = torch.Generator(device="cuda").manual_seed(int(it.get("seed", 0)) % 2**31)
                extra = {}
                if ref is not None:
                    # every call needs the picture once the adapter is in; scale 0 = not used for this scene
                    pipe.set_ip_adapter_scale(ref_scale if it.get("hero") else 0.0)
                    extra = {"ip_adapter_image": ref}
                img = pipe(
                    prompt=it["prompt"],
                    negative_prompt=negative,
                    width=side,
                    height=side,
                    num_inference_steps=steps,
                    guidance_scale=cfg,
                    generator=g,
                    **extra,
                ).images[0]
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=90)
                out.append(base64.b64encode(buf.getvalue()).decode())
            except Exception as e:  # noqa: BLE001
                print(f"paint: one picture failed: {e!r}", flush=True)
                out.append(None)
    return out
