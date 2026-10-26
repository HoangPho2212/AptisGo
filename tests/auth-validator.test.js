const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateRegisterInput,
  validateLoginInput,
} = require('../server/src/validators/authValidator');

const VALID_REGISTER = {
  name: '  Amina Yusuf  ',
  email: '  Amina.Yusuf@University.edu ',
  password: 'Placement2026!',
};

test('Auth validator: normalizes a valid registration payload', () => {
  const { value, errors } = validateRegisterInput({
    ...VALID_REGISTER,
    studentId: ' GCS210884 ',
    role: 'admin',
    currentLevel: 'C1',
  });

  assert.deepEqual(errors, []);
  assert.equal(value.name, 'Amina Yusuf');
  assert.equal(value.email, 'amina.yusuf@university.edu');
  assert.equal(value.password, 'Placement2026!');
  assert.equal(value.studentId, 'GCS210884');
  assert.equal(value.role, undefined, 'role must never come from the client');
  assert.equal(value.currentLevel, undefined, 'currentLevel must never come from the client');
});

test('Auth validator: rejects a missing or non-object body', () => {
  for (const body of [undefined, null, 'text', 42, []]) {
    const { errors } = validateRegisterInput(body);
    assert.ok(errors.includes('request body must be a JSON object'));
  }
});

test('Auth validator: requires name, email, and password', () => {
  const { errors } = validateRegisterInput({});

  assert.ok(errors.includes('name is required'));
  assert.ok(errors.includes('email is required'));
  assert.ok(errors.includes('password is required'));
});

test('Auth validator: enforces email, name, and password bounds', () => {
  const { errors } = validateRegisterInput({
    name: 'a'.repeat(81),
    email: 'not-an-email',
    password: 'short',
  });

  assert.ok(errors.includes('name must be at most 80 characters'));
  assert.ok(errors.includes('email must be a valid address'));
  assert.ok(errors.includes('password must be 8-72 characters'));
  assert.ok(
    validateRegisterInput({ ...VALID_REGISTER, password: 'a'.repeat(73) }).errors.includes(
      'password must be 8-72 characters'
    )
  );
});

test('Auth validator: rejects invalid studentId but allows omission', () => {
  assert.ok(
    validateRegisterInput({ ...VALID_REGISTER, studentId: '!!' }).errors.includes(
      'studentId must be 4-20 letters, digits, or hyphens'
    )
  );

  const { value, errors } = validateRegisterInput(VALID_REGISTER);
  assert.deepEqual(errors, []);
  assert.equal(value.studentId, null);
});

test('Auth validator: login requires normalized email and a password', () => {
  const valid = validateLoginInput({ email: ' Amina@University.edu ', password: 'Placement2026!' });

  assert.deepEqual(valid.errors, []);
  assert.equal(valid.value.email, 'amina@university.edu');
  assert.equal(valid.value.password, 'Placement2026!');

  const missing = validateLoginInput({});
  assert.ok(missing.errors.includes('email is required'));
  assert.ok(missing.errors.includes('password is required'));
});
