#!/bin/zsh
# Stop hook (B811): an agent session that works through Taska never ends a turn without listening for new work.
# At the end of each turn Claude Code runs this with the hook's JSON on stdin. It asks the local Taska whether this
# session gave Taska its id and whether a background wait for work (/next?wait) is open for it now, or ended a minute
# ago or less. If the session is known and not listening, the stop is blocked with a reason that tells it to start
# the background wait first. Every other session ends as usual. It never blocks twice in a row (stop_hook_active),
# and when Taska cannot be reached it lets the turn end. Files and a local request only: no model, no tokens.
input=$(cat)
read -r sid again <<<"$(print -r -- "$input" | /usr/bin/python3 -c '
import json, sys
d = json.load(sys.stdin)
print(d.get("session_id", "") or "-", "1" if d.get("stop_hook_active") else "0")' 2>/dev/null)"
[[ -n $sid && $sid != "-" && $again != 1 ]] || exit 0
answer=$(/usr/bin/curl -s -m 3 "${TASKA_URL:-http://127.0.0.1:7340}/api/listening?sid=$sid") || exit 0
print -r -- "$answer" | /usr/bin/python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except ValueError:
    sys.exit(0)
if d.get("known") and not d.get("listening"):
    print(json.dumps({"decision": "block", "reason":
        "Taska: this session is not listening for new work, so work that comes in would wait with nobody taking it "
        "(B811). Before ending the turn, start the background wait from Taska'"'"'s /agent guide with Bash "
        "run_in_background (it costs no tokens), then end the turn."}))
' 2>/dev/null
exit 0
