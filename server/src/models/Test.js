const mongoose = require('mongoose');

const QuestionSubDocSchema = require('./Question');

const { QUESTION_SKILLS, QUESTION_TYPES, QUESTION_PARTS } = QuestionSubDocSchema;

const TEST_TYPES = Object.freeze(['diagnostic', 'mock', 'practice']);
const TARGET_CEFR_LEVELS = Object.freeze(['B1', 'B2', 'C1']);

const testSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: {
        values: TEST_TYPES,
        message: 'type must be one of: diagnostic, mock, practice',
      },
      required: [true, 'type is required'],
      index: true,
    },
    targetCefr: {
      type: String,
      enum: {
        values: TARGET_CEFR_LEVELS,
        message: 'targetCefr must be one of: B1, B2, C1',
      },
      default: 'B2',
    },
    skillModules: {
      type: [
        {
          type: String,
          enum: {
            values: QUESTION_SKILLS,
            message: 'skillModules must contain only: core, listening, reading, writing, speaking',
          },
        },
      ],
      default: [],
    },
    durationMinutes: {
      type: Number,
      required: [true, 'durationMinutes is required'],
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    questions: {
      type: [QuestionSubDocSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Test', testSchema);
module.exports.TEST_TYPES = TEST_TYPES;
module.exports.TARGET_CEFR_LEVELS = TARGET_CEFR_LEVELS;
module.exports.QUESTION_SKILLS = QUESTION_SKILLS;
module.exports.QUESTION_TYPES = QUESTION_TYPES;
module.exports.QUESTION_PARTS = QUESTION_PARTS;
