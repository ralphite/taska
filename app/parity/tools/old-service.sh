#!/bin/zsh
# The old Taska (snapshot 1279806) on 127.0.0.1:7350, for Yadong to compare with the rewrite on 7351 at any time.
# Runs from the LaunchAgent com.taska.parity-old. Its data is a copy of the snapshot made the first time
# (/Users/yadong/taska-rewrite/parity/live-old); what is done on this page stays there. No Gemini key: as the rewrite.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
unset GEMINI_API_KEY GOOGLE_API_KEY GOOGLE_GENERATIVE_AI_API_KEY
DATA=/Users/yadong/taska-rewrite/parity/live-old
HERE="$(cd "$(dirname "$0")/.." && pwd)"
[[ -d $DATA ]] || /opt/homebrew/bin/python3 "$HERE/data.py" "$DATA" || exit 1
cd /Users/yadong/taska-rewrite/baseline/v2/server || exit 1
export TASKA_WEB_DIST=/Users/yadong/taska-rewrite/baseline/v2/web/dist
exec /opt/homebrew/bin/python3 -m taska serve --host 127.0.0.1 --port 7350 --root "$DATA" --organizer off
