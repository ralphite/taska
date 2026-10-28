#!/bin/zsh
# The one way to restart Storybook (LaunchAgent com.taska.storybook-app, http://localhost:6007): its watchdog when it
# is stuck (B517), or an agent once after changing its configuration (R489). Every restart is written to
# .logs/storybook-restarts.log with the time, who asked and why.
#   zsh tools/storybook-restart.sh <who> <why>
who=$1
shift
why="$*"
if [[ -z $who || -z $why ]]; then
  echo "usage: storybook-restart.sh <who> <why>" >&2
  exit 2
fi
log="$(cd "$(dirname "$0")/.." && pwd)/.logs/storybook-restarts.log"
mkdir -p "$(dirname "$log")"
print -r -- "$(date '+%Y-%m-%d %H:%M:%S') $who: $why" >>"$log"
launchctl kickstart -k "gui/$(id -u)/com.taska.storybook-app"
