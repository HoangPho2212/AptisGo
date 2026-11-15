const router = require('express').Router();

const { getTodayPlan, updateTaskCompletion } = require('../controllers/studyPlanController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/today', verifyToken, authorizeRoles('student'), getTodayPlan);
router.patch('/tasks/:id', verifyToken, authorizeRoles('student'), updateTaskCompletion);

module.exports = router;
