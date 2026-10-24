#!/bin/zsh
# F581: make the rewrite (app/) the live Taska on 7340, in place of v2, with the same data (~/.taska), key and tunnel.
#   zsh app/tools/swap-in.sh
# Waits until Taska has been left alone for a minute (open pages offer Restart meanwhile), keeps a consistent copy of
# ~/.taska in ~/taska-backup (links inside it are left out), then points the LaunchAgent com.taska.app at app/tools/taska-service.sh. If the new
# service does not answer within 60 s it puts v2 back by itself. v2/tools/switch-back.sh goes back to v2 by hand.
set -u
REPO=/Users/yadong/dev2/taska
PLIST=~/Library/LaunchAgents/com.taska.app.plist
URL=http://127.0.0.1:7340
idle() { curl -s -m 3 "$URL/api/idle" | /usr/bin/python3 -c 'import json,sys; print(int(json.load(sys.stdin)["idle"]))' 2>/dev/null || echo 9999; }
up() { [[ $(curl -s -m 3 -o /dev/null -w '%{http_code}' "$URL/health") == 200 ]]; }

[[ -f $REPO/app/web/live/index.html ]] || { echo "swap: app/web/live is empty: build and copy the page first"; exit 1; }
touch ~/.taska/.update-ready
for i in {1..180}; do (( $(idle) >= 60 )) && break; (( i == 1 )) && echo "swap: Taska is in use: waiting until it is left alone for a minute"; sleep 5; done
(( $(idle) >= 60 )) || { echo "swap: Taska was not left alone for 15 minutes: nothing changed"; exit 1; }

STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p ~/taska-backup
/usr/bin/python3 - ~/.taska ~/taska-backup/data-before-swap-$STAMP <<'EOF' || { echo "swap: the data copy failed: nothing changed"; exit 1; }
import os, shutil, sqlite3, sys
src, dst = sys.argv[1:]
def copy(a, b):
    os.makedirs(b)
    for n in os.listdir(a):
        x, y = os.path.join(a, n), os.path.join(b, n)
        if os.path.islink(x): continue
        if os.path.isdir(x): copy(x, y)
        elif n.endswith('.db'):
            s = sqlite3.connect('file:%s?mode=ro' % x, uri=True); t = sqlite3.connect(y); s.backup(t); t.close(); s.close()
        elif not n.endswith(('.db-wal', '.db-shm')): shutil.copy2(x, y)
copy(src, dst)
EOF
echo "swap: data kept in ~/taska-backup/data-before-swap-$STAMP"

cp $PLIST $REPO/v2/tools/launchd/com.taska.app.v2.plist
launchctl bootout gui/$(id -u)/com.taska.app 2>/dev/null
for i in {1..20}; do lsof -nP -iTCP:7340 -sTCP:LISTEN > /dev/null || break; sleep 0.5; done
cp $REPO/app/tools/com.taska.app.plist $PLIST
launchctl bootstrap gui/$(id -u) $PLIST
for i in {1..60}; do up && break; sleep 1; done
if ! up; then
  echo "swap: the new Taska did not answer in 60 s: putting v2 back"
  zsh $REPO/v2/tools/switch-back.sh
  exit 1
fi
rm -f ~/.taska/.update-ready
echo "swap: the rewrite is live on 7340 (pid $(lsof -nP -t -iTCP:7340 -sTCP:LISTEN))"
