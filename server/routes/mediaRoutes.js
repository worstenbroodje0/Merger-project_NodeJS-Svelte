const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const controller = require('../controllers/mediaController');
const { uploadLimiter, protect } = require('../middleware/security');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = file.fieldname === 'video' ? 'uploads/' : 'temp/';
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }
});

// Public routes - no authentication required
router.get('/', controller.getAllMedia);
router.get('/regular', controller.getRegularMedia);
router.get('/:id', controller.getMedia);

// Protected routes - require authentication
router.post('/upload', protect, uploadLimiter, upload.single('video'), controller.uploadVideo);
router.post('/merge', protect, uploadLimiter, upload.fields([
    { name: 'introLogo', maxCount: 1 },
    { name: 'outroLogo', maxCount: 1 },
    { name: 'introImage', maxCount: 1 },
    { name: 'outroImage', maxCount: 1 },
    { name: 'overlayImage', maxCount: 1 }
]), controller.mergeByIds);

router.post('/merge-upload', protect, uploadLimiter, upload.array('videos', 10), controller.mergeUploadedVideos);
router.patch('/:id', protect, controller.EditVideo);
router.delete('/:id', protect, controller.DeleteVideo);
router.post('/:id/overlay', protect, upload.array('images'), controller.applyOverlay);
router.post('/:id/slates', protect, upload.none(), controller.applySlates);

module.exports = router;