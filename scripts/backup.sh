#!/usr/bin/env bash
# KIIP Study — local-dev MongoDB backup helper (issue #16).
#
# WHO runs this: a developer at their workstation.
# WHEN: ad hoc, before a risky migration or before tearing down a local
#       compose stack.
# OUTPUT: ./backups/kiip_backup_<TIMESTAMP>.tar.gz on the developer's host.
#
# For the IN-CONTAINER scheduled daily backup, see ops/backup.sh — that
# script is mounted into the `backup` service in docker-compose.yaml and
# writes to /backups on the persistent volume.  Do NOT conflate the two.
#
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

# Issue #89 — verify the dump bytes parse cleanly before we tar + delete.
# Same rationale as the in-container ops/backup.sh: catch corruption at
# backup time, not during recovery.  bsondump ships with mongodb-tools
# (local install) or via `docker exec ${CONTAINER} bsondump ...`.
echo "[backup] Verifying dump integrity"
verify_cmd() {
  if [ "${MODE}" = "--docker" ]; then
    docker exec "${CONTAINER}" bsondump --quiet "$1" >/dev/null 2>&1
  else
    bsondump --quiet "$1" >/dev/null 2>&1
  fi
}
# Inside --docker we copied the dump out to BACKUP_PATH on the host
# already, so we point find at the host path either way.
VERIFIED=0
for bson in $(find "${BACKUP_PATH}" -name '*.bson' 2>/dev/null); do
  # Local mode: bsondump on host path.  Docker mode: copy single file
  # back into container temp, dump, clean up.  Avoids host needing the
  # mongo-tools binary even when --docker is used.
  if [ "${MODE}" = "--docker" ]; then
    INNER="/tmp/verify_$(basename "$bson")"
    docker cp "$bson" "${CONTAINER}:${INNER}" >/dev/null
    if ! docker exec "${CONTAINER}" bsondump --quiet "${INNER}" >/dev/null 2>&1; then
      docker exec "${CONTAINER}" rm -f "${INNER}" || true
      echo "[backup] ERROR: corrupted dump file: $bson" >&2
      exit 1
    fi
    docker exec "${CONTAINER}" rm -f "${INNER}" || true
  else
    if ! bsondump --quiet "$bson" >/dev/null 2>&1; then
      echo "[backup] ERROR: corrupted dump file: $bson" >&2
      exit 1
    fi
  fi
  VERIFIED=$((VERIFIED + 1))
done
if [ "${VERIFIED}" -eq 0 ]; then
  echo "[backup] ERROR: dump produced no .bson files — was the DB empty or unreachable?" >&2
  exit 1
fi
echo "[backup] Verified ${VERIFIED} bson file(s)"

# Compress
tar -czf "${BACKUP_PATH}.tar.gz" -C "${BACKUP_DIR}" "kiip_backup_${TIMESTAMP}"
rm -rf "${BACKUP_PATH}"

echo "[backup] Saved to: ${BACKUP_PATH}.tar.gz"

# Keep only the last 7 backups
find "${BACKUP_DIR}" -name "kiip_backup_*.tar.gz" -mtime +7 -delete 2>/dev/null || true
echo "[backup] Done."
