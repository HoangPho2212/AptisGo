const router = require('express').Router();

const { createGoal } = require('../controllers/goalController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

router.post('/', verifyToken, authorizeRoles('student'), createGoal);

module.exports = router;
