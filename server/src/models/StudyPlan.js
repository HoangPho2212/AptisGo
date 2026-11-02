const mongoose = require('mongoose');

const QuestionSubDocSchema = require('./Question');

const TASK_SKILLS = QuestionSubDocSchema.QUESTION_SKILLS;

const studyPlanTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'task title is required'],
      trim: true,
    },
    skill: {
      type: String,
      enum: {
        values: TASK_SKILLS,
        message: 'skill must be one of: core, listening, reading, writing, speaking',
      },
      required: [true, 'skill is required'],
    },
    partNumber: {
      type: Number,
      required: [true, 'partNumber is required'],
    },
    points: {
      type: Number,
      default: 10,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const studyPlanSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'student is required'],
      index: true,
    },
    dayNumber: {
      type: Number,
      required: [true, 'dayNumber is required'],
    },
    dailyTasks: {
      type: [studyPlanTaskSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StudyPlan', studyPlanSchema);
module.exports.TASK_SKILLS = TASK_SKILLS;
module.exports.StudyPlanTaskSchema = studyPlanTaskSchema;
