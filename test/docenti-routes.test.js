const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const docentiRoutes = require('../routes/docenti');
const { saveCareerSnapshot, clearCareerSnapshots } = require('../services/career-snapshots');

async function withDocentiApi(t, docenti) {
  const profileId = `docenti-test-${Math.random()}`;
  if (docenti) saveCareerSnapshot(profileId, [], { docenti });

  const app = express();
  app.use('/api/docenti', (req, res, next) => {
    req.user = { sub: profileId };
    next();
  }, docentiRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    clearCareerSnapshots();
  });

  const { port } = server.address();
  return path => fetch(`http://127.0.0.1:${port}/api/docenti${path}`);
}

test('returns 409 when the session snapshot is missing', async t => {
  const request = await withDocentiApi(t, null);
  const response = await request('/subscriptions');
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.code, 'CAREER_SYNC_REQUIRED');
});

test('preserves the unavailable reason in 424 responses', async t => {
  const request = await withDocentiApi(t, {
    available: false,
    reason: 'DOCENTI_DATA_NOT_FOUND',
    subscriptions: [],
    bookedExams: []
  });
  const response = await request('/booked-exams');
  const body = await response.json();

  assert.equal(response.status, 424);
  assert.equal(body.code, 'DOCENTI_DATA_NOT_FOUND');
});

test('returns extracted subscriptions for an available snapshot', async t => {
  const request = await withDocentiApi(t, {
    available: true,
    retrievedAt: '2026-10-14T00:00:00.000Z',
    subscriptions: [{ courseName: 'Analisi I' }],
    bookedExams: []
  });
  const response = await request('/subscriptions');
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.subscriptions[0].courseName, 'Analisi I');
});
