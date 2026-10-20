#!/bin/zsh
# Runs Taska v2 as an always-on service next to the old app, from a macOS LaunchAgent (com.taska.v2). zsh reads
# ~/.zshenv, which can provide GEMINI_API_KEY. Data is a copy made by `python3 -m taska import --to ~/.taska-v2`;
# the old app's ~/.taska is never touched. The page comes from v2/web/dist (npm --prefix v2/web run build).
cd "$(dirname "$0")/../server" || exit 1
exec /opt/homebrew/bin/python3 -m taska serve --host 127.0.0.1 --port 7341 --root ~/.taska-v2
