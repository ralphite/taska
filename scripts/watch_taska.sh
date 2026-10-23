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
NAMED=()  # F411: TASKA_SESSION (your session's name, machine, folder) shows on the agent pill in Taska
[[ -n $TASKA_SESSION ]] && NAMED=(--data-urlencode "session=$TASKA_SESSION")
while true; do
  for p in "$@"; do
    B=$H/p/$p SEEN=$DIR/seen-$p.txt
    touch $SEEN
    o=$(curl -s --max-time 20 -G "$B/next" --data-urlencode "by=$WHO" $NAMED || true)
    last=$(echo "$o" | grep -oE '^#[0-9]+ [0-9-]+ [0-9:]+ you' | tail -1)  # a later reply on the same item is new again
    for line in ${(f)"$(echo "$o" | grep -E '^r[0-9]+ [0-9-]+ [0-9:]+ you|^resume [A-Z][0-9]+: the user replied')"}; do
      h="$p $(echo "$line $last" | cut -c1-160 | md5 -q)"
      # a reply is told once, whether /next names it ("resume X") or the list marks it (REPLIED X): same key
      [[ $line == resume* ]] && h="$p REPLIED ${${line#resume }%%:*} ${last%% *}"
      grep -qxF "$h" $TOLD || { echo "$h" >> $TOLD; echo "[$p] $line" | cut -c1-200; }
    done
    items=$(curl -s --max-time 20 "$B/items" || true)
    for c in ${(f)"$(echo "$items" | awk 'NR>1{print $1}' | sort -u | grep -vxFf $SEEN | grep .)"}; do
      echo $c >> $SEEN
      [ -s $DIR/.started-$p ] && echo "[$p] NEW ITEM $(echo "$items" | grep -w "^$c" | cut -c1-160)"
    done
    # /next names only the item it puts first: a reply on another item, or an item the user approved, is seen in
    # the list itself ("<" ends a line the user replied on; a status leaves "proposed" when they approve it)
    STATE=$DIR/state-$p.txt; touch $STATE
    now=$(echo "$items" | awk 'NR>1{print $1, $4, ($NF == "<" ? "<" : "-")}' | sort)
    if [ -s $DIR/.started-$p ]; then
      for row in ${(f)now}; do
        c=${row%% *} was=$(grep "^$c " $STATE)
        if [ "${row##* }" = "<" ] && [ "${was##* }" != "<" ]; then  # told once per reply: a row that leaves and comes back is not news
          h="$p REPLIED $c $(curl -s --max-time 20 "$B/$c" | grep -oE '^#[0-9]+ [0-9-]+ [0-9:]+ you' | tail -1 | cut -d' ' -f1)"
          grep -qxF "$h" $TOLD || { echo "$h" >> $TOLD; echo "[$p] REPLIED $c: $(echo "$items" | grep -w "^$c" | cut -c1-140)"; }
        fi
        echo "$was" | grep -q " proposed " && ! echo "$row" | grep -q " proposed " && echo "[$p] APPROVED $c: $(echo "$items" | grep -w "^$c" | cut -c1-140)"
      done
    fi
    echo "$now" > $STATE
    # every input the user sends, once, even one the organizer already filed into an item and marked handled
    # (those never show in /next, and a ticked form does not always mark its row as replied)
    DB=${TASKA_DATA:-$HOME/.taska}/$p/taska.db LASTIN=$DIR/lastin-$p
    if [ -f $DB ]; then
      seq=$(cat $LASTIN 2>/dev/null || sqlite3 $DB "select max(seq) from events")
      # a voice note is told once its words are in (the inputs table), or after 3 minutes without them
      /usr/bin/python3 - $DB ${seq:-0} $LASTIN $p $([ -s $DIR/.started-$p ] && echo tell) <<'PY'
import json, sqlite3, sys, time
from datetime import datetime
db, seq, last, p = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
tell = len(sys.argv) > 5
try:  # while Taska restarts the database may not open read-only: try again next round, quietly
    c = sqlite3.connect("file:%s?mode=ro" % db, uri=True)
    said = {}
    for (d,) in c.execute("select data from inputs"):
        d = json.loads(d)
        said[d.get("id")] = d.get("text") or ""
    rows = c.execute("select seq, data from events where k='in' and seq>? order by seq", (seq,)).fetchall()
except sqlite3.Error:
    sys.exit(0)
for s, d in rows:
    d = json.loads(d)
    text = said.get(d.get("id")) or d.get("text") or ""
    age = time.time() - datetime.fromisoformat(d["t"]).timestamp()
    if not text and d.get("files") and age < 180:
        break  # its words are still coming: tell it next round
    open(last, "w").write(str(s))
    if tell:
        print("[%s] INPUT %s scope %s %s" % (p, d.get("id"), d.get("scope"), (text or "(no words)")[:120].replace("\n", " ")), flush=True)
PY
      [ -s $LASTIN ] || sqlite3 $DB "select max(seq) from events" > $LASTIN
    fi
    echo 1 > $DIR/.started-$p  # the first pass only learns what is there
  done
  sleep 20
done
