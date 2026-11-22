const router = require('express').Router();

const { getPlacementTest, getTestById } = require('../controllers/testController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// The literal path must stay first so "placement" is never read as an id.
router.get('/placement', verifyToken, authorizeRoles('student'), getPlacementTest);
router.get('/:id', verifyToken, authorizeRoles('student'), getTestById);

module.exports = router;
