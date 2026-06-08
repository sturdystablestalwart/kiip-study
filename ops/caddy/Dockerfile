# Issue #52 — custom Caddy build that bundles the `caddy-ratelimit`
# module, used by the edge `rate_limit` directive in Caddyfile.  This
# adds an L7 rate-limit shield in front of Node so a volumetric flood
# is shed at the proxy and never wakes up the Express loop.
#
# Two-stage build: official `caddy:2-builder-alpine` runs xcaddy to
# compile in the third-party module; the runtime image is the same
# slim `caddy:2-alpine` we used before, just with the patched binary
# copied over so we don't lose Caddy's stock alpine init scripts /
# config defaults.
#
# SHA-pin both stages (issue #51).  Refresh via:
#   docker pull caddy:2-builder-alpine && docker inspect ...
#   docker pull caddy:2-alpine          && docker inspect ...
FROM caddy:2-builder-alpine@sha256:0ff10d4b83af453e5526b1c3cd7ae43396832aa8a2a55311d624f6812b33767d AS builder

RUN xcaddy build \
    --with github.com/mholt/caddy-ratelimit

FROM caddy:2-alpine@sha256:77c07d5ebfa5be9fd6c820d2094ae662c9e7eeb9bf98346b7f639900263ee2a2

COPY --from=builder /usr/bin/caddy /usr/bin/caddy
