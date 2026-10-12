#!/bin/zsh
# Runs Taska as an always-on service, e.g. from a macOS LaunchAgent. zsh reads ~/.zshenv, which can provide
# GEMINI_API_KEY. Data lives in ~/.taska/<project>/. Running Taska by hand needs none of this: python3 taska.py
cd "$(dirname "$0")/.." || exit 1
args=(--host 127.0.0.1 --port 7340 --root ~/.taska)
# The public address (a tunnel to this port), if any: $TASKA_PUBLIC, or the first line of ~/.taska/public-url.
# From there Taska asks for the key in ~/.taska/key.
PUBLIC="${TASKA_PUBLIC:-$(head -n 1 ~/.taska/public-url 2>/dev/null)}"
[[ -n "$PUBLIC" ]] && args+=(--public "$PUBLIC")
exec /usr/bin/python3 taska.py "${args[@]}"
