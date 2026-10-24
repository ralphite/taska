#!/bin/zsh
# Every night: every check of the rewrite, then its agent interface compared word for word with the old version's,
# both on fresh copies of the same data (the reads, then every kind of write). It never touches the live Taska's data:
# the data is only read, through SQLite's backup (app/tools/copy_data.py); the two run on ports 7356 (rewrite) and
# 7357 (old), with no Gemini key and no organizer; the copies are removed at the end. No browser. A failure becomes a
# bug in Taska with what failed; the same failure the next night is added to that bug, not made again. Run by the
# LaunchAgent com.taska.nightly-checks at 3:30; by hand:
#   zsh app/tools/nightly-checks.sh <the old version's server folder> [<the data to copy>]
# The old version's page build is the web/dist next to its server folder. Exit 0: every check green, all the same.
set -u
R=${0:A:h:h:h}
OLD=${1:?usage: nightly-checks.sh <the old version server folder> [<data to copy>]}
DATA=${2:-/Users/yadong/taska-rewrite/snapshot}
URL=${TASKA_URL:-http://127.0.0.1:7340}
LOGS=${TASKA_NIGHTLY_LOGS:-$R/.logs}
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
unset GEMINI_API_KEY GOOGLE_API_KEY GOOGLE_GENERATIVE_AI_API_KEY GOOGLE_APPLICATION_CREDENTIALS
mkdir -p $LOGS
LOG=$LOGS/nightly-checks.log
LAST=$LOGS/nightly-checks.last  # the last failure: its code in Taska and what failed
[[ -d $OLD/taska ]] || { echo "no old version in $OLD"; exit 2; }
[[ -d $DATA ]] || { echo "no data in $DATA"; exit 2; }
# The checks run in a worktree of their own at main's newest commit, never in the main checkout: a ship there runs its
# own checks and builds the page meanwhile, and the two must not mix
T=$R/.claude/worktrees/nightly-app
[[ -d $T/app ]] || git -C $R worktree add -qf --detach $T HEAD || exit 1
git -C $T checkout -fq --detach $(git -C $R rev-parse HEAD) && git -C $T clean -fdq -e node_modules || exit 1
ln -sfn $R/app/web/node_modules $T/app/web/node_modules
APP=$T/app
W=$(mktemp -d -t taska-nightly)
ports() { for port in 7356 7357; do pid=$(lsof -tiTCP:$port -sTCP:LISTEN 2>/dev/null); [[ -n "$pid" ]] && kill $pid; done; sleep 1; }
finish() { ports; rm -rf $W; }
trap finish EXIT
up() { for i in {1..150}; do curl -sf -m 2 http://127.0.0.1:$1/health >/dev/null && return 0; sleep 0.2; done; echo "port $1 did not come up"; return 1; }
serve() { # <folder> <port> <data> <log> [the old version's page build]
  (cd $1 && env TZ=America/Los_Angeles ${5:+TASKA_WEB_DIST=$5} nohup python3 -m taska serve --host 127.0.0.1 --port $2 --root $3 \
    --organizer off --log-db '' > $4 2>&1 &)
  up $2
}
pair() { # <comparison>: both on fresh copies, then it
  ports
  rm -rf $W/new $W/old
  python3 $APP/tools/copy_data.py $DATA $W/new >/dev/null && python3 $APP/tools/copy_data.py $DATA $W/old >/dev/null \
    || { echo "the data could not be copied"; return 1; }
  serve $APP/server 7356 $W/new $W/new.log || { echo "the rewrite did not start:"; tail -5 $W/new.log; return 1; }
  serve $OLD 7357 $W/old $W/old.log $OLD/../web/dist || { echo "the old version did not start:"; tail -5 $W/old.log; return 1; }
  python3 $APP/tests/differential/$1 http://127.0.0.1:7357 $W/old http://127.0.0.1:7356 $W/new
}
check() { (cd $APP/web && npm run check); }
step() { # <what it is> <command...>: its last line when it passes, its last lines under it when it fails
  local say=$1; shift
  "$@" > $W/step.out 2>&1 && { echo "passed: $say: $(tail -1 $W/step.out)"; return; }
  echo "FAILED: $say"
  tail -12 $W/step.out | sed 's/^/    /'
}
{
  echo "nightly checks $(date '+%Y-%m-%d %H:%M') at $(git -C $T rev-parse --short HEAD), data $DATA"
  step "every check (npm run check in app/web)" check
  step "the agent interface's reads, against the old version (compare_reads.py)" pair compare_reads.py
  step "the agent interface's writes, against the old version (compare_writes.py)" pair compare_writes.py
} > $LOG 2>&1
grep -q '^FAILED' $LOG || { rm -f $LAST; echo "nightly checks: all passed"; exit 0; }
# what failed, one line each, and how far it got
what=$(grep -E '^FAILED|^    ' $LOG | head -40)
sig=$(grep '^FAILED' $LOG | shasum | cut -c1-12)
post() { curl -s -m 10 -X POST "$URL/p/taska/do?by=claude-code&session=nightly" --data-binary @- ; }
body=$(print -r -- "$what" | sed 's/^/  /')
if [[ -f $LAST && "$(cut -d' ' -f2 $LAST)" == "$sig" ]]; then
  code=$(cut -d' ' -f1 $LAST)
  printf '%s say Failed again tonight (%s), the same as before; the whole log is .logs/nightly-checks.log\n' "$code" "$(date '+%m-%d')" | post
else
  out=$(printf 'new bug P1 now parent=T475 The nightly checks failed (%s)\n  What failed (the whole log is .logs/nightly-checks.log):\n%s\n' "$(date '+%m-%d')" "$body" | post)
  code=$(print -r -- "$out" | sed -n 's/^ok \([A-Z][0-9]*\) new.*/\1/p' | head -1)
  [[ -n "$code" ]] && echo "$code $sig" > $LAST
fi
echo "nightly checks: failed, told Taska (${code:-not reached})"
exit 1
