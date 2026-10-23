#!/bin/zsh
# B517: the one way to restart Storybook (LaunchAgent com.taska.storybook, http://localhost:6007). Every restart is
# written to .logs/storybook-restarts.log with the time, who asked and why.
#   zsh v2/tools/storybook-restart.sh <who> <why>
# Agents do not restart Storybook (rule R489): the watchdog (storybook-watchdog.py) restarts it when its page has not
# answered for minutes. A restart cuts every open Storybook page for a while.
who=$1
shift
why="$*"
if [[ -z $who || -z $why ]]; then
  echo "usage: storybook-restart.sh <who> <why>" >&2
  exit 2
fi
log="$(cd "$(dirname "$0")/../.." && pwd)/.logs/storybook-restarts.log"
mkdir -p "$(dirname "$log")"
print -r -- "$(date '+%Y-%m-%d %H:%M:%S') $who: $why" >>"$log"
exec launchctl kickstart -k "gui/$(id -u)/com.taska.storybook"
