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
const rateLimit = require('express-rate-limit');

dotenv.config();

const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust 1 proxy hop (Caddy reverse proxy) for correct req.ip and rate-limit keying
app.set('trust proxy', 1);

// Middleware
app.use(compression());
const ALLOWED_ORIGINS = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({
    origin: (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
        else cb(new Error('CORS not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type'],
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(passport.initialize());

// Global rate limiter — 100 requests per minute per IP (relaxed in test mode)
app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 10000 : 100,
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
      imgSrc: ["'self'", "data:", "blob:"],
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
const { requireAuth } = require('./middleware/auth');
app.use('/uploads/images', express.static(path.join(__dirname, 'uploads/images'), {
    maxAge: '7d',
    immutable: true,
}));
app.use('/uploads/documents', requireAuth, express.static(path.join(__dirname, 'uploads/documents')));
// Do NOT serve /uploads/temp — temp files are internal only

// Ensure upload directories exist
const uploadDir = path.join(__dirname, 'uploads');
const imagesDir = path.join(uploadDir, 'images');
const documentsDir = path.join(uploadDir, 'documents');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}
if (!fs.existsSync(documentsDir)) {
    fs.mkdirSync(documentsDir, { recursive: true });
}

// Database Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kiip_test_app')
.then(async () => {
    console.log('MongoDB Connected');
    // Run Auto-Importer
    const autoImportTests = require('./utils/autoImporter');
    const { parseTextWithLLM } = require('./routes/tests');
    await autoImportTests(parseTextWithLLM);
})
.catch(err => logger.error({ err }, 'MongoDB connection failed'));

// Routes
const { router: testRoutes } = require('./routes/tests');
app.use('/api/tests', testRoutes);

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

const shareRoutes = require('./routes/share');
app.use('/api/shared', shareRoutes);   // GET /api/shared/:shareId (public)
app.use('/api/tests', shareRoutes);    // POST /api/tests/:id/share

const bulkImportRoutes = require('./routes/bulkImport');
const duplicatesRoutes = require('./routes/duplicates');
app.use('/api/admin/tests', bulkImportRoutes);
app.use('/api/admin/duplicates', duplicatesRoutes);

app.get('/', (req, res) => {
    res.send('KIIP Test App API is running');
});

const healthHandler = (req, res) => {
    const mongoState = mongoose.connection.readyState;
    const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    res.json({
        status: mongoState === 1 ? 'ok' : 'degraded',
        mongo: states[mongoState] || 'unknown',
        uptime: process.uptime(),
    });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Production error handler — hide stack traces from clients
app.use((err, req, res, _next) => {
  logger.error({ err }, 'Unhandled error');
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(status).json({ error: message });
});

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const shutdown = (signal) => {
    console.log(`${signal} received, shutting down gracefully...`);
    const forced = setTimeout(() => {
        console.error('Forced shutdown after 30s timeout');
        process.exit(1);
    }, 30000);
    server.close(async () => {
        try { await mongoose.connection.close(); } catch (e) { /* ignore */ }
        clearTimeout(forced);
        process.exit(0);
    });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
