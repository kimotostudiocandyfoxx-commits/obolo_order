#!/usr/bin/env bash
# Separate the singing voice from the song (Spleeter 2 stems) -> <project>/work/vocals.wav (+ accompaniment.wav)
#   bash mv-kit/tools/separate.sh <project-dir> [<tools-dir>]
set -euo pipefail
PRJ="$(cd "$1" && pwd)"; T="${2:-$HOME/.mvkit}"
SONG="$PRJ/$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('song','song.mp3'))" "$PRJ/project.json")"
mkdir -p "$PRJ/work/sep"
( cd "$T" && MODEL_PATH="$T/pretrained_models" "$T/py310/bin/spleeter" separate -p spleeter:2stems -o "$PRJ/work/sep" "$SONG" )
B="$(basename "${SONG%.*}")"
cp "$PRJ/work/sep/$B/vocals.wav" "$PRJ/work/vocals.wav"; cp "$PRJ/work/sep/$B/accompaniment.wav" "$PRJ/work/accompaniment.wav"
echo "-> $PRJ/work/vocals.wav"
