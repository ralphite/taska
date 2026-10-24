#!/bin/zsh
# Every night: every check of the rewrite, then its agent interface compared word for word with the old version's,
# both on fresh copies of the same data (the reads, then every kind of write). It never touches the live Taska: the
# data is only read, through SQLite's backup (app/tools/copy_data.py); the two run on ports 7356 (rewrite) and 7357
# (old), with no Gemini key and no organizer; the copies are removed at the end. No browser.
#   zsh app/tools/nightly-checks.sh <the old version's server folder> [<the data to copy>]
# The old version's page build is the web/dist next to its server folder. Exit 0: every check green, all the same.
set -u
APP=${0:A:h:h}
OLD=${1:?usage: nightly-checks.sh <the old version server folder> [<data to copy>]}
DATA=${2:-/Users/yadong/taska-rewrite/snapshot}
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
unset GEMINI_API_KEY GOOGLE_API_KEY GOOGLE_GENERATIVE_AI_API_KEY GOOGLE_APPLICATION_CREDENTIALS
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
pair() { # <name>: both on fresh copies, then the comparison given after the name
  local name=$1; shift
  ports
  rm -rf $W/new $W/old
  python3 $APP/tools/copy_data.py $DATA $W/new >/dev/null && python3 $APP/tools/copy_data.py $DATA $W/old >/dev/null \
    || { echo "$name: the data could not be copied"; return 1; }
  serve $APP/server 7356 $W/new $W/new.log && serve $OLD 7357 $W/old $W/old.log $OLD/../web/dist \
    || { echo "$name: a Taska did not start"; tail -5 $W/new.log $W/old.log; return 1; }
  python3 $APP/tests/differential/$1 http://127.0.0.1:7357 $W/old http://127.0.0.1:7356 $W/new > $W/$name.out 2>&1
  local r=$?
  tail -4 $W/$name.out
  return $r
}

[[ -d $OLD/taska ]] || { echo "no old version in $OLD"; exit 2; }
[[ -d $DATA ]] || { echo "no data in $DATA"; exit 2; }
echo "nightly checks $(date '+%F %T'), rewrite $(git -C $APP log -1 --format=%h), data $DATA"
bad=()
echo "== every check (npm run check)"
(cd $APP/web && npm run check > $W/check.out 2>&1) && echo "green" || { bad+=(check); tail -20 $W/check.out; }
echo "== the agent interface's reads"
pair reads compare_reads.py || bad+=(reads)
echo "== the agent interface's writes"
pair writes compare_writes.py || bad+=(writes)
if (( ${#bad} )); then echo "NOT GREEN: ${bad[*]}"; exit 1; fi
echo "all green"
