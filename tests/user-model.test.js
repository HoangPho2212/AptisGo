const test = require('node:test');
const assert = require('node:assert/strict');

const User = require('../server/src/models/User');

const VALID_USER = {
  name: 'Amina Yusuf',
  email: 'Amina.Yusuf@University.edu ',
  password: 'Placement2026!',
  studentId: 'GCS210884',
};

async function errorsFor(overrides) {
  const user = new User({ ...VALID_USER, ...overrides });

  try {
    await user.validate();
    return [];
  } catch (error) {
    return Object.keys(error.errors);
  }
}

test('User schema: normalizes email and applies safe defaults', async () => {
  const user = new User(VALID_USER);

  await user.validate();
  assert.equal(user.email, 'amina.yusuf@university.edu');
  assert.equal(user.role, 'student');
  assert.equal(user.currentLevel, 'UNTESTED');
  assert.equal(user.studentId, 'GCS210884');
  assert.equal(User.schema.path('password').options.select, false);
  assert.ok(User.schema.path('createdAt'), 'timestamps must be enabled');
  assert.ok(User.schema.path('updatedAt'), 'timestamps must be enabled');
});

test('User schema: name, email, and password are required', async () => {
  assert.ok((await errorsFor({ name: undefined })).includes('name'));
  assert.ok((await errorsFor({ email: undefined })).includes('email'));
  assert.ok((await errorsFor({ password: undefined })).includes('password'));
});

test('User schema: email must be valid and within length limits', async () => {
  assert.ok((await errorsFor({ email: 'not-an-email' })).includes('email'));
  assert.ok((await errorsFor({ email: 'missing@domain' })).includes('email'));
  assert.ok((await errorsFor({ name: 'a'.repeat(81) })).includes('name'));
});

test('User schema: password requires at least 8 characters', async () => {
  assert.ok((await errorsFor({ password: 'short' })).includes('password'));
});

test('User schema: role and currentLevel are strict enums', async () => {
  assert.ok((await errorsFor({ role: 'superadmin' })).includes('role'));
  assert.ok((await errorsFor({ currentLevel: 'B3' })).includes('currentLevel'));
  assert.ok((await errorsFor({ currentLevel: 'b2' })).includes('currentLevel'));

  const lecturer = new User({ ...VALID_USER, role: 'lecturer', currentLevel: 'B2' });
  await lecturer.validate();
});

test('User schema: optional studentId follows the university ID pattern', async () => {
  assert.ok((await errorsFor({ studentId: '!!' })).includes('studentId'));
  assert.ok((await errorsFor({ studentId: 'AB1' })).includes('studentId'));
  assert.deepEqual(await errorsFor({ studentId: null }), []);

  const withoutStudentId = new User({
    name: 'Sam Lee',
    email: 'sam@example.com',
    password: 'Placement2026!',
  });
  await withoutStudentId.validate();
  assert.equal(withoutStudentId.studentId, null);
});

test('User schema: defines the documented indexes', () => {
  const indexes = User.schema.indexes();
  const hasIndex = (predicate) => indexes.some(predicate);

  assert.ok(
    hasIndex(([fields, options]) => fields.email === 1 && options.unique === true),
    'email must have a unique index'
  );
  assert.ok(
    hasIndex(([fields]) => fields.role === 1),
    'role must be indexed'
  );
  assert.ok(
    hasIndex(
      ([fields, options]) =>
        fields.studentId === 1 &&
        options.unique === true &&
        options.partialFilterExpression !== undefined
    ),
    'studentId must have a partial unique index'
  );
});

test('User schema: never serializes the password', () => {
  const user = new User(VALID_USER);

  assert.equal(user.toJSON().password, undefined);
  assert.equal(user.toObject().password, undefined);
  assert.equal(user.toJSON().email, 'amina.yusuf@university.edu');
});

test('User schema: setPassword hashes once and verifyPassword compares safely', async () => {
  const user = new User(VALID_USER);

  await user.setPassword('Placement2026!');

  assert.match(user.password, /^\$2[aby]\$12\$/);
  assert.equal(await user.verifyPassword('Placement2026!'), true);
  assert.equal(await user.verifyPassword('not-the-password'), false);
});

test('User schema: pre-save hook hashes plaintext exactly once', async () => {
  const user = new User(VALID_USER);

  await User.schema.s.hooks.execPre('save', user, []);
  const firstHash = user.password;

  assert.match(firstHash, /^\$2[aby]\$12\$/);
  assert.equal(await user.verifyPassword('Placement2026!'), true);

  await User.schema.s.hooks.execPre('save', user, []);
  assert.equal(user.password, firstHash, 'an existing bcrypt hash must not be re-hashed');
});
