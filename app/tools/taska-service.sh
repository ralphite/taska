#!/bin/zsh
# Runs Taska (the rewrite, app/) as the always-on service on port 7340 with the data in ~/.taska, from the LaunchAgent
# com.taska.app. zsh reads ~/.zshenv, which can provide GEMINI_API_KEY (the organizer). The page comes from
# app/web/live, the copy of app/web/dist that app/tools/ship.sh makes when it puts new code live (a build made for a
# test stays out of it); before the first ship, from app/web/dist. The public address (a tunnel to this port), if any:
# $TASKA_PUBLIC, or the first line of ~/.taska/public-url; from there Taska asks for the key in ~/.taska/key.
cd "$(dirname "$0")/../server" || exit 1
# ffmpeg, ffprobe (voice notes) are where Homebrew puts them: launchd gives none of that
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[[ -f ../web/live/index.html ]] && export TASKA_WEB_DIST="$PWD/../web/live"
args=(--host 127.0.0.1 --port 7340 --root ~/.taska)
PUBLIC="${TASKA_PUBLIC:-$(head -n 1 ~/.taska/public-url 2>/dev/null)}"
[[ -n "$PUBLIC" ]] && args+=(--public "$PUBLIC")
exec /opt/homebrew/bin/python3 -m taska serve "${args[@]}"
