#!/bin/zsh
# The parity page on 127.0.0.1:7355 (reports, the tool's own check, old and new side by side). LaunchAgent
# com.taska.parity-page.
cd "$(dirname "$0")/.." || exit 1
exec /opt/homebrew/bin/python3 serve.py --port 7355
