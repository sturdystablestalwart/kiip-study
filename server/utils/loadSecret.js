/**
 * Issue #9 — secret resolution with Docker Secrets preference.
 *
 * Reads /run/secrets/<lowercase-name> first (the location compose
 * mounts file-based secrets at), then falls back to process.env[name]
 * for local-dev and tests that don't have the secrets dir.
 *
 * Cached after first read so we don't fs.readFileSync on every JWT
 * verify in a hot request path.
 *
 *   const JWT_SECRET = loadSecret('JWT_SECRET');
 *
 * Note: this is a SYNCHRONOUS helper because most call sites run at
 * module-load time (e.g. middleware/auth.js).  fs.readFileSync at boot
 * is acceptable; on the hot path we hit the cache instead.
 */
const fs = require('fs');

// /run/secrets is a Linux-only Docker convention; concatenate with a
// literal forward slash so the path stays portable across platforms
// (path.join would emit backslashes on Windows, defeating tests that
// stub this exact prefix).
const SECRETS_DIR = '/run/secrets';
const cache = new Map();

function loadSecret(name) {
    if (cache.has(name)) return cache.get(name);
    const filePath = `${SECRETS_DIR}/${name.toLowerCase()}`;
    let value;
    try {
        // existsSync first so we don't take an EACCES/ENOENT noise hit
        // on local-dev where /run/secrets doesn't exist at all.
        if (fs.existsSync(filePath)) {
            value = fs.readFileSync(filePath, 'utf8').trim();
        }
    } catch {
        // Fall through to env var — secret file unreadable for any reason.
    }
    if (!value) value = process.env[name];
    cache.set(name, value);
    return value;
}

// Exported only for tests that need to reset the cache between cases.
function __resetCache() { cache.clear(); }

module.exports = loadSecret;
module.exports.__resetCache = __resetCache;
