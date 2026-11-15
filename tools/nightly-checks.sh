#!/bin/zsh
# Check the committed source and a consistent copy of the current data. No models or live-data writes; Taska hears
# what to fix through its agent interface.
#   zsh tools/nightly-checks.sh [data root, default ~/.taska]
# The LaunchAgent runs this at 03:30. Failures are grouped into one Taska item until they change; the UI audit files
# each new display problem as its own bug.
set -u
ROOT=${0:A:h:h}
DATA=${1:-$HOME/.taska}
URL=${TASKA_URL:-http://127.0.0.1:7340}
LOGS=${TASKA_NIGHTLY_LOGS:-$ROOT/.logs}
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
unset GEMINI_API_KEY GOOGLE_API_KEY GOOGLE_GENERATIVE_AI_API_KEY GOOGLE_APPLICATION_CREDENTIALS
[[ -d "$DATA" ]] || { echo "no data in $DATA"; exit 2; }
[[ -d "$ROOT/web/node_modules" ]] || { echo "run npm ci in web/ first"; exit 2; }
mkdir -p "$LOGS"
LOG=$LOGS/nightly-checks.log
LAST=$LOGS/nightly-checks.last
WORK=$(mktemp -d -t taska-checks)
trap 'rm -rf "$WORK"' EXIT
mkdir "$WORK/source"
# An archive is isolated from builds and uncommitted work in the checkout.
git -C "$ROOT" archive HEAD | tar -x -C "$WORK/source" || exit 1
ln -s "$ROOT/web/node_modules" "$WORK/source/web/node_modules"
check() { NO_COLOR=1 FORCE_COLOR=0 npm --prefix "$WORK/source/web" run check; }
# what a failed step says, readable on a phone: no colour codes, the lines that name the errors (else its last lines)
plain() { sed -E $'s/\x1b\\[[0-9;]*[A-Za-z]//g' "$1"; }
data_check() {
  python3 "$WORK/source/tools/copy_data.py" "$DATA" "$WORK/data" &&
    python3 "$WORK/source/tests/check_data.py" "$WORK/data"
}
# the UI audit (T113): every Storybook story measured in a headless browser; each new display problem becomes an open
# bug in Taska, filed once (what was filed is kept in $LOGS/ui-audit). Its own rules are tested first.
ui_audit() {
  node --test "$WORK/source/tools/ui_audit.test.mjs" &&
    node "$WORK/source/tools/ui_audit.mjs" --build --file "$URL" --state "$LOGS/ui-audit" --out "$WORK/ui-audit"
}
step() {
  local name=$1; shift
  if "$@" > "$WORK/step.out" 2>&1; then
    echo "passed: $name: $(tail -1 "$WORK/step.out")"
  else
    echo "FAILED: $name"
    plain "$WORK/step.out" > "$WORK/step.txt"
    { grep -E 'error TS|[0-9]+:[0-9]+ +error|FAIL |Error:|Unhandled|AssertionError|Errors +[0-9]+ error|Test Files .*failed|Tests .*failed|break\(s\)|^ERROR' "$WORK/step.txt" || tail -6 "$WORK/step.txt"; } | sed 's/^ *//' | awk '!seen[$0]++' | head -8 | cut -c1-160 | sed 's/^/    /'
  fi
}
{
  echo "nightly checks $(date '+%Y-%m-%d %H:%M') at $(git -C "$ROOT" rev-parse --short HEAD)"
  step "code checks (types, lint, architecture rules, unit tests)" check
  step "current data loads and replays consistently" data_check
  step "daily copy of the data (last 14 kept)" python3 "$WORK/source/tools/backup_data.py" "$DATA"
  step "UI display check (every story; new problems filed as bugs)" ui_audit
} > "$LOG" 2>&1
if ! grep -q '^FAILED' "$LOG"; then
  rm -f "$LAST"
  echo "nightly checks: all passed"
  exit 0
fi
what=$(grep -E '^FAILED|^    ' "$LOG" | head -40)
sig=$(grep '^FAILED' "$LOG" | shasum | cut -c1-12)
post() { curl -s -m 10 -X POST "$URL/p/taska/do?by=nightly&session=checks" --data-binary @-; }
body=$(print -r -- "$what" | sed 's/^/  /')
if [[ -f "$LAST" && "$(cut -d' ' -f2 "$LAST")" == "$sig" ]]; then
  code=$(cut -d' ' -f1 "$LAST")
  printf '%s say Failed again tonight (%s), the same way.\n' "$code" "$(date '+%m-%d')" | post
else
  out=$(printf 'new bug P1 now The nightly checks failed (%s)\n  Every night at 03:30: the code checks (types, lint, architecture rules, unit tests) on the committed code, loading a copy of the data, the daily backup and the UI display check. What failed, and the lines that say why:\n%s\n' "$(date '+%m-%d')" "$body" | post)
  code=$(print -r -- "$out" | sed -n 's/^ok \([A-Z][0-9]*\) new.*/\1/p' | head -1)
  [[ -n "$code" ]] && echo "$code $sig" > "$LAST"
fi
echo "nightly checks: failed, told Taska (${code:-not reached})"
exit 1
