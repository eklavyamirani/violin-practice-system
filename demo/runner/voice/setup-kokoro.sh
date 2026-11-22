#!/usr/bin/env bash
# Installs the Kokoro voice for demo narration on Linux (or anywhere with python3), into
# demo/.cache/voice/kokoro (or $DEMO_KOKORO_DIR). Free and offline once installed. Needs:
#   - python3 with venv (apt: python3-venv)
#   - pypi.org and files.pythonhosted.org for kokoro-onnx 0.6.1 and its dependencies (~190 MB)
#   - github.com and release-assets.githubusercontent.com for the model files (~338 MB, Apache-2.0)
# The model files come from a third party's GitHub release, so each is pinned by sha256 and checked after
# download and again when reused. On a mismatch the file is deleted and the script fails; without the
# "verified" stamp it writes last, tts.mjs doesn't use Kokoro and the runner falls back to espeak-ng.
# Re-running skips what is already there and checks out. tts.mjs picks Kokoro up from that folder by itself.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dir=${DEMO_KOKORO_DIR:-$here/../../.cache/voice/kokoro}
mkdir -p "$dir"; dir=$(cd "$dir" && pwd)
models=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
# sha256 of the release's files as downloaded on 2026-11-21 (the release publishes no checksums; sizes
# 325532387 and 28214398 bytes match its listing)
pin() { case $1 in
  kokoro-v1.0.onnx) echo 7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5 ;;
  voices-v1.0.bin)  echo bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d ;;
esac; }
sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1; }
start=$(date +%s)
rm -f "$dir/verified"
if [[ ! -x $dir/venv/bin/python ]]; then
  # python3 -m venv needs python3-venv on Debian and Ubuntu; uv makes one without it
  python3 -m venv "$dir/venv" 2>/dev/null || { rm -rf "$dir/venv"; command -v uv >/dev/null && uv venv -q --seed "$dir/venv"; } ||
    { echo "can't make a Python venv: install python3-venv (apt) or uv" >&2; exit 1; }
fi
"$dir/venv/bin/python" -m pip install --quiet --disable-pip-version-check kokoro-onnx==0.6.1
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  want=$(pin "$f")
  if [[ -s $dir/$f ]] && [[ $(sha256 "$dir/$f") != "$want" ]]; then
    echo "$f in $dir doesn't match its pinned sha256: deleting it and downloading again" >&2
    rm -f "$dir/$f"
  fi
  if [[ ! -s $dir/$f ]]; then
    curl -fsSL --retry 2 -o "$dir/$f.part" "$models/$f" || { rm -f "$dir/$f.part"; echo "could not download $f from $models" >&2; exit 1; }
    got=$(sha256 "$dir/$f.part")
    if [[ $got != "$want" ]]; then
      rm -f "$dir/$f.part"
      echo "$f from $models has sha256 $got, not the pinned $want. Not using it: the release may have changed." >&2
      echo "Narration falls back to espeak-ng. If the new file is known to be good, update the pin in $0." >&2
      exit 1
    fi
    mv -f "$dir/$f.part" "$dir/$f"
  fi
done
for f in kokoro-v1.0.onnx voices-v1.0.bin; do echo "$(pin "$f")  $f"; done > "$dir/verified"
echo "Kokoro voice ready in $dir ($(du -sh "$dir" | cut -f1), $(( $(date +%s) - start )) s)"
