#!/bin/zsh
# Put new Taska code live without restarting it under Yadong's hands. Run it after committing:
#   zsh tools/ship.sh
# Every check runs first (npm run check in web: types, lint, the architecture check, the page's and
# the server's tests), then the page is built, then the browser checks guarding what changed since the last ship run on
# Taskas of their own (tools/e2e.py --gate: headless, on empty data, never the live Taska; a known issue of
# docs/known-issues.md failing does not stop it). The page is copied to web/live, which the service serves, as Taska
# restarts (a build made to test something never goes live by itself). If nobody used Taska in the last minute, it
# restarts now. Otherwise this waits and restarts it by itself once Taska has been left alone for a minute; the open
# pages then reload by themselves at a good moment (B654).
cd "$(dirname "$0")/.." || exit 1
URL=${TASKA_URL:-http://127.0.0.1:7340}
export PATH="$PATH:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin"
# A fresh zsh can reset PATH after the caller selected Node. Honor the repo
# version in this shell as well, before running any build or test command.
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  source "$HOME/.nvm/nvm.sh"
  nvm use --silent || exit 1
fi
[[ "$(node -p 'process.versions.node.split(".")[0]')" == "$(cat .nvmrc)" ]] || {
  echo "ship: select the Node version in .nvmrc first"; exit 1
}
npm --prefix web run check >/tmp/taska-ship-check.log 2>&1 || { echo "ship: a check failed (see /tmp/taska-ship-check.log)"; exit 1; }
npm --prefix web run build >/tmp/taska-ship-build.log 2>&1 || { echo "ship: the page did not build (see /tmp/taska-ship-build.log)"; exit 1; }
python3 tools/e2e.py --gate >/tmp/taska-ship-e2e.log 2>&1 || { echo "ship: a browser check failed (see /tmp/taska-ship-e2e.log)"; exit 1; }
idle() { curl -s -m 3 "$URL/api/idle" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)["idle"])' 2>/dev/null || echo 9999; }
# which run of Taska answers: the process listening on its port (a restart, by this or from the page, is another)
serving() { lsof -tiTCP:${URL##*:} -sTCP:LISTEN 2>/dev/null | head -n 1; }
# the page goes live with the server that answers it: a new page talking to the old server for the minute this may wait
# breaks on what changed between them (r1125)
# the page's built files of earlier versions stay two weeks: a page still open (or kept by the phone app) loads parts
# of itself later (a diagram's drawing code); gone, that part fails to load (B714 r1179)
golive() {
  rsync -a --delete --exclude /storybook/ --exclude /assets/ web/dist/ web/live/  # Storybook is its own server
  rsync -a web/dist/assets/ web/live/assets/
  find web/live/assets -type f -mtime +14 -delete
  python3 tools/e2e.py --shipped  # the next ship runs the browser checks guarding what changed since this one
}
restart() {
  golive
  launchctl kickstart -k gui/$(id -u)/com.taska.app
  for i in {1..60}; do sleep 1; curl -s -m 2 -o /dev/null "$URL/health" && { echo "ship: Taska restarted"; return 0; }; done
  echo "ship: Taska did not come back in a minute: look at its log"; return 1
}
was=$(serving)
if (( $(idle) >= 60 )); then restart; exit $?; fi
touch ~/.taska/.update-ready
echo "ship: Yadong used Taska in the last minute: restarting once Taska is left alone for a minute"
while true; do
  sleep 15
  now=$(serving)
  [[ -n "$now" && "$now" != "$was" ]] && { golive; echo "ship: restarted from the page"; exit 0; }
  (( $(idle) >= 60 )) && { restart; exit $?; }
done
