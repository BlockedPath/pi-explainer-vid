#!/usr/bin/env bash
# Verify a rendered explainer: resolution, duration, audio stream, loudness, sampled frames.
set -euo pipefail
usage() { cat <<U
Usage: verify.sh <video.mp4> [--expect-duration SEC] [--frames N] [--out DIR]
  Checks with ffprobe: 1920x1080 video, an audio stream, duration (+/-1.5s if expected).
  Measures mean/max volume, and extracts N evenly spaced frames (default 8) plus a
  contact sheet to DIR (default <video>_frames/) so you can inspect them with the read tool.
  Exit code is non-zero if any check fails.
U
}
[[ $# -lt 1 || "$1" == "--help" || "$1" == "-h" ]] && { usage; exit 0; }
V="$1"; shift; EXP=""; N=8; OUT=""
while [[ $# -gt 0 ]]; do case "$1" in
  --expect-duration) EXP="$2"; shift 2;; --frames) N="$2"; shift 2;; --out) OUT="$2"; shift 2;;
  *) echo "unknown arg $1"; exit 2;; esac; done
command -v ffprobe >/dev/null || { echo "ffprobe not found (install ffmpeg)"; exit 2; }
[[ -f "$V" ]] || { echo "no such file: $V"; exit 2; }
OUT="${OUT:-${V%.*}_frames}"; mkdir -p "$OUT"; FAIL=0
ok() { echo "  PASS $*"; }; bad() { echo "  FAIL $*"; FAIL=1; }

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$V")
WH=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$V")
FPS=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$V")
AUD=$(ffprobe -v error -select_streams a -show_entries stream=codec_name,channels -of csv=p=0 "$V" | head -1)
echo "File: $V"; echo "  duration=${DUR}s size=$WH fps=$FPS audio=${AUD:-none}"
[[ "$WH" == "1920x1080" ]] && ok "resolution 1920x1080" || bad "resolution is $WH"
[[ -n "$AUD" ]] && ok "audio stream present ($AUD)" || bad "no audio stream"
if [[ -n "$EXP" ]]; then
  awk -v d="$DUR" -v e="$EXP" 'BEGIN{x=d-e; if(x<0)x=-x; exit !(x<=1.5)}' && ok "duration ~${EXP}s" || bad "duration $DUR vs expected $EXP"
fi
if [[ -n "$AUD" ]]; then
  VOL=$(ffmpeg -hide_banner -nostats -i "$V" -map 0:a:0 -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume" | sed 's/.*\] //' | tr '\n' ' ')
  echo "  $VOL"
  MEAN=$(sed -E 's/.*mean_volume: (-?[0-9.]+).*/\1/' <<<"$VOL")
  awk -v m="$MEAN" 'BEGIN{exit !(m > -40)}' && ok "audio not silent" || bad "audio nearly silent (mean $MEAN dB)"
fi
for i in $(seq 0 $((N-1))); do
  T=$(awk -v d="$DUR" -v i="$i" -v n="$N" 'BEGIN{printf "%.2f", (i+0.5)*d/n}')
  ffmpeg -v error -y -ss "$T" -i "$V" -frames:v 1 -vf scale=960:-1 "$OUT/frame_$(printf %02d $i)_${T}s.jpg"
done
ffmpeg -v error -y -ss "$(awk -v d="$DUR" 'BEGIN{printf "%.2f", d-1.5}')" -i "$V" -frames:v 1 -vf scale=960:-1 "$OUT/frame_last.jpg" || true
ffmpeg -v error -y -pattern_type glob -i "$OUT/frame_[0-9]*.jpg" -vf "scale=480:-1,tile=4x$(( (N+3)/4 ))" -frames:v 1 "$OUT/contact_sheet.jpg" || true
echo "  frames -> $OUT/ (inspect frame_*.jpg, frame_last.jpg should show the sources card)"
[[ $FAIL -eq 0 ]] && echo "RESULT: PASS" || { echo "RESULT: FAIL"; exit 1; }
