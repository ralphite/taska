#!/bin/zsh
# Storybook for the rewrite's page (app/web): a server of its own on http://localhost:6351, run from the source, so a
# change in the code shows at once. The sidebar's Storybook link points here (decided 10-23, #7195). For development on
# this computer only; Taska itself does not carry it. Meant for a LaunchAgent of its own (KeepAlive, ProcessType
# Interactive, like com.taska.storybook); the old version's Storybook (6007, v2/tools/storybook-service.sh) is apart.
cd "$(dirname "$0")/../web" || exit 1
export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH" # the same node as the shell builds the page with
exec ./node_modules/.bin/storybook dev -p 6351 --exact-port --host 127.0.0.1 --no-open --ci # always 6351: the link points there
