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
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://accounts.google.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(mongoSanitize());
app.use(hpp());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
