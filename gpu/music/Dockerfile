# Cloud Run GPU (NVIDIA L4) service for Mercury instrumentals. Build context = gpu/music.
# ACE-Step 1.5 (MIT) is installed from its repository with uv (its pyproject pins PyTorch cu128 and
# a bundled nano-vllm); our small FastAPI app runs inside that environment.
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg git libsndfile1 build-essential && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
ARG ACE_REF=main
RUN git clone --depth 1 --branch "$ACE_REF" https://github.com/ace-step/ACE-Step-1.5.git /opt/ace \
 && cd /opt/ace && UV_LINK_MODE=copy uv sync --frozen --no-dev --python /usr/local/bin/python3.11 \
 && rm -rf /root/.cache/uv
# fast cold start: the weights are copied from the bucket with parallel downloads (app.py copy_weights)
RUN uv pip install --python /opt/ace/.venv/bin/python "google-cloud-storage>=2.14" && rm -rf /root/.cache/uv
# HTDemucs (Demucs v4, MIT) splits the sung song into vocals + instrumental (POST /song). Installed
# without its own dependency pins so ACE-Step's PyTorch stays as it is; the weights are baked in.
RUN uv pip install --python /opt/ace/.venv/bin/python --no-deps "demucs==4.0.1" "openunmix==1.3.0" \
 && uv pip install --python /opt/ace/.venv/bin/python julius einops "dora-search>=0.1.12" pyyaml tqdm \
 && rm -rf /root/.cache/uv
ENV TORCH_HOME=/opt/torch TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD=1
RUN /opt/ace/.venv/bin/python -c "from demucs.pretrained import get_model; get_model('htdemucs_ft')"
ENV PATH=/opt/ace/.venv/bin:$PATH \
    ACESTEP_PROJECT_ROOT=/opt/ace \
    ACESTEP_CHECKPOINTS_DIR=/models/ace15 \
    HF_HOME=/models/hf \
    MUSIC_ENGINE=acestep15 \
    PYTHONUNBUFFERED=1 PORT=8080
# Seed-VC (GPL-3.0): zero-shot singing voice conversion into the member's voice (svc_worker.py).
# Its own environment, as Seed-VC pins them (PyTorch 2.4, transformers 4.46); the checkpoints
# (singing DiT, BigVGAN, Whisper, RMVPE, CAM++) are baked in under /opt/seedvc/checkpoints.
ARG SEEDVC_REF=51383efd921027683c89e5348211d93ff12ac2a8
RUN git clone https://github.com/Plachtaa/seed-vc.git /opt/seedvc && cd /opt/seedvc && git checkout "$SEEDVC_REF" \
 && uv venv /opt/svc --python /usr/local/bin/python3.11 \
 && uv pip install --python /opt/svc/bin/python "torch==2.4.0" "torchaudio==2.4.0" --index-url https://download.pytorch.org/whl/cu121 \
 && uv pip install --python /opt/svc/bin/python "scipy==1.13.1" "librosa==0.10.2" "huggingface-hub>=0.28.1" "munch==4.0.0" "einops==0.8.0" \
      "descript-audio-codec==1.0.0" "transformers==4.46.3" "soundfile==0.12.1" "numpy==1.26.4" pyyaml matplotlib tqdm \
 && rm -rf /root/.cache/uv
COPY svc_worker.py /app/svc_worker.py
RUN cd /opt/seedvc && /opt/svc/bin/python /app/svc_worker.py download
WORKDIR /app
COPY app.py render.py svc_worker.py paint.py ./
# model weights are cached on the Cloud Storage volume mounted at /models (downloaded on first start)
CMD exec python -m uvicorn app:app --host 0.0.0.0 --port ${PORT} --workers 1
