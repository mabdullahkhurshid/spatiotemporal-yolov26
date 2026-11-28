#!/bin/sh
# Fake cameras: streams every $MEDIA_DIR/<name>.mp4 to $RTSP_BASE/demo/<name> on an endless loop.
# Rescans the folder so videos added later start streaming and removed ones stop.
# Names other than [A-Za-z0-9_-] are skipped (same rule as backend/utils/demoSource.js).
MEDIA_DIR="${MEDIA_DIR:-/media}"
RTSP_BASE="${RTSP_BASE:-rtsp://mediamtx:8554}"
SCAN_SECONDS="${SCAN_SECONDS:-5}"
PID_DIR=/tmp/fakecam
# /tmp survives a container stop/start (Docker Desktop restart), so pid files from the last run would
# make every video look already streaming and none would start. Start clean.
rm -rf "$PID_DIR"
mkdir -p "$PID_DIR"

target="$RTSP_BASE"
if [ -n "$MEDIAMTX_INTERNAL_USER" ]; then
  target=$(echo "$RTSP_BASE" | sed "s#://#://$MEDIAMTX_INTERNAL_USER:$MEDIAMTX_INTERNAL_PASS@#")
fi

# Re-encoding keeps timestamps continuous across loops and puts a keyframe every second.
loop_video() {
  while [ -f "$2" ]; do
    echo "fakecam: streaming $2 -> demo/$1"
    ffmpeg -hide_banner -loglevel warning -re -stream_loop -1 -i "$2" -an \
      -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -g 25 \
      -f rtsp -rtsp_transport tcp "$target/demo/$1"
    echo "fakecam: demo/$1 stopped, restarting in 2s"
    sleep 2
  done
}

while true; do
  for file in "$MEDIA_DIR"/*.mp4; do
    [ -f "$file" ] || continue
    name=$(basename "$file" .mp4)
    case "$name" in '' | *[!A-Za-z0-9_-]*) continue ;; esac
    # Start when never started, or when its loop died (pid file left behind).
    if [ ! -f "$PID_DIR/$name" ] || ! kill -0 "$(cat "$PID_DIR/$name")" 2>/dev/null; then
      loop_video "$name" "$file" &
      echo $! > "$PID_DIR/$name"
    fi
  done

  for pidfile in "$PID_DIR"/*; do
    [ -f "$pidfile" ] || continue
    name=$(basename "$pidfile")
    if [ ! -f "$MEDIA_DIR/$name.mp4" ]; then
      echo "fakecam: $name.mp4 removed, stopping demo/$name"
      pid=$(cat "$pidfile")
      pkill -P "$pid" 2>/dev/null
      kill "$pid" 2>/dev/null
      rm -f "$pidfile"
    fi
  done

  sleep "$SCAN_SECONDS"
done
