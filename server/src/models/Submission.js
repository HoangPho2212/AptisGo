const mongoose = require('mongoose');

const QuestionSubDocSchema = require('./Question');

const { QUESTION_SKILLS, QUESTION_TYPES, QUESTION_PARTS } = QuestionSubDocSchema;

const SUBMISSION_STATUSES = Object.freeze(['in_progress', 'pending_review', 'completed']);

const SUBMISSION_SCORE_LIMITS = Object.freeze({
  itemAutoScore: Object.freeze({ min: 0, max: 50 }),
  autoScore: Object.freeze({ min: 0, max: 200 }),
  manualScore: Object.freeze({ min: 0, max: 100 }),
  totalScore: Object.freeze({ min: 0, max: 200 }),
});

const MAX_FEEDBACK_LENGTH = 2000;

const submissionDetailSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'questionId is required'],
    },
    skill: {
      type: String,
      enum: {
        values: QUESTION_SKILLS,
        message: 'skill must be one of: core, listening, reading, writing, speaking',
      },
      required: [true, 'skill is required'],
    },
    part: {
      type: Number,
      enum: {
        values: QUESTION_PARTS,
        message: 'part must be one of: 1, 2, 3, 4',
      },
      required: [true, 'part is required'],
    },
    questionType: {
      type: String,
      enum: {
        values: QUESTION_TYPES,
        message:
          'questionType must be one of: mcq_single, dropdown_match, dropdown_cloze, ' +
          'sentence_order, short_fields, essay_text, audio_record',
      },
      required: [true, 'questionType is required'],
    },
    submittedAnswer: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    mediaUrl: {
      type: String,
      default: null,
      trim: true,
    },
    wordCount: {
      type: Number,
      default: 0,
      min: [0, 'wordCount must be at least 0'],
      validate: {
        validator: Number.isInteger,
        message: 'wordCount must be an integer',
      },
    },
    isCorrect: {
      type: Boolean,
      default: null,
    },
    autoScore: {
      type: Number,
      default: 0,
      min: [SUBMISSION_SCORE_LIMITS.itemAutoScore.min, 'autoScore must be at least 0'],
      max: [SUBMISSION_SCORE_LIMITS.itemAutoScore.max, 'autoScore must be at most 50'],
    },
    lecturerScore: {
      type: Number,
      default: null,
      min: [0, 'lecturerScore must be at least 0'],
      max: [SUBMISSION_SCORE_LIMITS.itemAutoScore.max, 'lecturerScore must be at most 50'],
    },
    lecturerFeedback: {
      type: String,
      default: null,
      trim: true,
      maxlength: [
        MAX_FEEDBACK_LENGTH,
        `lecturerFeedback must be at most ${MAX_FEEDBACK_LENGTH} characters`,
      ],
    },
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'student is required'],
    },
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      required: [true, 'test is required'],
    },
    status: {
      type: String,
      enum: {
        values: SUBMISSION_STATUSES,
        message: 'status must be one of: in_progress, pending_review, completed',
      },
      default: 'completed',
    },
    details: {
      type: [submissionDetailSchema],
      default: [],
    },
    autoScore: {
      type: Number,
      default: 0,
      min: [SUBMISSION_SCORE_LIMITS.autoScore.min, 'autoScore must be at least 0'],
      max: [SUBMISSION_SCORE_LIMITS.autoScore.max, 'autoScore must be at most 200'],
    },
    manualScore: {
      type: Number,
      default: null,
      min: [SUBMISSION_SCORE_LIMITS.manualScore.min, 'manualScore must be at least 0'],
      max: [SUBMISSION_SCORE_LIMITS.manualScore.max, 'manualScore must be at most 100'],
    },
    totalScore: {
      type: Number,
      default: null,
      min: [SUBMISSION_SCORE_LIMITS.totalScore.min, 'totalScore must be at least 0'],
      max: [SUBMISSION_SCORE_LIMITS.totalScore.max, 'totalScore must be at most 200'],
    },
  },
  { timestamps: true }
);

submissionSchema.index({ student: 1, createdAt: -1 });
submissionSchema.index({ status: 1, createdAt: 1 });
submissionSchema.index({ test: 1 });

module.exports = mongoose.model('Submission', submissionSchema);
module.exports.SUBMISSION_STATUSES = SUBMISSION_STATUSES;
module.exports.SUBMISSION_SCORE_LIMITS = SUBMISSION_SCORE_LIMITS;
module.exports.MAX_FEEDBACK_LENGTH = MAX_FEEDBACK_LENGTH;
module.exports.SubmissionDetailSchema = submissionDetailSchema;
