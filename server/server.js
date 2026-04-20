require('dotenv').config({ path: '.env' });

const express = require('express');
const mediaRoutes = require('./routes/mediaRoutes');
const cors = require('cors');
const {
    sanitizeInput,
    authLimiter,
    generalLimiter,
    uploadLimiter,
    validateRequest,
    securityHeaders,
    securityErrorHandler,
    protect,
    requireAdmin,
    protectAndRequireAdmin,
} = require('./middleware/security');

const app = express();
const port = 3000;

// Static files with video streaming support - BEFORE security middleware
app.use('/uploads', (req, res, next) => {
    // Set headers for video streaming
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');

    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }

    next();
}, express.static('uploads', {
    maxAge: '1d',
    etag: true,
    setHeaders: (res, path) => {
        // Additional headers for video files
        if (path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.mov')) {
            res.setHeader('Accept-Ranges', 'bytes');
        }
    }
}));

app.use('/outputs', (req, res, next) => {
    // Set headers for video streaming
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');

    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }

    next();
}, express.static('outputs', {
    maxAge: '1d',
    etag: true,
    setHeaders: (res, path) => {
        // Additional headers for video files
        if (path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.mov')) {
            res.setHeader('Accept-Ranges', 'bytes');
        }
    }
}));

app.use('/thumbnails', express.static('thumbnails', { maxAge: '1d', etag: true }));

// CORS configuration - wildcard with credentials for testing video streaming
app.use(cors({
    origin: '*', // Temporary wildcard for testing
    credentials: true, // Re-enable credentials for auth
    methods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Range', 'Content-Type', 'Authorization']
}));

// Temporarily disable security headers for video testing
app.use(securityHeaders);

// General rate limiting
app.use(generalLimiter);

// Body parsing MUST come before sanitization so req.body exists
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Input sanitization and validation
app.use(sanitizeInput);
app.use(validateRequest);

// Security error handler
app.use(securityErrorHandler);

app.get('/', (req, res) => {
    res.send('Hello World!');
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Public — login, register, forgot password (no auth needed)
app.use('/api/users', require('./routes/userRoutes'));

// Public media routes (home page access)
app.use('/api/media', mediaRoutes);

// Admin only - must be admin (includes authentication check)
app.use('/api/roles', require('./routes/rolesRoutes'));
// Mail routes - forgot password should be accessible without auth
app.use('/api/mail', require('./routes/mailRoutes'));

// Admin only — must be logged in AND have admin role
app.use('/api/admin', require('./routes/adminRoutes'));

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});