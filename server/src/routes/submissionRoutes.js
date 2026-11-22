const router = require('express').Router();

const { createSubmission } = require('../controllers/submissionController');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

router.post('/', verifyToken, authorizeRoles('student'), createSubmission);

module.exports = router;
