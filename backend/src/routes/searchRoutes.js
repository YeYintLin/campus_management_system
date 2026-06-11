const express = require('express');
const { globalSearch } = require('../controllers/searchController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, globalSearch);

module.exports = router;
