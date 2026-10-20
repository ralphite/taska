#!/bin/zsh
# Runs the old one-file Taska read-only on port 7341, beside Taska (v2) on 7340, to compare: its data is the copy
# taken on the switch (~/.taska-old.noindex), so it never touches ~/.taska. LaunchAgent: com.taska.old.
cd "$(dirname "$0")/.." || exit 1
exec /usr/bin/python3 taska.py --host 127.0.0.1 --port 7341 --root ~/.taska-old.noindex --read-only --organizer off
