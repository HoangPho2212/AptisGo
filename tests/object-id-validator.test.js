const test = require('node:test');
const assert = require('node:assert/strict');

const Test = require('../server/src/models/Test');
const { OBJECT_ID_PATTERN, isObjectId } = require('../server/src/validators/objectIdValidator');

const VALID_ID = '507f1f77bcf86cd799439011';

test('isObjectId accepts only 24-character hexadecimal strings', () => {
  assert.equal(isObjectId(VALID_ID), true);
  assert.equal(isObjectId('507F1F77BCF86CD799439011'), true);
  assert.equal(isObjectId(new Test.base.Types.ObjectId().toString()), true);
  assert.ok(OBJECT_ID_PATTERN.test(VALID_ID));
});

test('isObjectId rejects the non-string forms Mongoose still accepts', () => {
  for (const value of [
    '507f1f77bcf86cd79943901',
    '507f1f77bcf86cd7994390111',
    '507f1f77bcf86cd79943901z',
    'abcdefghijkl',
    ' 507f1f77bcf86cd799439011',
    '507f1f77bcf86cd799439011 ',
    '',
    null,
    undefined,
    42,
    new Test.base.Types.ObjectId(),
    Buffer.alloc(12),
    new Uint8Array(12),
    { toString: () => VALID_ID },
  ]) {
    assert.equal(isObjectId(value), false, `${String(value)} must be rejected`);
  }

  assert.equal(
    Test.base.isValidObjectId(new Test.base.Types.ObjectId()),
    true,
    'Mongoose accepts instances, buffers, and strings; this route accepts one form'
  );
  assert.equal(Test.base.isValidObjectId(Buffer.alloc(12)), true);
});
