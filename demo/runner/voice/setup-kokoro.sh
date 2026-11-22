#!/usr/bin/env bash
# Installs the Kokoro voice for demo narration on Linux (or anywhere with python3), into
# demo/.cache/voice/kokoro (or $DEMO_KOKORO_DIR). Free and offline once installed. Needs:
#   - python3 with venv (apt: python3-venv)
#   - pypi.org and files.pythonhosted.org for kokoro-onnx 0.6.1 and its dependencies (~150 MB)
#   - github.com and release-assets.githubusercontent.com for the model files (~337 MB, Apache-2.0)
# Re-running skips what is already there. tts.mjs picks Kokoro up from that folder by itself.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dir=${DEMO_KOKORO_DIR:-$here/../../.cache/voice/kokoro}
mkdir -p "$dir"; dir=$(cd "$dir" && pwd)
models=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
start=$(date +%s)
if [[ ! -x $dir/venv/bin/python ]]; then
  # python3 -m venv needs python3-venv on Debian and Ubuntu; uv makes one without it
  python3 -m venv "$dir/venv" 2>/dev/null || { rm -rf "$dir/venv"; command -v uv >/dev/null && uv venv -q --seed "$dir/venv"; } ||
    { echo "can't make a Python venv: install python3-venv (apt) or uv" >&2; exit 1; }
fi
"$dir/venv/bin/python" -m pip install --quiet --disable-pip-version-check kokoro-onnx==0.6.1
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  if [[ ! -s $dir/$f ]]; then
    curl -fsSL --retry 2 -o "$dir/$f.part" "$models/$f" || { echo "could not download $f from $models" >&2; exit 1; }
    mv -f "$dir/$f.part" "$dir/$f"
  fi
done
echo "Kokoro voice ready in $dir ($(du -sh "$dir" | cut -f1), $(( $(date +%s) - start )) s)"
