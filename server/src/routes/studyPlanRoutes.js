const router = require('express').Router();

const { updateTaskCompletion } = require('../controllers/studyPlanController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

router.patch('/tasks/:id', verifyToken, authorizeRoles('student'), updateTaskCompletion);

module.exports = router;
