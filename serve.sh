#!/usr/bin/env bash
# Serve Driftfield locally. ES modules require http(s), not file://.
cd "$(dirname "$0")" || exit 1
PORT="${1:-8080}"
echo "Driftfield -> http://localhost:${PORT}"
exec python3 -m http.server "${PORT}"
