const test = require('node:test');
const assert = require('node:assert/strict');

const Test = require('../server/src/models/Test');
const { getPlacementTest } = require('../server/src/controllers/testController');

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('getPlacementTest returns 404 when no published diagnostic exists', async () => {
  const originalFindOne = Test.findOne;
  Test.findOne = () => ({
    sort() {
      return this;
    },
    async lean() {
      return null;
    },
  });

  try {
    const response = createResponse();
    await getPlacementTest({}, response);

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, { error: 'Placement test not found' });
  } finally {
    Test.findOne = originalFindOne;
  }
});
