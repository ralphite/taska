#!/bin/zsh
# A stream of what needs the agent, for Claude Code's Monitor (T213): one line each time a new input arrives, the user
# replies on an item, or a new item appears, in the projects given. It never exits by itself, so one event never ends
# the watch; Monitor's own time limit does, and says so (arm it again then).
#   Monitor: zsh scripts/watch_taska.sh <agent-name> <state-dir> <project> [<project>...]
# Inputs and replies are told once per new text, new items once per code (kept in <state-dir>). Messages for an item a
# subagent works on reach it through the main agent: subagents never call Taska themselves.
WHO=$1 DIR=$2; shift 2
TOLD=$DIR/told.txt
mkdir -p $DIR; touch $TOLD
H=${TASKA_URL:-http://127.0.0.1:7340}
while true; do
  for p in "$@"; do
    B=$H/p/$p SEEN=$DIR/seen-$p.txt
    touch $SEEN
    o=$(curl -s --max-time 20 "$B/next?by=$WHO" || true)
    last=$(echo "$o" | grep -oE '^#[0-9]+ [0-9-]+ [0-9:]+ you' | tail -1)  # a later reply on the same item is new again
    for line in ${(f)"$(echo "$o" | grep -E '^r[0-9]+ |^resume [A-Z][0-9]+: the user replied')"}; do
      h="$p $(echo "$line $last" | cut -c1-160 | md5 -q)"
      grep -qxF "$h" $TOLD || { echo "$h" >> $TOLD; echo "[$p] $line" | cut -c1-200; }
    done
    items=$(curl -s --max-time 20 "$B/items" || true)
    for c in ${(f)"$(echo "$items" | awk 'NR>1{print $1}' | sort -u | grep -vxFf $SEEN | grep .)"}; do
      echo $c >> $SEEN
      [ -s $DIR/.started-$p ] && echo "[$p] NEW ITEM $(echo "$items" | grep -w "^$c" | cut -c1-160)"
    done
    echo 1 > $DIR/.started-$p  # the first pass only learns what is there
  done
  sleep 20
done
