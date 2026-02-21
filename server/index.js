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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(passport.initialize());

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://accounts.google.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Custom NoSQL injection sanitizer (express-mongo-sanitize is incompatible with Express 5)
app.use((req, _res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    }
    return obj;
  };
  if (req.body) sanitize(req.body);
  if (req.params) sanitize(req.params);
  // Express 5: req.query is a getter, so sanitize the parsed values in-place
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete req.query[key];
      } else if (typeof req.query[key] === 'object') {
        sanitize(req.query[key]);
      }
    }
  }
  next();
});

// Serve uploaded images (auth-gated for documents/temp, public for images)
const { requireAuth } = require('./middleware/auth');
app.use('/uploads/images', express.static(path.join(__dirname, 'uploads/images')));
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
.catch(err => console.log(err));

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

app.get('/health', (req, res) => {
    const mongoState = mongoose.connection.readyState;
    const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    res.json({
        status: mongoState === 1 ? 'ok' : 'degraded',
        mongo: states[mongoState] || 'unknown',
        uptime: process.uptime()
    });
});

// Production error handler — hide stack traces from clients
app.use((err, req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
