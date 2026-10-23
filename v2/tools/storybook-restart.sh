#!/bin/zsh
# B517: the one way to restart Storybook (LaunchAgent com.taska.storybook, http://localhost:6007). Every restart is
# written to .logs/storybook-restarts.log with the time, who asked and why.
#   zsh v2/tools/storybook-restart.sh <who> <why>
# Agents do not restart Storybook (rule R489): the watchdog (storybook-watchdog.py) restarts it when its page has not
# answered for minutes. A restart cuts every open Storybook page for a while (the page reloads by itself after).
# It loads the LaunchAgent again from v2/tools/launchd/com.taska.storybook.plist, so a change there takes effect too.
who=$1
shift
why="$*"
if [[ -z $who || -z $why ]]; then
  echo "usage: storybook-restart.sh <who> <why>" >&2
  exit 2
fi
tools="$(cd "$(dirname "$0")" && pwd)"
log="$(cd "$tools/../.." && pwd)/.logs/storybook-restarts.log"
plist="$HOME/Library/LaunchAgents/com.taska.storybook.plist"
mkdir -p "$(dirname "$log")"
print -r -- "$(date '+%Y-%m-%d %H:%M:%S') $who: $why" >>"$log"
cp "$tools/launchd/com.taska.storybook.plist" "$plist"
launchctl bootout "gui/$(id -u)/com.taska.storybook" 2>/dev/null
for i in {1..20}; do launchctl print "gui/$(id -u)/com.taska.storybook" >/dev/null 2>&1 || break; sleep 0.5; done
exec launchctl bootstrap "gui/$(id -u)" "$plist"
