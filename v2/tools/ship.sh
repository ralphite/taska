#!/bin/zsh
# Put new Taska code live without restarting it under Yadong's hands (R328). Run it after committing a change:
#   zsh v2/tools/ship.sh            (rebuilds the page first when v2/web changed: pass --build)
# The browser checks guarding what changed run first (v2/tests/ship_checks.py): a failing one stops the ship.
# If nobody used Taska in the last minute, it restarts now. Otherwise the open pages offer "Taska has an update ·
# Restart", and this waits: it restarts by itself once Taska has been left alone for a minute (or Yadong clicked).
cd "$(dirname "$0")/../.." || exit 1
URL=${TASKA_URL:-http://127.0.0.1:7340}
# The service serves v2/web/live, which only this fills, from the build it has just made: a build made to test
# something never goes live by itself (F449: a page left alone reloads into whatever Taska serves)
[[ "$1" == "--build" ]] && { npm --prefix v2/web run build >/dev/null || { echo "ship: the page did not build"; exit 1; }; }
# T475 (D45): the browser checks guarding what changed since the last ship run first, on the build; one that fails
# stops the ship before anything goes live, and says which of Yadong's requirements the change breaks, in his words
/usr/bin/python3 v2/tests/ship_checks.py || exit 1
[[ "$1" == "--build" ]] && rsync -a --delete --delete-excluded --exclude /storybook/ v2/web/dist/ v2/web/live/  # Storybook is its own server (T456)
/usr/bin/python3 v2/tests/ship_checks.py --shipped  # what the next ship's checks are measured from
idle() { curl -s -m 3 "$URL/api/idle" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)["idle"])' 2>/dev/null || echo 9999; }
boot() { curl -s -m 3 "$URL/p/taska/api/poll?rev=0&wait=0" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)["boot"])' 2>/dev/null; }
restart() {
  launchctl kickstart -k gui/$(id -u)/com.taska.app
  for i in {1..60}; do sleep 1; curl -s -m 2 -o /dev/null "$URL/health" && { echo "ship: Taska restarted"; return 0; }; done
  echo "ship: Taska did not come back in a minute: look at .logs/taska-error.log"; return 1
}
was=$(boot)
if (( $(idle) >= 60 )); then restart; exit $?; fi
touch ~/.taska/.update-ready
echo "ship: Yadong used Taska in the last minute: the page offers Restart; restarting once Taska is left alone for a minute"
while true; do
  sleep 15
  now=$(boot)
  [[ -n "$now" && "$now" != "$was" ]] && { echo "ship: restarted from the page"; exit 0; }
  (( $(idle) >= 60 )) && { restart; exit $?; }
done
