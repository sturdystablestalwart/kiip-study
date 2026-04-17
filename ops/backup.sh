#!/usr/bin/env sh
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
