const test = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase, SCHEMA_VERSION } = require('../db');
const repository = require('../db/repository');

test('creates the versioned local profile and study-plan schema', t => {
  const db = createDatabase(':memory:');
  t.after(() => db.close());

  assert.equal(db.pragma('user_version', { simple: true }), SCHEMA_VERSION);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name);
  assert.deepEqual(tables.filter(name => ['StudentProfile', 'StudyPlans', 'PlanCourses', 'SelectedElectives'].includes(name)).sort(), [
    'PlanCourses', 'SelectedElectives', 'StudentProfile', 'StudyPlans'
  ]);
});

test('upserts profile fields without persisting login credentials', t => {
  const db = createDatabase(':memory:');
  t.after(() => db.close());

  repository.upsertStudentProfile(db, { id: 'pseudonymous-id', courseId: 'DE3', cohortYear: 2025 });
  repository.updateStudentProfile(db, 'pseudonymous-id', { channel: 'A-I' });
  const updated = repository.upsertStudentProfile(db, { id: 'pseudonymous-id' });
  assert.equal(updated.course_id, 'DE3');
  assert.equal(updated.cohort_year, 2025);
  assert.equal(updated.channel, 'A-I');
  assert.equal(Object.hasOwn(updated, 'password'), false);
  assert.equal(Object.hasOwn(updated, 'codice_fiscale'), false);
});

test('stores plan courses and only permits selecting elective rows', t => {
  const db = createDatabase(':memory:');
  t.after(() => db.close());
  repository.upsertStudentProfile(db, { id: 'p1' });

  const plan = repository.saveStudyPlan(db, {
    courseId: 'DE3', cohortYear: 2025, courseName: 'Ingegneria Informatica', version: '2025.1'
  }, [
    { courseCode: 'MAT1', courseName: 'Analisi Matematica I', cfu: 9, studyYear: 1, semester: 1 },
    { courseName: 'Sistemi Multimediali', cfu: 6, studyYear: 3, semester: 2, courseType: 'elective', electiveGroup: 'free', electiveRequiredCfu: 12 }
  ]);
  const courses = repository.getPlanCourses(db, plan.id);
  assert.equal(courses.length, 2);
  repository.replaceSelectedElectives(db, 'p1', plan.id, [courses[1].id]);
  assert.deepEqual(repository.getSelectedElectiveIds(db, 'p1'), [courses[1].id]);
  assert.throws(() => repository.replaceSelectedElectives(db, 'p1', plan.id, [courses[0].id]), { status: 400 });
});