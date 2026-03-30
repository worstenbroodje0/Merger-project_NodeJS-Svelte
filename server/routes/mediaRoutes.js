const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const controller = require('../controllers/mediaController');

const upload = multer({
    dest: 'temp/',
    limits: { fileSize: 100 * 1024 * 1024 }
});

// Static routes first
router.get('/',                                    controller.getAllMedia);
router.post('/upload',  upload.single('video'),    controller.uploadVideo);
router.post('/merge',   upload.none(),             controller.mergeByIds);

// Param routes last
router.get('/:id',                                 controller.getMedia);
router.post('/:id/overlay', upload.array('images'), controller.applyOverlay);
router.post('/:id/slates',  upload.none(),          controller.applySlates);

module.exports = router;