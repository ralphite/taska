#!/bin/zsh
# F581: put v2 back as the live Taska on 7340 (the backup of the rewrite), same data (~/.taska), key and tunnel.
#   zsh v2/tools/switch-back.sh
# Uses the LaunchAgent v2 ran under, kept in v2/tools/launchd/com.taska.app.v2.plist by app/tools/swap-in.sh.
REPO=/Users/yadong/dev2/taska
PLIST=~/Library/LaunchAgents/com.taska.app.plist
launchctl bootout gui/$(id -u)/com.taska.app 2>/dev/null
for i in {1..20}; do lsof -nP -iTCP:7340 -sTCP:LISTEN > /dev/null || break; sleep 0.5; done
cp $REPO/v2/tools/launchd/com.taska.app.v2.plist $PLIST
launchctl bootstrap gui/$(id -u) $PLIST
for i in {1..60}; do [[ $(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:7340/health) == 200 ]] && break; sleep 1; done
echo "switch-back: v2 answers on 7340: $(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:7340/health)"
