# Cloud Run GPU (NVIDIA L4) service for Mercury instrumentals. Build context = gpu/music.
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg git libsndfile1 build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py render.py ./
# model weights are cached on the Cloud Storage volume mounted at /models (downloaded on first start)
ENV HF_HOME=/models/hf ACE_CHECKPOINT_DIR=/models/ace-step MUSIC_ENGINE=acestep PYTHONUNBUFFERED=1 PORT=8080
CMD exec uvicorn app:app --host 0.0.0.0 --port ${PORT} --workers 1
