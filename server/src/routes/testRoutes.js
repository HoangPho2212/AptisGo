const router = require('express').Router();

const { getPlacementTest } = require('../controllers/testController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/placement', verifyToken, authorizeRoles('student'), getPlacementTest);

module.exports = router;
