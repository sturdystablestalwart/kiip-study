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

# Issue #89 — verify the dump is readable before we tar it up.  Without
# this a corrupted dump (truncated write, disk-full, bad permissions on
# a single collection file) is only discovered during recovery — i.e.
# during an incident, when it's too late.
#
# We use `bsondump` (ships with mongodb-tools) to parse every .bson
# file the dump produced and discard the JSON to /dev/null.  bsondump
# exits non-zero on any read or BSON-parse error, so this acts as an
# end-to-end "the bytes on disk actually round-trip" check without
# needing a scratch mongo instance for `mongorestore --dryRun`.
echo "Verifying dump integrity for $OUT"
VERIFIED=0
for bson in $(find "$OUT" -name '*.bson' 2>/dev/null); do
    if ! bsondump --quiet "$bson" >/dev/null 2>&1; then
        echo "ERROR: corrupted dump file: $bson" >&2
        rm -rf "$OUT"
        exit 1
    fi
    VERIFIED=$((VERIFIED + 1))
done
if [ "$VERIFIED" -eq 0 ]; then
    echo "ERROR: dump produced no .bson files — was the database empty or unreachable?" >&2
    rm -rf "$OUT"
    exit 1
fi
echo "Verified $VERIFIED bson file(s) parse cleanly"

tar czf "/backups/mongo-$TS.tar.gz" -C "$OUT" .
rm -rf "$OUT"

# Rotate: keep last 14 daily backups
ls -t /backups/mongo-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "Backup complete: /backups/mongo-$TS.tar.gz"
