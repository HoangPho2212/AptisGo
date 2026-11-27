const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const { once } = require('node:events');

const { summarizeLatencies } = require('./support/latencyStats');

const SECRET = 'submission-latency-profile-secret-at-least-32';
process.env.JWT_SECRET = SECRET;

const { connectDatabase, disconnectDatabase } = require('../server/src/config/database');
const Test = require('../server/src/models/Test');
const Submission = require('../server/src/models/Submission');
const app = require('../server/src/app');
const { signAccessToken } = require('../server/src/utils/jwt');

const testUri = process.env.MONGODB_TEST_URI;
const skipReason = testUri ? false : 'MONGODB_TEST_URI is not set';
const STUDENT_ID = '507f1f77bcf86cd7994390f1';
const NFR01_LIMIT_MS = 500;
const WARMUP_REQUESTS = 5;

function positiveInt(value, fallback) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const SEQUENTIAL_REQUESTS = positiveInt(process.env.PROFILE_REQUESTS, 40);
const CONCURRENT_VUS = positiveInt(process.env.PROFILE_VUS, 5);
const CONCURRENT_ITERATIONS = positiveInt(process.env.PROFILE_ITERATIONS, 8);

function mixedQuestions() {
  return [
    {
      skill: 'core',
      part: 1,
      questionType: 'mcq_single',
      prompt: 'Choose the correct verb.',
      options: ['go', 'goes', 'going'],
      correctAnswer: 'goes',
    },
    {
      skill: 'core',
      part: 1,
      questionType: 'mcq_single',
      prompt: 'Choose the correct tense.',
      options: ['have', 'had', 'will have'],
      correctAnswer: 'had',
    },
    {
      skill: 'reading',
      part: 1,
      questionType: 'dropdown_cloze',
      prompt: 'Complete the notice.',
      dropdownSets: [
        {
          prompt: 'The library ___ at 6 p.m.',
          options: ['close', 'closes'],
          correctAnswer: 'closes',
        },
        {
          prompt: 'It is open ___ Saturdays.',
          options: ['at', 'on'],
          correctAnswer: 'on',
        },
      ],
    },
    {
      skill: 'listening',
      part: 1,
      questionType: 'mcq_single',
      prompt: 'Where does the conversation happen?',
      options: ['At a bank', 'At a pharmacy', 'At a train station'],
      correctAnswer: 'At a train station',
    },
    {
      skill: 'writing',
      part: 2,
      questionType: 'essay_text',
      prompt: 'Write a notice for the club.',
    },
    {
      skill: 'speaking',
      part: 1,
      questionType: 'audio_record',
      prompt: 'Introduce yourself.',
    },
  ];
}

function formatSummary(summary) {
  return [
    `min=${summary.min.toFixed(1)}ms`,
    `p50=${summary.p50.toFixed(1)}ms`,
    `p90=${summary.p90.toFixed(1)}ms`,
    `p95=${summary.p95.toFixed(1)}ms`,
    `p99=${summary.p99.toFixed(1)}ms`,
    `max=${summary.max.toFixed(1)}ms`,
    `mean=${summary.mean.toFixed(1)}ms`,
  ].join(' ');
}

function describeEnvironment() {
  const cpu = os.cpus()[0]?.model ?? 'unknown CPU';

  return [
    `node ${process.version}`,
    `${process.platform} ${process.arch}`,
    cpu,
    `${os.cpus().length} cores`,
    `${Math.round(os.totalmem() / 1073741824)} GB RAM`,
  ].join(' | ');
}

test(
  'POST /api/submissions p95 latency stays under the 500 ms NFR01 benchmark',
  { skip: skipReason },
  async (t) => {
    const stamp = Date.now();
    const title = `latency-profile-${stamp}`;

    await connectDatabase({
      uri: testUri,
      options: { maxPoolSize: CONCURRENT_VUS, minPoolSize: 0 },
    });
    await Test.init();
    await Submission.init();

    const seededTest = await Test.create({
      title,
      type: 'mock',
      targetCefr: 'B2',
      skillModules: ['core', 'reading', 'listening', 'writing', 'speaking'],
      durationMinutes: 120,
      questions: mixedQuestions(),
    });

    const [coreOne, coreTwo, dropdown, listening, essay, audio] = seededTest.questions;
    const [setOne, setTwo] = dropdown.dropdownSets;
    const answers = [
      { questionId: coreOne._id.toString(), submittedAnswer: 1 },
      { questionId: coreTwo._id.toString(), submittedAnswer: 0 },
      {
        questionId: dropdown._id.toString(),
        submittedAnswer: {
          [setOne._id.toString()]: 1,
          [setTwo._id.toString()]: 0,
        },
      },
      { questionId: listening._id.toString(), submittedAnswer: 2 },
      {
        questionId: essay._id.toString(),
        submittedAnswer: 'Dear Sir, I am writing to apply for the summer course.',
      },
      { questionId: audio._id.toString(), submittedAnswer: null },
    ];
    const payload = { testId: seededTest._id.toString(), answers };

    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    const token = signAccessToken({ _id: STUDENT_ID, role: 'student' }, { secret: SECRET });

    const originalFindOne = Test.findOne;
    let findOneCalls = 0;

    Test.findOne = function countedFindOne(...args) {
      findOneCalls += 1;
      return originalFindOne.apply(this, args);
    };

    t.after(async () => {
      Test.findOne = originalFindOne;
      await Submission.deleteMany({ student: STUDENT_ID });
      await Test.deleteMany({ title });
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await disconnectDatabase();
    });

    async function postOnce() {
      const started = performance.now();
      const response = await fetch(`${baseUrl}/api/submissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      const elapsedMs = performance.now() - started;

      return { status: response.status, body, elapsedMs };
    }

    for (let index = 0; index < WARMUP_REQUESTS; index += 1) {
      const warmup = await postOnce();

      assert.equal(warmup.status, 201, 'warm-up request must succeed');
    }

    findOneCalls = 0;
    const sequential = [];

    for (let index = 0; index < SEQUENTIAL_REQUESTS; index += 1) {
      const result = await postOnce();

      assert.equal(result.status, 201, `sequential request ${index + 1} must return 201`);
      assert.equal(result.body.status, 'pending_review');
      assert.equal(
        JSON.stringify(result.body).includes('correctAnswer'),
        false,
        'the response must not leak answer keys'
      );
      sequential.push(result.elapsedMs);
    }

    const sequentialFindOneCalls = findOneCalls;
    findOneCalls = 0;
    const concurrent = [];

    await Promise.all(
      Array.from({ length: CONCURRENT_VUS }, async () => {
        for (let index = 0; index < CONCURRENT_ITERATIONS; index += 1) {
          const result = await postOnce();

          assert.equal(result.status, 201, 'concurrent request must return 201');
          concurrent.push(result.elapsedMs);
        }
      })
    );

    const sequentialStats = summarizeLatencies(sequential);
    const concurrentStats = summarizeLatencies(concurrent);

    t.diagnostic(`environment: ${describeEnvironment()}`);
    t.diagnostic(
      'workload: 6-question mixed paper; every request verifies JWT, reads one published Test, marks, and inserts one Submission'
    );
    t.diagnostic(
      `sequential (1 VU, n=${sequentialStats.count}): ${formatSummary(sequentialStats)}`
    );
    t.diagnostic(
      `concurrent (${CONCURRENT_VUS} VUs x ${CONCURRENT_ITERATIONS}, n=${concurrentStats.count}): ${formatSummary(concurrentStats)}`
    );
    t.diagnostic(
      `attribution: ${sequentialFindOneCalls} Test.findOne calls for ${sequential.length} sequential requests, ${findOneCalls} for ${concurrent.length} concurrent requests`
    );
    t.diagnostic(
      `gate: NFR01 p95 < ${NFR01_LIMIT_MS}ms (sequential ${sequentialStats.p95.toFixed(1)}ms, concurrent ${concurrentStats.p95.toFixed(1)}ms), errors 0`
    );

    assert.equal(
      sequentialFindOneCalls,
      sequential.length,
      'one Test.findOne per sequential request'
    );
    assert.equal(findOneCalls, concurrent.length, 'one Test.findOne per concurrent request');
    assert.ok(
      sequentialStats.p95 < NFR01_LIMIT_MS,
      `sequential p95 was ${sequentialStats.p95.toFixed(1)}ms, expected <${NFR01_LIMIT_MS}ms`
    );
    assert.ok(
      concurrentStats.p95 < NFR01_LIMIT_MS,
      `concurrent p95 was ${concurrentStats.p95.toFixed(1)}ms, expected <${NFR01_LIMIT_MS}ms`
    );
  }
);
