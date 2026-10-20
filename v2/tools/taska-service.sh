#!/bin/zsh
# Runs Taska (v2) as the always-on service on port 7340 with the data in ~/.taska, from the LaunchAgent
# com.taska.app. zsh reads ~/.zshenv, which can provide GEMINI_API_KEY. The page comes from v2/web/dist
# (npm --prefix v2/web run build). The public address (a tunnel to this port), if any: $TASKA_PUBLIC, or the first
# line of ~/.taska/public-url; from there Taska asks for the key in ~/.taska/key.
cd "$(dirname "$0")/../server" || exit 1
args=(--host 127.0.0.1 --port 7340 --root ~/.taska)
PUBLIC="${TASKA_PUBLIC:-$(head -n 1 ~/.taska/public-url 2>/dev/null)}"
[[ -n "$PUBLIC" ]] && args+=(--public "$PUBLIC")
exec /opt/homebrew/bin/python3 -m taska serve "${args[@]}"
