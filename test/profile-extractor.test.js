const test = require('node:test');
const assert = require('node:assert/strict');
const { extractStudentProfile } = require('../services/profile-extractor');

test('extracts course, enrollment cohort and course year from label/value summary rows', () => {
  const profile = extractStudentProfile({
    tabelleRiepilogo: [{ records: [
      { col_0: 'Codice Corso di Studio', col_1: 'DE3' },
      { col_0: 'Corso di Studio', col_1: 'Ingegneria Informatica' },
      { col_0: 'Anno Accademico di Immatricolazione', col_1: '2025/2026' },
      { col_0: 'Anno di Corso', col_1: '2' }
    ] }]
  });

  assert.deepEqual(profile, {
    courseId: 'DE3',
    courseName: 'Ingegneria Informatica',
    cohortYear: 2025,
    currentCourseYear: 2
  });
});

test('leaves absent profile details unset for onboarding instead of guessing', () => {
  assert.deepEqual(extractStudentProfile({ tabelleRiepilogo: [] }), {
    courseId: null,
    courseName: null,
    cohortYear: null,
    currentCourseYear: null
  });
});