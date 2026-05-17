#!/usr/bin/env sh
# KIIP Study — in-container scheduled MongoDB backup (issue #16).
#
# WHO runs this: the `backup` service in docker-compose.yaml, which
#                mounts this file at /usr/local/bin/backup.sh:ro and
#                invokes it daily (every 86400s).
# WHEN: production cron only — NOT for developer workstations.
# OUTPUT: /backups/mongo-<UTC-ISO>.tar.gz inside the container, mapped
#         to ./backups/ on the host via the `backup` service volumes.
# ROTATION: keeps the last 14 daily archives.
#
# For the local-dev one-shot helper, see scripts/backup.sh.
set -e
TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT=/backups/mongo-$TS
mkdir -p "$OUT"
mongodump --uri="$MONGO_URI" --out="$OUT"
tar czf "/backups/mongo-$TS.tar.gz" -C "$OUT" .
rm -rf "$OUT"

# Rotate: keep last 14 daily backups
ls -t /backups/mongo-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "Backup complete: /backups/mongo-$TS.tar.gz"
