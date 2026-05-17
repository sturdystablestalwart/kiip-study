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
FROM caddy:2-builder-alpine@sha256:52575959b1eeee9900869325a953d71e4c521ab9102dd5cce07d429ea8246b85 AS builder

RUN xcaddy build \
    --with github.com/mholt/caddy-ratelimit

FROM caddy:2-alpine@sha256:86deaf5e3d3408a6ccec08fbb79989783dd26e206ae10bcf78a801dc8c9ab794

COPY --from=builder /usr/bin/caddy /usr/bin/caddy
