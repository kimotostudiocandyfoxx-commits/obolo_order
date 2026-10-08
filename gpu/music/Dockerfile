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
ENV PATH=/opt/ace/.venv/bin:$PATH \
    ACESTEP_PROJECT_ROOT=/opt/ace \
    ACESTEP_CHECKPOINTS_DIR=/models/ace15 \
    HF_HOME=/models/hf \
    MUSIC_ENGINE=acestep15 \
    PYTHONUNBUFFERED=1 PORT=8080
WORKDIR /app
COPY app.py render.py ./
# model weights are cached on the Cloud Storage volume mounted at /models (downloaded on first start)
CMD exec python -m uvicorn app:app --host 0.0.0.0 --port ${PORT} --workers 1
