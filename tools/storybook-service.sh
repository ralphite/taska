#!/bin/zsh
# Storybook runs from web/ on http://localhost:6007, independently of the Taska server.
# LaunchAgent com.taska.storybook-app keeps it running. The watchdog restarts it only when stuck;
# after a configuration change use tools/storybook-restart.sh <who> <why> (R489).
cd "$(dirname "$0")/../web" || exit 1
export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH" # the same node as the shell builds the page with
exec ./node_modules/.bin/storybook dev -p 6007 --exact-port --host 127.0.0.1 --no-open --ci # always 6007: the links point there
