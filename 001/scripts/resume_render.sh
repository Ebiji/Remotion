#!/bin/bash
# 書き出しが動いていなければ再開する (完成済みチャンクはスキップされる)
cd /home/user/Remotion/001
if pgrep -f "[n]ode scripts/render_chunks.mjs" >/dev/null; then echo running; else
  nohup node scripts/render_chunks.mjs 100 out/mouth8 1920 1080 >> /tmp/claude-0/-home-user/2edc8234-0b9c-5db9-9d8d-de9c3f0ab923/scratchpad/render8.log 2>&1 &
  echo restarted
fi
ls out/mouth8 | grep -c '^chunk_.*mp4$'
