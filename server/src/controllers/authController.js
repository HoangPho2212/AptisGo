const User = require('../models/User');
const { signAccessToken } = require('../utils/jwt');
const { validateRegisterInput, validateLoginInput } = require('../validators/authValidator');

const INVALID_CREDENTIALS = 'Invalid email or password';
const DUPLICATE_EMAIL = 'Email is already registered';

/**
 * @param {import('mongoose').Document} user
 * @returns {{ token: string, tokenType: 'Bearer', user: object }}
 */
function tokenResponse(user) {
  return {
    token: signAccessToken(user),
    tokenType: 'Bearer',
    user: user.toJSON(),
  };
}

/**
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 */
async function register(request, response) {
  const { value, errors } = validateRegisterInput(request.body);

  if (errors.length > 0) {
    return response.status(400).json({ error: 'Validation failed', details: errors });
  }

  const existing = await User.exists({ email: value.email });

  if (existing) {
    return response.status(409).json({ error: DUPLICATE_EMAIL });
  }

  let user;

  try {
    user = await User.create({
      name: value.name,
      email: value.email,
      password: value.password,
      studentId: value.studentId,
    });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({ error: DUPLICATE_EMAIL });
    }
    throw error;
  }

  return response.status(201).json(tokenResponse(user));
}

/**
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 */
async function login(request, response) {
  const { value, errors } = validateLoginInput(request.body);

  if (errors.length > 0) {
    return response.status(400).json({ error: 'Validation failed', details: errors });
  }

  const user = await User.findOne({ email: value.email }).select('+password');

  if (!user || !(await user.verifyPassword(value.password))) {
    return response.status(401).json({ error: INVALID_CREDENTIALS });
  }

  return response.status(200).json(tokenResponse(user));
}

module.exports = { register, login };
