#!/usr/bin/env bash
# Manual rollback (issue #18).
#
# WHO runs this: an operator on the deploy host, after a deploy that
#                appears healthy at exit time but degrades shortly
#                after.  The deploy workflow does its own
#                rollback-on-failed-health automatically; this script
#                is for the post-deploy human-noticed case.
#
# Requires:    docker compose, deploy host shell, `kiip-server:rollback`
#              and `kiip-client:rollback` tags present (the deploy
#              workflow snapshots these on every deploy).
set -euo pipefail

cd "$(dirname "$0")/.."

for svc in kiip-server kiip-client; do
    if ! docker image inspect "${svc}:rollback" >/dev/null 2>&1; then
        echo "ERROR: ${svc}:rollback tag not found — no rollback image to restore." >&2
        echo "       Run from the deploy host after at least one workflow-driven deploy." >&2
        exit 1
    fi
    docker tag "${svc}:rollback" "${svc}:latest"
done

docker compose up -d

echo "Waiting up to 60s for /health..."
for i in $(seq 1 12); do
    if curl -sf http://localhost:80/health; then
        echo
        echo "Rollback complete and healthy."
        exit 0
    fi
    sleep 5
done

echo "Rollback did not produce a healthy /health response — manual intervention required." >&2
exit 2
