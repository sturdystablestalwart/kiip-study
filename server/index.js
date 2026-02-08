const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
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

app.get('/', (req, res) => {
    res.send('KIIP Test App API is running');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
