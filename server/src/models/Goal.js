const mongoose = require('mongoose');

const GOAL_CERTIFICATES = Object.freeze(['B1', 'B2', 'C1']);

const goalSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'student is required'],
      unique: true,
    },
    targetCertificate: {
      type: String,
      enum: {
        values: GOAL_CERTIFICATES,
        message: 'targetCertificate must be one of: B1, B2, C1',
      },
      default: 'B2',
      required: [true, 'targetCertificate is required'],
    },
    deadline: {
      type: Date,
      required: [true, 'deadline is required'],
    },
    dailyMinutesTarget: {
      type: Number,
      default: 45,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Goal', goalSchema);
module.exports.GOAL_CERTIFICATES = GOAL_CERTIFICATES;
