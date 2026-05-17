#!/bin/sh
# server/entrypoint.sh (issue #124)
#
# The named volume `server_uploads` in docker-compose.yaml mounts over
# /app/uploads on first boot, wiping the build-time mkdir.  Node's
# own fs.mkdirSync runs once Express starts, but multer-handled
# requests in the gap race with ENOENT.  Doing the mkdir BEFORE node
# starts closes the window.
set -e

UPLOAD_DIR=/app/uploads
mkdir -p \
    "$UPLOAD_DIR/images" \
    "$UPLOAD_DIR/documents" \
    "$UPLOAD_DIR/temp"

# Match the mode the server/index.js mkdir uses (issue #142) so
# sibling containers reading the volume don't see world-readable bits.
chmod 0750 "$UPLOAD_DIR" "$UPLOAD_DIR/images" "$UPLOAD_DIR/documents" "$UPLOAD_DIR/temp"

exec node index.js
