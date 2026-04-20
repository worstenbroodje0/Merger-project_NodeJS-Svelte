const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const { body, validationResult } = require('express-validator');
const hpp = require('hpp');
const jwt = require('jsonwebtoken');

// SQL Injection Protection Middleware
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

    if (req.body) {
        sanitizeObject(req.body);
    }

    next();
};

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

// ── JWT Auth Middleware ───────────────────────────────────────────────────────

/**
 * Verifies the Bearer token on protected routes.
 * Attaches { id, email } to req.user on success.
 */
const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: 'error', message: 'Not authenticated' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.user = decoded; // { id, email }
        next();
    } catch {
        return res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
    }
};

/**
 * Must be used after `protect`.
 * Re-fetches the user from the DB and checks their role — never trusts the token for role.
 */
const requireAdmin = async (req, res, next) => {
    try {
        const { getUserById } = require('../db');
        const user = await getUserById(req.user.id);
        if (user?.role?.name !== 'admin' && user?.role.name !== 'editor') {
            return res.status(403).json({ status: 'error', message: 'Admin access required' });
        }
        next();
    } catch {
        return res.status(500).json({ status: 'error', message: 'Authorization check failed' });
    }
};

/**
 * Combined middleware that handles both authentication and admin checking.
 * Verifies Bearer token and checks if user is admin/editor.
 */
const protectAndRequireAdmin = async (req, res, next) => {
    // First, authenticate
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: 'error', message: 'Not authenticated' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.user = decoded; // { id, email }

        // Then, check admin role
        const { getUserById } = require('../db');
        const user = await getUserById(req.user.id);
        if (user?.role?.name !== 'admin' && user?.role.name !== 'editor') {
            return res.status(403).json({ status: 'error', message: 'Admin access required' });
        }
        next();
    } catch (err) {
        console.error('protectAndRequireAdmin error:', err);
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
        }
        return res.status(500).json({ status: 'error', message: 'Authorization check failed', details: err.message });
    }
};

// ── Rate Limiting ─────────────────────────────────────────────────────────────

const createRateLimit = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: { status: 'error', message },
        standardHeaders: true,
        legacyHeaders: false,
    });
};

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

// ── Request Validation ────────────────────────────────────────────────────────

const validateRequest = (req, res, next) => {
    const suspiciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /eval\(/gi,
        /expression\(/gi
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
// Security headers middleware - relaxed for video streaming
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

// ── Validation Helpers ────────────────────────────────────────────────────────

const validateInput = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
    }
    next();
};

const userValidationRules = [
    body('name').trim().isLength({ min: 2, max: 50 }).escape().withMessage('Name must be between 2 and 50 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
];

const mediaValidationRules = [
    body('name').trim().isLength({ min: 1, max: 255 }).escape().withMessage('Name is required'),
    body('tags').optional().trim().isLength({ max: 500 }).escape().withMessage('Tags must be less than 500 characters')
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
    sanitizeInput,
    sanitizeString,
    sanitizeObject,
    protect,
    requireAdmin,
    protectAndRequireAdmin,
    authLimiter,
    generalLimiter,
    uploadLimiter,
    validateRequest,
    validateInput,
    securityHeaders,
    securityErrorHandler,
    userValidationRules,
    mediaValidationRules,
};