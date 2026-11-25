#!/usr/bin/env sh
# Switch between the local backend (.env.local) and the remote one (.env).
#   pnpm env:local     use .env.local (the backend on this laptop, over USB)
#   pnpm env:remote    use .env (Railway)
#   pnpm env:status    say which one is in use
# Expo reads .env.local over .env whenever it exists; "remote" parks it as
# .env.local.off. Restart with `pnpm start -c` (or `pnpm lh`) after switching,
# because the address is built into the bundle.
set -eu
cd "$(dirname "$0")/.."

case "${1:-status}" in
  local)
    if [ -f .env.local.off ] && [ ! -f .env.local ]; then mv .env.local.off .env.local; fi
    [ -f .env.local ] || { echo "No .env.local or .env.local.off here." >&2; exit 1; }
    ;;
  remote)
    if [ -f .env.local ]; then mv .env.local .env.local.off; fi
    ;;
  status) ;;
  *) echo "Usage: scripts/env.sh [local|remote]" >&2; exit 2 ;;
esac

if [ -f .env.local ]; then echo "mise-fe: LOCAL (.env.local)"; else echo "mise-fe: REMOTE (.env)"; fi
