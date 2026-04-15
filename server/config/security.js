// Security configuration settings

const securityConfig = {
    // Rate limiting configuration
    rateLimiting: {
        // Authentication endpoints (login, register)
        auth: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // 5 attempts per window
            message: 'Too many authentication attempts, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
        },
        
        // General API endpoints
        general: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // 100 requests per window
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
        },
        
        // Upload endpoints
        upload: {
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 10, // 10 uploads per hour
            message: 'Too many upload attempts, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
        },
    },

    // CORS configuration
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true,
        optionsSuccessStatus: 200,
    },

    // Helmet security headers
    helmet: {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "http:", "https:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
                childSrc: ["'none'"],
                workerSrc: ["'self'"],
                manifestSrc: ["'self'"],
                upgradeInsecureRequests: [],
            },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
    },

    // File upload security
    uploads: {
        maxFileSize: 100 * 1024 * 1024, // 100MB
        allowedVideoTypes: [
            'video/mp4',
            'video/webm',
            'video/quicktime',
            'video/x-msvideo',
            'video/x-matroska'
        ],
        allowedImageTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp'
        ],
        // Sanitize filenames
        sanitizeFilename: (filename) => {
            return filename
                .replace(/[^a-zA-Z0-9.-]/g, '_')
                .replace(/_{2,}/g, '_')
                .toLowerCase();
        }
    },

    // SQL injection patterns to block
    sqlInjectionPatterns: [
        /['"\\;]/g,
        /--/g,
        /\/\*/g,
        /\*\//g,
        /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b/gi,
        /\b(OR|AND)\s+\d+\s*=\s*\d+/gi,
        /\b(OR|AND)\s+['"][^'"]*['"]\s*=\s*['"][^'"]*['"]/gi
    ],

    // XSS patterns to block
    xssPatterns: [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /eval\(/gi,
        /expression\(/gi,
        /<iframe[^>]*>/gi,
        /<object[^>]*>/gi,
        /<embed[^>]*>/gi
    ],

    // Input validation rules
    validation: {
        user: {
            name: {
                min: 2,
                max: 50,
                pattern: /^[a-zA-Z\s]+$/,
                message: 'Name must contain only letters and spaces, and be between 2 and 50 characters'
            },
            email: {
                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Please provide a valid email address'
            },
            password: {
                min: 6,
                max: 128,
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                message: 'Password must be at least 6 characters long and contain at least one uppercase letter, one lowercase letter, and one number'
            }
        },
        media: {
            name: {
                min: 1,
                max: 255,
                message: 'Name must be between 1 and 255 characters'
            },
            tags: {
                max: 500,
                pattern: /^[a-zA-Z0-9\s,\-_]+$/,
                message: 'Tags can only contain letters, numbers, spaces, commas, hyphens, and underscores'
            }
        }
    },

    // Environment-specific settings
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
};

module.exports = securityConfig;
