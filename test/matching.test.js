const test = require('node:test');
const assert = require('node:assert/strict');
const { matchStudyPlan, nameSimilarity } = require('../lib/matching');

test('normalizes accents and Roman numerals for course names', () => {
  assert.equal(nameSimilarity('Analisi Matematica II', 'Analisi Matematica 2'), 1);
  assert.equal(nameSimilarity('Geometria e Algebra', 'Geometría ed Algebra'), 1);
});

test('matches by code before comparing the course name', () => {
  const result = matchStudyPlan({
    planCourses: [{ id: 1, courseCode: 'MAT02', courseName: 'Analisi II', cfu: 9, courseType: 'mandatory' }],
    passedExams: [{ codice: 'MAT02', materia: 'Nome abbreviato', cfu: 9 }]
  });
  assert.equal(result.courses[0].status, 'passed');
  assert.equal(result.courses[0].matchMethod, 'course_code');
});

test('uses fuzzy matching only when a course code is missing', () => {
  const result = matchStudyPlan({
    planCourses: [{ id: 1, courseName: 'Analisi Matematica II', cfu: 9, courseType: 'mandatory' }],
    passedExams: [{ materia: 'Analisi Matematica 2', cfu: 9 }]
  });
  assert.equal(result.courses[0].status, 'passed');
  assert.equal(result.courses[0].matchMethod, 'fuzzy_name');
});

test('marks close fuzzy candidates and credit mismatches for review', () => {
  const ambiguous = matchStudyPlan({
    planCourses: [{ id: 1, courseName: 'Analisi Matematica II', cfu: 9, courseType: 'mandatory' }],
    passedExams: [
      { materia: 'Analisi Matematica 2', cfu: 9 },
      { materia: 'Analisi Matematica II', cfu: 9 }
    ]
  });
  assert.equal(ambiguous.courses[0].status, 'needs_review');

  const creditMismatch = matchStudyPlan({
    planCourses: [{ id: 1, courseName: 'Analisi Matematica II', cfu: 9, courseType: 'mandatory' }],
    passedExams: [{ materia: 'Analisi Matematica II', cfu: 6 }]
  });
  assert.equal(creditMismatch.courses[0].status, 'needs_review');
});

test('does not mark every optional course as mandatory', () => {
  const result = matchStudyPlan({
    planCourses: [
      { id: 1, courseName: 'Sistemi multimediali', cfu: 6, courseType: 'elective', electiveGroup: 'free', electiveRequiredCfu: 12 },
      { id: 2, courseName: 'Intelligenza artificiale', cfu: 6, courseType: 'elective', electiveGroup: 'free', electiveRequiredCfu: 12 }
    ]
  });
  assert.equal(result.courses.every(course => course.status === 'elective_available'), true);
  assert.equal(result.summary.mandatoryMissingCfu, 0);
  assert.equal(result.electiveGroups[0].remainingCfu, 12);
});