#!/bin/bash
# 書き出しを見張る: プロセスが落ちていれば再開し、全チャンクが揃うまで続ける。
# このスクリプトを実行し続けている間はコンテナも動き続ける。
# usage: render_supervised.sh <outDir> <chunkFrames> <width> <height> <logFile>
cd /home/user/Remotion/001
OUT=$1; CH=$2; W=$3; H=$4; LOG=$5
while ! grep -q "ALL DONE" "$LOG" 2>/dev/null; do
  if ! pgrep -f "[n]ode scripts/render_chunks.mjs" >/dev/null; then
    rm -f "$OUT"/*.part.mp4
    echo "[supervisor] start $(date +%H:%M:%S) chunks=$(ls $OUT 2>/dev/null | grep -c '^chunk_.*mp4$')" >> "$LOG"
    nohup node scripts/render_chunks.mjs "$CH" "$OUT" "$W" "$H" >> "$LOG" 2>&1 &
    sleep 20
  fi
  sleep 15
done
echo "[supervisor] finished $(date +%H:%M:%S)"
