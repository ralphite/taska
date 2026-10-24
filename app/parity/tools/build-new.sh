#!/bin/zsh
# A build of the rewrite as committed: app/ of <commit> exported to /Users/yadong/taska-rewrite/parity/new-builds/<sha>
# and its page built there (npm ci, vite build), so a comparison names exactly what it compared. Prints the sha.
#   zsh tools/build-new.sh [commit]        (default: the last commit that touched app/ outside app/parity)
set -e
REPO=/Users/yadong/dev2/taska
C=${1:-$(git -C $REPO log -1 --format=%h -- app ':!app/parity')}
SHA=$(git -C $REPO rev-parse --short $C)
DIR=/Users/yadong/taska-rewrite/parity/new-builds/$SHA
if [[ ! -f $DIR/app/web/dist/index.html ]]; then
  rm -rf $DIR && mkdir -p $DIR
  git -C $REPO archive $SHA app ':!app/parity' | tar -x -C $DIR
  cd $DIR/app/web
  npm ci --no-audit --no-fund > $DIR/build.log 2>&1
  npx vite build >> $DIR/build.log 2>&1
fi
echo $SHA
