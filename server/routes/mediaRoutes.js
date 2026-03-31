const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const controller = require('../controllers/mediaController');

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

// Static routes first
router.get('/', controller.getAllMedia);
router.post('/upload', upload.single('video'), controller.uploadVideo);
router.post('/merge', upload.fields([
    { name: 'introLogo', maxCount: 1 },
    { name: 'outroLogo', maxCount: 1 }
]), controller.mergeByIds);

// Param routes last
router.get('/:id', controller.getMedia);
router.post('/:id/overlay', upload.array('images'), controller.applyOverlay);
router.post('/:id/slates', upload.none(), controller.applySlates);

module.exports = router;