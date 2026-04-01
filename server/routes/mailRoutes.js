// mailRoutes.js
const express = require("express");
const router = express.Router();
const mailController = require("../controllers/mailController");

router.post('/send-mail', mailController.sendMail);
router.post('/forgot-password', mailController.forgotPassword);
router.post('/reset-password', mailController.resetPassword);

module.exports = router;