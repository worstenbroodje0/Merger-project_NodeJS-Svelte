const express = require('express');
const router = express.Router();
const catchAsync = require('../utils/catchAsync');
const { getRolesData } = require('../db');

// Get all roles
router.get('/', catchAsync(async (req, res) => {
    const roles = await getRolesData();
    res.json({ status: 'success', data: roles });
}));

module.exports = router;
