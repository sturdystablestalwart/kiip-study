#!/usr/bin/env bash
# KIIP Study — MongoDB backup script
# Usage: ./scripts/backup.sh [--docker|--local]
# Requires: mongodump (local) or docker (docker mode)

set -euo pipefail

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="${BACKUP_DIR}/kiip_backup_${TIMESTAMP}"
DB_NAME="${MONGO_DB:-kiip_test_app}"
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/${DB_NAME}}"
MODE="${1:---local}"

mkdir -p "${BACKUP_DIR}"

if [ "${MODE}" = "--docker" ]; then
  CONTAINER="${MONGO_CONTAINER:-kiip-mongo}"
  echo "[backup] Running mongodump inside container: ${CONTAINER}"
  docker exec "${CONTAINER}" mongodump \
    --db "${DB_NAME}" \
    --out "/tmp/kiip_backup_${TIMESTAMP}"
  docker cp "${CONTAINER}:/tmp/kiip_backup_${TIMESTAMP}" "${BACKUP_PATH}"
  docker exec "${CONTAINER}" rm -rf "/tmp/kiip_backup_${TIMESTAMP}"
else
  echo "[backup] Running mongodump locally"
  mongodump --uri="${MONGO_URI}" --out="${BACKUP_PATH}"
fi

# Compress
tar -czf "${BACKUP_PATH}.tar.gz" -C "${BACKUP_DIR}" "kiip_backup_${TIMESTAMP}"
rm -rf "${BACKUP_PATH}"

echo "[backup] Saved to: ${BACKUP_PATH}.tar.gz"

# Keep only the last 7 backups
find "${BACKUP_DIR}" -name "kiip_backup_*.tar.gz" -mtime +7 -delete 2>/dev/null || true
echo "[backup] Done."
