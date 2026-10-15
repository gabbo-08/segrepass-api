const test = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../db');
const { seedL8Plan } = require('../scripts/seed-study-plan-l8-2025-26');
const { getPlanCourses } = require('../db/repository');
const { matchStudyPlan } = require('../lib/matching');

test('seeds the official L-8 plan for both catalogue identifiers', t => {
  const db = createDatabase(':memory:');
  t.after(() => db.close());
  const plans = seedL8Plan(db);
  assert.deepEqual(plans.map(plan => plan.course_id), ['DE3', 'N46']);

  const courses = getPlanCourses(db, plans[0].id);
  const requiredCfu = courses.filter(course => course.course_type !== 'elective').reduce((total, course) => total + course.cfu, 0);
  const electiveRequirement = Math.max(...courses.filter(course => course.course_type === 'elective').map(course => course.elective_required_cfu));
  assert.equal(requiredCfu + electiveRequirement, 180);
  assert.equal(courses.find(course => course.course_name === 'Fondamenti di informatica').cfu, 12);
  assert.equal(courses.find(course => course.course_name === 'Programmazione').cfu, 11);
  assert.equal(courses.filter(course => course.course_type === 'elective').length, 4);
});

test('matches the three recorded career exams against the imported L-8 plan', t => {
  const db = createDatabase(':memory:');
  t.after(() => db.close());
  const [plan] = seedL8Plan(db);
  const result = matchStudyPlan({
    planCourses: getPlanCourses(db, plan.id),
    passedExams: [
      { materia: 'ARCHITETTURA DEI CALCOLATORI', cfu: 6, voto: 25 },
      { materia: 'FONDAMENTI DI INFORMATICA', cfu: 12, voto: 20 },
      { materia: 'ANALISI MATEMATICA I', cfu: 9, voto: 25 }
    ]
  });

  assert.equal(result.summary.passedCourses, 3);
  assert.equal(result.summary.reviewCourses, 0);
  assert.equal(result.courses.filter(course => course.status === 'passed').reduce((sum, course) => sum + course.cfu, 0), 27);
});