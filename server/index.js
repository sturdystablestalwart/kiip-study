const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

dotenv.config();

const logger = require('./utils/logger');

// Issue #32 — fail fast at boot if required env vars are missing, and
// surface a single warning for optional/feature-gating keys.  We skip
// the check in NODE_ENV=test so vitest suites that pre-set their own
// minimal env (or none) don't refuse to start.
if (process.env.NODE_ENV !== 'test') {
    const { requireEnv, warnEnv } = require('./utils/envValidate');
    requireEnv(['MONGO_URI', 'JWT_SECRET', 'CLIENT_URL', 'ADMIN_EMAIL']);
    warnEnv(['GEMINI_API_KEY'], 'AI test generation + curriculum classification');
    warnEnv(['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'], 'magic-link auth');
    warnEnv(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'], 'Google OAuth sign-in');

    // Issue #38 — ADMIN_EMAIL governs who gets the isAdmin flag on
    // first login.  A typo (or missing var) means every login is
    // non-admin and the operator silently has no admin UI.  Validate
    // the format at boot.
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
        throw new Error(
            `ADMIN_EMAIL is set to "${adminEmail}" which is not a valid ` +
            'email address.  Admin login would silently fail. Refusing to start.'
        );
    }
}

const app = express();
const PORT = process.env.PORT || 5000;

// Trust 1 proxy hop (Caddy reverse proxy) for correct req.ip and rate-limit keying
app.set('trust proxy', 1);

// Middleware
// Issue #443 — defense-in-depth against BREACH-style adaptive
// compression attacks: skip /api/auth/* (responses can carry
// token-shaped material reflected from attacker-influenced query
// params or redirect fragments). For non-auth paths, fall through to
// the default compression.filter so pre-compressed assets aren't
// re-compressed.
app.use(compression({
    filter: (req, res) => {
        if (req.path && req.path.startsWith('/api/auth/')) return false;
        return compression.filter(req, res);
    },
    threshold: 1024,
}));
const ALLOWED_ORIGINS = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({
    origin: (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
        else cb(new Error('CORS not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Issue #33 — request-ID context.  Reuse caller-supplied
// X-Request-Id when present (lets a calling proxy / load balancer
// propagate its own trace IDs), otherwise mint a UUID.  The pino
// logger wrapper reads from logger.requestContext on every log call.
const { randomUUID } = require('crypto');
app.use((req, res, next) => {
    const reqId = req.get('x-request-id') || randomUUID();
    res.set('x-request-id', reqId);
    logger.requestContext.run({ reqId, userId: null }, () => next());
});

// Include the reqId in morgan access logs.
morgan.token('reqid', (req) => (logger.requestContext.getStore() || {}).reqId || '-');

// Issue #141 — magic-link verification reads the token from
// req.query.token.  morgan's default :url token would log the full
// query string, leaking the token to log archives.  This custom
// :safeurl token strips the value of any param named `token` (or
// `code`, for future OAuth-ish flows) so logs see `token=REDACTED`
// instead of the raw value.
morgan.token('safeurl', (req) => {
    const url = req.originalUrl || req.url || '';
    return url.replace(/([?&](?:token|code|access_token|api_key)=)[^&]*/gi, '$1REDACTED');
});

app.use(morgan(
    process.env.NODE_ENV === 'production'
        ? ':remote-addr - :method :safeurl :status :res[content-length] - :response-time ms reqId=:reqid'
        : ':method :safeurl :status :response-time ms reqId=:reqid',
));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(passport.initialize());

// Global rate limiter — 100 requests per minute per IP (relaxed in test mode)
// Issue #441 — IPv6-safe key (parallel to #23). Without ipKeyGenerator
// the bucket is per /128 address, so an IPv6 attacker gets 2^64 buckets.
app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 10000 : 100,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
}));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      // Issue #139 — drop `data:` and `blob:` from img-src.  Inline
      // <img src="data:image/svg+xml;..."> can carry an XSS payload, and
      // nothing in the client uses createObjectURL.  Uploaded images come
      // back as `/uploads/...` (same origin) and decorative SVGs now live
      // in `client/public/` (e.g. /chevron-down.svg) so 'self' suffices.
      imgSrc: ["'self'"],
      connectSrc: ["'self'", "https://accounts.google.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Custom NoSQL injection sanitizer (express-mongo-sanitize is incompatible with Express 5)
const { sanitizeMiddleware } = require('./middleware/sanitizer');
app.use('/api', sanitizeMiddleware);

// Origin/Referer check — defense-in-depth CSRF protection alongside SameSite=Lax cookies
const { createOriginCheck } = require('./middleware/originCheck');
app.use('/api', createOriginCheck(ALLOWED_ORIGINS));

// Serve uploaded images (auth-gated for documents/temp, public for images)
const { requireAuth, requireAdmin } = require('./middleware/auth');
// Issue #446 — `immutable` per RFC 8246 contracts the URL's bytes
// never change; pair it with an effectively-infinite TTL (1y). Upload
// filenames in this app are content-derived (admin.js: img-{ts}-{rand}
// -opt.webp), so new content gets a new filename — they really are
// immutable in practice.
app.use('/uploads/images', express.static(path.join(__dirname, 'uploads/images'), {
    maxAge: '365d',
    immutable: true,
    setHeaders: (res) => {
        // Re-affirm explicit value (defense against express.static defaults drift).
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
}));
app.use('/uploads/documents', requireAuth, express.static(path.join(__dirname, 'uploads/documents')));
// Do NOT serve /uploads/temp — temp files are internal only

// Ensure upload directories exist with an explicit, narrow mode.
// (#142) mkdirSync without `mode` honours the container umask (0o755),
// which lets sibling containers reading the shared docker volume see
// every upload.  0o750 keeps owner full + group read/execute, no world
// access.  multer filename mapping must continue to scrub originalname
// to avoid path traversal (see `safeFilename` helper near the multer
// config).
const UPLOAD_DIR_MODE = 0o750;
const uploadDir = path.join(__dirname, 'uploads');
const imagesDir = path.join(uploadDir, 'images');
const documentsDir = path.join(uploadDir, 'documents');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true, mode: UPLOAD_DIR_MODE });
}
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true, mode: UPLOAD_DIR_MODE });
}
if (!fs.existsSync(documentsDir)) {
    fs.mkdirSync(documentsDir, { recursive: true, mode: UPLOAD_DIR_MODE });
}

// Database Connection (#147)
// Driver defaults are too forgiving for a single-tenant app:
//   - serverSelectionTimeoutMS=30000 turns a misconfigured boot into a
//     30s hang before fail; 5s is plenty for local + same-network mongo.
//   - socketTimeoutMS=0 (unset) means hung sockets stay in the pool
//     forever; 30s lets the driver recycle them.
//   - maxPoolSize=100 is oversized for the single-process workload and
//     hides connection leaks; 20 is enough headroom.
//   - family=4 keeps the resolver on IPv4 so `localhost` doesn't ping
//     ::1 first on dual-stacks where mongo only binds v4.
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kiip_test_app', {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    maxPoolSize: 20,
    family: 4,
})
.then(async () => {
    console.log('MongoDB Connected');
    // Seed KIIP curriculum if empty
    const Curriculum = require('./models/Curriculum');
    const curriculumSeed = require('./utils/curriculumSeed');
    const currCount = await Curriculum.countDocuments();
    if (currCount === 0) {
        await Curriculum.insertMany(curriculumSeed);
        console.log(`Seeded KIIP curriculum: ${curriculumSeed.length} levels`);
    }
    // Run Auto-Importer (issue #21 — opt-in only)
    // The importer reads additionalContext/tests/*.md|.txt and runs
    // Gemini classification + DB inserts.  Every container restart used
    // to re-run it unconditionally, which costs API credits and risks
    // non-deterministic test re-creation in prod.  Now gated behind
    // ENABLE_AUTO_IMPORT=true.  Default OFF in production; .env.example
    // ships ENABLE_AUTO_IMPORT=true for local dev convenience.
    if (process.env.ENABLE_AUTO_IMPORT === 'true') {
        const autoImportTests = require('./utils/autoImporter');
        const { parseTextWithLLM } = require('./routes/tests');
        await autoImportTests(parseTextWithLLM);
    } else {
        logger.info('Auto-importer skipped (ENABLE_AUTO_IMPORT != "true")');
    }
})
.catch(err => logger.error({ err }, 'MongoDB connection failed'));

// Issue #147 — surface ongoing connection events so a flap in
// production shows up as structured logs rather than silent stalls.
mongoose.connection.on('error', (err) => logger.error({ err }, 'mongo error'));
mongoose.connection.on('disconnected', () => logger.warn('mongo disconnected'));
mongoose.connection.on('reconnected', () => logger.info('mongo reconnected'));

// Routes
const { router: testRoutes } = require('./routes/tests');
app.use('/api/tests', testRoutes);

// Issue #185 — client ErrorBoundary telemetry endpoint.  Mounted early
// so it works even when the rest of the API has wider middleware in
// front of it that might reject malformed reports.
const clientErrorRoutes = require('./routes/clientError');
app.use('/api', clientErrorRoutes);

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

const flagRoutes = require('./routes/flags');
app.use('/api/flags', flagRoutes);

const sessionRoutes = require('./routes/sessions');
app.use('/api/sessions', sessionRoutes);

const pdfRoutes = require('./routes/pdf');
app.use('/api/pdf', pdfRoutes);

const statsRoutes = require('./routes/stats');
app.use('/api/stats', statsRoutes);

// Issue #135 — share routes split into public + admin to eliminate the
// dual-mount footgun. publicRouter only handles GET /:shareId; adminRouter
// only handles POST /:id/share. This prevents accidentally exposing the
// no-auth aggregation under /api/tests if mount order is later refactored.
const { publicRouter: sharePublicRouter, adminRouter: shareAdminRouter } = require('./routes/share');
app.use('/api/shared', sharePublicRouter);   // GET /api/shared/:shareId (public)
app.use('/api/tests', shareAdminRouter);     // POST /api/tests/:id/share (admin)

const bulkImportRoutes = require('./routes/bulkImport');
const duplicatesRoutes = require('./routes/duplicates');
app.use('/api/admin/tests', bulkImportRoutes);
app.use('/api/admin/duplicates', duplicatesRoutes);

const reviewRoutes = require('./routes/review');
app.use('/api/review', reviewRoutes);

const curriculumRoutes = require('./routes/curriculum');
app.use('/api/curriculum', curriculumRoutes);

app.get('/', (req, res) => {
    res.send('KIIP Test App API is running');
});

// /health gates HTTP status on mongoose.connection.readyState so external
// monitors (StatusCake, Docker compose wget healthcheck) detect degraded
// mongo as unhealthy instead of always-200. See utils/healthHandler.js.
// Issue #454 — public path is now LEAN (just { ok }) so unauthenticated
// scanners can't enumerate missing env-var names, build sha, or uptime.
// Full verbose payload moved to /api/health/internal (admin-gated).
const healthHandler = require('./utils/healthHandler');
const { healthHandlerPublic } = healthHandler;
app.get('/health', healthHandlerPublic);
app.get('/api/health', healthHandlerPublic);
app.get('/api/health/internal', requireAuth, requireAdmin, healthHandler);

// Production error handler — hide stack traces from clients
app.use((err, req, res, _next) => {
  // Issue #146 — bundle request context with the error so logs are
  // tied to a route, user and client.  Without this an error line is
  // basically a noisy stack trace with no way to triage it.
  logger.error({
    err,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?._id,
    ip: req.ip,
    ua: (req.headers['user-agent'] || '').slice(0, 200),
  }, 'Unhandled error');
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(status).json({ error: message });
});

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Issue #445 — graceful shutdown surfaces mongo-close failures via
// pino and uses distinct exit codes so the operator can tell from
// container logs which path was taken:
//   0 = clean shutdown
//   1 = forced timeout (server.close didn't finish in 30s)
//   2 = mongoose.connection.close() rejected
const shutdown = (signal) => {
    logger.info({ signal }, 'Shutdown signal received, closing gracefully');
    const forced = setTimeout(() => {
        logger.error({ signal }, 'Forced shutdown after 30s timeout');
        process.exit(1);
    }, 30000);
    server.close(async () => {
        let mongoFailed = false;
        try {
            await mongoose.connection.close();
        } catch (err) {
            mongoFailed = true;
            logger.error({ err }, 'Failed to close mongo connection during shutdown');
        }
        clearTimeout(forced);
        process.exit(mongoFailed ? 2 : 0);
    });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
