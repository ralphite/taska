#!/bin/zsh
# Put new Taska code live without restarting it under Yadong's hands. Run it after committing:
#   zsh tools/ship.sh
# Every check runs first (npm run check in web: types, lint, the architecture check, the page's and
# the server's tests), then the page is built and copied to web/live, which the service serves (a build made to
# test something never goes live by itself). None of these opens a browser; a check added later that does waits for
# the machine's page budget first (~/.local/bin/machine-guard wait). If nobody used Taska in the last minute, it
# restarts now. Otherwise the open pages offer "Taska has an update · Restart", and this waits: it restarts by itself
# once Taska has been left alone for a minute (or Yadong clicked Restart).
cd "$(dirname "$0")/.." || exit 1
URL=${TASKA_URL:-http://127.0.0.1:7340}
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
npm --prefix web run check >/tmp/taska-ship-check.log 2>&1 || { echo "ship: a check failed (see /tmp/taska-ship-check.log)"; exit 1; }
npm --prefix web run build >/tmp/taska-ship-build.log 2>&1 || { echo "ship: the page did not build (see /tmp/taska-ship-build.log)"; exit 1; }
rsync -a --delete --delete-excluded --exclude /storybook/ web/dist/ web/live/  # Storybook is its own server
idle() { curl -s -m 3 "$URL/api/idle" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)["idle"])' 2>/dev/null || echo 9999; }
# which run of Taska answers: the process listening on its port (a restart, by this or from the page, is another)
serving() { lsof -tiTCP:${URL##*:} -sTCP:LISTEN 2>/dev/null | head -n 1; }
restart() {
  launchctl kickstart -k gui/$(id -u)/com.taska.app
  for i in {1..60}; do sleep 1; curl -s -m 2 -o /dev/null "$URL/health" && { echo "ship: Taska restarted"; return 0; }; done
  echo "ship: Taska did not come back in a minute: look at its log"; return 1
}
was=$(serving)
if (( $(idle) >= 60 )); then restart; exit $?; fi
touch ~/.taska/.update-ready
echo "ship: Yadong used Taska in the last minute: the page offers Restart; restarting once Taska is left alone for a minute"
while true; do
  sleep 15
  now=$(serving)
  [[ -n "$now" && "$now" != "$was" ]] && { echo "ship: restarted from the page"; exit 0; }
  (( $(idle) >= 60 )) && { restart; exit $?; }
done
