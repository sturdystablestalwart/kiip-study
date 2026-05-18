# Issue #201 — tiny purpose-built image for the scheduled mongodump cron.
#
# The `backup` service in docker-compose.yaml only needs:
#   * mongodump  (mongodb-tools apk package, MongoDB-7 wire compatible)
#   * tar + gzip + rm + ls + xargs  (busybox/coreutils — present in alpine)
#   * sh        (alpine ash, used by ops/backup.sh)
#
# It does NOT need mongod, mongosh, mongo shell legacy, or any node.js
# runtime, so shipping the full ~700MB `mongo:7` image was pure waste.
# Alpine + mongodb-tools resolves to ~60MB.
#
# SHA-pin alpine like every other image in this repo (issue #51).
# To refresh: `docker pull alpine:3.20 && docker inspect --format='{{index .RepoDigests 0}}' alpine:3.20`
FROM alpine:3.23@sha256:5b10f432ef3da1b8d4c7eb6c487f2f5a8f096bc91145e68878dd4a5019afde11

# mongodb-tools (100.9.x on alpine 3.20) is wire-compatible with the
# mongo 7 server we run alongside.  --no-cache keeps the layer slim;
# everything else (tar, gzip, ls, xargs, date) is in busybox by default.
RUN apk add --no-cache mongodb-tools

# The backup loop and rotation lives in ops/backup.sh which compose
# bind-mounts at /usr/local/bin/backup.sh:ro — we don't bake it in so a
# script tweak doesn't require an image rebuild.
ENTRYPOINT ["/bin/sh", "-c"]
