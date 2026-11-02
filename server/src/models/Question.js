const mongoose = require('mongoose');

const QUESTION_SKILLS = Object.freeze(['core', 'listening', 'reading', 'writing', 'speaking']);

const QUESTION_TYPES = Object.freeze([
  'mcq_single',
  'dropdown_match',
  'dropdown_cloze',
  'sentence_order',
  'short_fields',
  'essay_text',
  'audio_record',
]);

const QUESTION_PARTS = Object.freeze([1, 2, 3, 4]);

const questionSubDocSchema = new mongoose.Schema(
  {
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
    prompt: {
      type: String,
      required: [true, 'prompt is required'],
      trim: true,
    },
    contextPassage: {
      type: String,
      default: null,
    },
    mediaUrl: {
      type: String,
      default: null,
    },
    prepTimeSeconds: {
      type: Number,
      default: 0,
    },
    recordTimeSeconds: {
      type: Number,
      default: 45,
    },
    minWords: {
      type: Number,
      default: null,
    },
    maxWords: {
      type: Number,
      default: null,
    },
    options: {
      type: [{ type: String }],
      default: [],
    },
    dropdownSets: {
      type: [
        {
          prompt: {
            type: String,
            required: [true, 'dropdown prompt is required'],
            trim: true,
          },
          options: {
            type: [{ type: String, required: [true, 'dropdown option is required'] }],
            default: [],
          },
          correctAnswer: {
            type: String,
            required: [true, 'dropdown correctAnswer is required'],
            select: false,
          },
        },
      ],
      default: [],
    },
    sentences: {
      type: [
        {
          order: {
            type: Number,
            required: [true, 'sentence order is required'],
          },
          text: {
            type: String,
            required: [true, 'sentence text is required'],
            trim: true,
          },
          isFixed: {
            type: Boolean,
            default: false,
          },
        },
      ],
      default: [],
    },
    formFields: {
      type: [
        {
          fieldId: {
            type: String,
            required: [true, 'form fieldId is required'],
            trim: true,
          },
          label: {
            type: String,
            required: [true, 'form label is required'],
            trim: true,
          },
          minWords: {
            type: Number,
            default: 1,
          },
          maxWords: {
            type: Number,
            default: 5,
          },
        },
      ],
      default: [],
    },
    correctAnswer: {
      type: mongoose.Schema.Types.Mixed,
      select: false,
    },
  },
  { _id: true }
);

module.exports = questionSubDocSchema;
module.exports.QUESTION_SKILLS = QUESTION_SKILLS;
module.exports.QUESTION_TYPES = QUESTION_TYPES;
module.exports.QUESTION_PARTS = QUESTION_PARTS;
