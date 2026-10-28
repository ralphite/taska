#!/bin/zsh
# PermissionRequest hook (T465): a session nobody is watching never waits on a permission prompt.
# For the session ids listed in ~/.claude/unattended-sessions.txt (the manager and its worker, one id per line),
# the prompt is answered "deny" at once with a note to take another route; every other session prompts as usual.
# Each answer is logged to ~/.claude/unattended-denials.log so the manager can see what was refused.
LIST=~/.claude/unattended-sessions.txt
input=$(cat)
sid=$(print -r -- "$input" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin).get("session_id",""))' 2>/dev/null)
[[ -n $sid && -f $LIST ]] && grep -qxF "$sid" $LIST || exit 0
print -r -- "$input" | /usr/bin/python3 -c '
import json, sys, time
d = json.load(sys.stdin)
what = json.dumps(d.get("tool_input", {}))[:300]
row = [time.strftime("%Y-%m-%d %H:%M:%S"), d.get("session_id", "")[:8], d.get("tool_name", ""), what]
with open(sys.argv[1], "a") as f:
    f.write(" ".join(row) + "\n")
print(json.dumps({"hookSpecificOutput": {"hookEventName": "PermissionRequest", "decision": {
    "behavior": "deny",
    "message": "Denied automatically: this session runs unattended (T465) and must never wait on a permission prompt. "
               "Do not retry the same command; take another route (a narrower command, files you created yourself, "
               "a fresh folder), or post a block on the Taska item saying what you need, and move on."}}}))
' ~/.claude/unattended-denials.log
