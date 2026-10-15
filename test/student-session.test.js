const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createDatabase } = require('../db');
const { createStudentSession } = require('../services/student-session');
const { clearCareerSnapshots, getCareerSnapshot } = require('../services/career-snapshots');

function careerData() {
  return {
    profile: { courseId: 'DE3', courseName: 'Ingegneria Informatica', cohortYear: 2025, currentCourseYear: 2 },
    tabellaEsami: { records: [{ Codice: 'MAT1', Insegnamento: 'Analisi I', CFU: '9', Valutazione: '28' }] },
    tabelleRiepilogo: []
  };
}

function noDocentiData() {
  return { available: false, reason: 'DOCENTI_CREDENTIALS_REQUIRED', subscriptions: [], bookedExams: [] };
}

test('creates a local session without storing the supplied credentials', async t => {
  const db = createDatabase(':memory:');
  t.after(() => {
    clearCareerSnapshots();
    db.close();
  });

  const session = await createStudentSession({ codiceFiscale: 'AAABBB00A00A000A', password: 'do-not-store' }, {
    database: db,
    jwtSecret: 'test-jwt-secret',
    profileSecret: 'test-profile-secret',
    getDatiCarriera: async () => careerData(),
    getDocentiData: async () => noDocentiData()
  });

  const claims = jwt.verify(session.token, 'test-jwt-secret');
  const storedProfile = db.prepare('SELECT * FROM StudentProfile WHERE id = ?').get(claims.sub);
  assert.equal(session.metriche.esami.length, 1);
  assert.equal(session.onboardingRequired, true);
  assert.equal(session.docentiAvailable, false);
  assert.equal(session.docentiReason, 'DOCENTI_CREDENTIALS_REQUIRED');
  assert.equal(getCareerSnapshot(claims.sub).length, 1);
  assert.equal(Object.hasOwn(storedProfile, 'password'), false);
  assert.equal(Object.hasOwn(storedProfile, 'codice_fiscale'), false);
});

test('reports a stable Docenti reason when the optional scraper rejects without an Error', async t => {
  const db = createDatabase(':memory:');
  t.after(() => {
    clearCareerSnapshots();
    db.close();
  });

  const session = await createStudentSession({ codiceFiscale: 'AAABBB00A00A000A', password: 'test-password' }, {
    database: db,
    jwtSecret: 'test-jwt-secret',
    profileSecret: 'test-profile-secret',
    getDatiCarriera: async () => careerData(),
    getDocentiData: async () => { throw null; }
  });

  assert.equal(session.docentiAvailable, false);
  assert.equal(session.docentiReason, 'DOCENTI_SCRAPE_FAILED');
});

test('rejects empty credentials before invoking the scraper', async () => {
  let scraperCalled = false;
  await assert.rejects(
    createStudentSession({}, { getDatiCarriera: async () => { scraperCalled = true; } }),
    { status: 400 }
  );
  assert.equal(scraperCalled, false);
});
