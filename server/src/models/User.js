const mongoose = require('mongoose');

const {
  SALT_ROUNDS,
  hashPassword,
  verifyPassword: comparePassword,
  isBcryptHash,
} = require('../utils/password');

const USER_ROLES = Object.freeze(['student', 'lecturer', 'admin']);
const CEFR_LEVELS = Object.freeze(['A1', 'A2', 'B1', 'B2', 'C1', 'UNTESTED']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STUDENT_ID_PATTERN = /^[A-Za-z0-9-]{4,20}$/;

/**
 * @param {unknown} _document
 * @param {Record<string, unknown>} serialized
 * @returns {Record<string, unknown>}
 */
function removePassword(_document, serialized) {
  delete serialized.password;
  return serialized;
}

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      minlength: [1, 'name must not be empty'],
      maxlength: [80, 'name must be at most 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_PATTERN, 'email must be a valid address'],
    },
    password: {
      type: String,
      required: [true, 'password is required'],
      minlength: [8, 'password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: { values: USER_ROLES, message: 'role must be one of: student, lecturer, admin' },
      default: 'student',
      index: true,
    },
    studentId: {
      type: String,
      trim: true,
      default: null,
      match: [STUDENT_ID_PATTERN, 'studentId must be 4-20 letters, digits, or hyphens'],
    },
    currentLevel: {
      type: String,
      enum: {
        values: CEFR_LEVELS,
        message: 'currentLevel must be one of: A1, A2, B1, B2, C1, UNTESTED',
      },
      default: 'UNTESTED',
    },
  },
  {
    timestamps: true,
    toJSON: { transform: removePassword },
    toObject: { transform: removePassword },
  }
);

userSchema.index(
  { studentId: 1 },
  { unique: true, partialFilterExpression: { studentId: { $type: 'string' } } }
);

/**
 * Hash and assign a plaintext password. Safe to call before `save()`; the
 * pre-save hook detects the existing bcrypt hash and leaves it untouched.
 *
 * @param {string} plainPassword
 * @returns {Promise<import('mongoose').Document>}
 */
userSchema.methods.setPassword = async function setPassword(plainPassword) {
  this.password = await hashPassword(plainPassword);
  return this;
};

/**
 * @param {string} plainPassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.verifyPassword = function verifyPassword(plainPassword) {
  return comparePassword(plainPassword, this.password);
};

userSchema.pre('save', async function hashPasswordOnSave() {
  if (!this.isModified('password') || isBcryptHash(this.password)) {
    return;
  }

  this.password = await hashPassword(this.password);
});

module.exports = mongoose.model('User', userSchema);
module.exports.SALT_ROUNDS = SALT_ROUNDS;
module.exports.USER_ROLES = USER_ROLES;
module.exports.CEFR_LEVELS = CEFR_LEVELS;
