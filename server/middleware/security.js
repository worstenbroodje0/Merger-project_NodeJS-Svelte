const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const { body, validationResult } = require('express-validator');
const hpp = require('hpp');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// ── SQL Injection / Input Sanitization ───────────────────────────────────────

const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
        .replace(/['"\\;]/g, '')
        .replace(/--/g, '')
        .replace(/\/\*/g, '')
        .replace(/\*\//g, '')
        .replace(/\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b/gi, '')
        .trim();
};

const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return;
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'string') {
            obj[key] = sanitizeString(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitizeObject(obj[key]);
        }
    });
};

const sanitizeInput = (req, res, next) => {
    if (req.query) {
        Object.keys(req.query).forEach(key => {
            if (typeof req.query[key] === 'string') {
                req.query[key] = sanitizeString(req.query[key]);
            }
        });
    }
    if (req.params) {
        Object.keys(req.params).forEach(key => {
            if (typeof req.params[key] === 'string') {
                req.params[key] = sanitizeString(req.params[key]);
            }
        });
    }
    if (req.body) sanitizeObject(req.body);
    next();
};

// ── Empty Field Validation ────────────────────────────────────────────────────

/**
 * Checks that all listed fields exist and are non-empty strings on req.body.
 * Usage: requireFields('email', 'password')
 */
const requireFields = (...fields) => (req, res, next) => {
    const missing = fields.filter(field => {
        const val = req.body?.[field];
        return val === undefined || val === null || String(val).trim() === '';
    });

    if (missing.length > 0) {
        return res.status(400).json({
            status: 'error',
            message: `Missing or empty required field(s): ${missing.join(', ')}`,
        });
    }
    next();
};

// ── JWT Auth Middleware ───────────────────────────────────────────────────────

/**
 * Verifies the Bearer token on protected routes.
 * Attaches { id, email } to req.user on success.
 */
const protect = (req, res, next) => {
    // Development-friendly token resolution: check Authorization header,
    // then `x-access-token`, then query param `token`, then cookies.
    // Do not log token values in production.
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    if (!token && req.headers['x-access-token']) {
        token = req.headers['x-access-token'];
    }

    if (!token && req.query && req.query.token) {
        token = req.query.token;
    }

    // cookie-parser may populate req.cookies
    if (!token && req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    // Debug info (development only): report where token was found or not.
    if (process.env.NODE_ENV !== 'production') {
        const hasAuthHeader = !!authHeader;
        const hasXToken = !!req.headers['x-access-token'];
        const hasQueryToken = !!(req.query && req.query.token);
        const hasCookieToken = !!(req.cookies && req.cookies.token);
    }

    if (!token || token.trim() === '') {
        return res.status(401).json({ status: 'error', message: 'Not authenticated or token missing' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, email }
        next();
    } catch (err) {
        const message = err.name === 'TokenExpiredError'
            ? 'Token has expired, please log in again'
            : 'Invalid or expired token';
        return res.status(401).json({ status: 'error', message });
    }
};

// ── Role Checking ─────────────────────────────────────────────────────────────

const ROLES = {
    ADMIN: 'admin',
    EDITOR: 'editor',
    USER: 'user',
};

/**
 * Returns middleware that checks the DB user's role against allowedRoles.
 * Must be used after `protect`.
 * Usage: requireRole('admin'), requireRole('admin', 'editor')
 */
const requireRole = (...allowedRoles) => async (req, res, next) => {
    if (!req.user?.id) {
        return res.status(401).json({ status: 'error', message: 'Not authenticated' });
    }

    try {
        const { getUserById } = require('../db');
        const user = await getUserById(req.user.id);

        if (!user) {
            return res.status(401).json({ status: 'error', message: 'User no longer exists' });
        }

        const userRole = user?.role?.name;

        if (!userRole || !allowedRoles.includes(userRole)) {
            return res.status(403).json({
                status: 'error',
                message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
            });
        }

        req.userRole = userRole; // Attach role for downstream use
        next();
    } catch (err) {
        console.error('requireRole error:', err);
        return res.status(500).json({ status: 'error', message: 'Authorization check failed' });
    }
};

/**
 * Shorthand: must be admin or editor.
 * Must be used after `protect`.
 */
const requireAdmin = requireRole(ROLES.ADMIN, ROLES.EDITOR);

/**
 * Combined: authenticate + check admin/editor role in one step.
 */
const protectAndRequireAdmin = [
    protect,
    requireRole(ROLES.ADMIN, ROLES.EDITOR),
];

// ── Rate Limiting ─────────────────────────────────────────────────────────────

const createRateLimit = (windowMs, max, message) => rateLimit({
    windowMs,
    max,
    message: { status: 'error', message },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = createRateLimit(
    15 * 60 * 1000,
    5,
    'Too many authentication attempts, please try again later.'
);

const generalLimiter = createRateLimit(
    15 * 60 * 1000,
    100,
    'Too many requests from this IP, please try again later.'
);

const uploadLimiter = createRateLimit(
    60 * 60 * 1000,
    10,
    'Too many upload attempts, please try again later.'
);

// ── Video Size Limit (100 MB per file) ───────────────────────────────────────

const VIDEO_SIZE_LIMIT = 100 * 1024 * 1024; // 100 MB in bytes

/**
 * Multer file filter — rejects non-video MIME types.
 */
const videoFileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'image/jpeg', 'image/png', 'image/gif'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: mp4, webm, mov, avi, jpg, png, gif`), false);
    }
};

/**
 * Pre-upload middleware: rejects requests whose Content-Length header
 * already exceeds the video size limit — stops the stream before multer runs.
 */
const enforceVideoSizeLimit = (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > VIDEO_SIZE_LIMIT) {
        return res.status(413).json({
            status: 'error',
            message: `File too large. Maximum allowed size is ${VIDEO_SIZE_LIMIT / (1024 * 1024)} MB.`,
        });
    }
    next();
};

/**
 * Multer error handler — catches MulterError (e.g. LIMIT_FILE_SIZE) and
 * returns a clean JSON response instead of crashing.
 * Place after any route that uses multer.
 */
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                status: 'error',
                message: `File too large. Maximum allowed size is ${VIDEO_SIZE_LIMIT / (1024 * 1024)} MB.`,
            });
        }
        return res.status(400).json({ status: 'error', message: `Upload error: ${err.message}` });
    }
    if (err?.message?.startsWith('Unsupported file type')) {
        return res.status(415).json({ status: 'error', message: err.message });
    }
    next(err);
};

// ── XSS / Request Validation ──────────────────────────────────────────────────

const validateRequest = (req, res, next) => {
    const suspiciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /eval\(/gi,
        /expression\(/gi,
    ];

    const checkValue = (value) => {
        if (typeof value === 'string') {
            for (const pattern of suspiciousPatterns) {
                if (pattern.test(value)) return false;
            }
        } else if (typeof value === 'object' && value !== null) {
            for (const key in value) {
                if (!checkValue(value[key])) return false;
            }
        }
        return true;
    };

    if (!checkValue(req.query)) {
        return res.status(400).json({ status: 'error', message: 'Invalid request parameters detected' });
    }
    if (!checkValue(req.body)) {
        return res.status(400).json({ status: 'error', message: 'Invalid request body detected' });
    }

    next();
};

// ── Security Headers ──────────────────────────────────────────────────────────

const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "http:", "https:"],
            connectSrc: ["'self'", "http:", "https:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "blob:", "data:"],
            frameSrc: ["'none'"],
            childSrc: ["'none'"],
            workerSrc: ["'self'"],
            manifestSrc: ["'self'"],
            upgradeInsecureRequests: [],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
});

// ── Validation Helpers (express-validator) ────────────────────────────────────

const validateInput = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            status: 'error',
            message: 'Validation failed',
            errors: errors.array(),
        });
    }
    next();
};

const userValidationRules = [
    body('name').trim().notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 50 }).escape().withMessage('Name must be between 2 and 50 characters'),
    body('email').notEmpty().withMessage('Email is required')
        .isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
];

const loginValidationRules = [
    body('email').notEmpty().withMessage('Email is required')
        .isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
];

const mediaValidationRules = [
    body('name').trim().notEmpty().withMessage('Name is required')
        .isLength({ min: 1, max: 255 }).escape().withMessage('Name must be under 255 characters'),
    body('tags').optional().trim()
        .isLength({ max: 500 }).escape().withMessage('Tags must be less than 500 characters'),
];

// ── Error Handler ─────────────────────────────────────────────────────────────

const securityErrorHandler = (err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ status: 'error', message: 'Invalid JSON format' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ status: 'error', message: 'Request entity too large' });
    }
    next(err);
};

module.exports = {
    // Sanitization
    sanitizeInput,
    sanitizeString,
    sanitizeObject,

    // Auth
    protect,
    requireRole,
    requireAdmin,
    protectAndRequireAdmin,

    // Field validation
    requireFields,

    // Rate limiting
    authLimiter,
    generalLimiter,
    uploadLimiter,

    // Video size enforcement
    VIDEO_SIZE_LIMIT,
    videoFileFilter,
    enforceVideoSizeLimit,
    handleMulterError,

    // Request/input validation
    validateRequest,
    validateInput,
    userValidationRules,
    loginValidationRules,
    mediaValidationRules,

    // Headers & errors
    securityHeaders,
    securityErrorHandler,

    // Role constants
    ROLES,
};