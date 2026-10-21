const { db: defaultDb } = require('./index');

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parsePlanCourse(row) {
  if (!row) return null;
  let prerequisites = [];
  try {
    prerequisites = JSON.parse(row.prerequisites_json || '[]');
  } catch {}
  return {
    ...row,
    courseCode: row.course_code,
    courseName: row.course_name,
    studyYear: row.study_year,
    courseType: row.course_type,
    electiveGroup: row.elective_group,
    electiveRequiredCfu: row.elective_required_cfu,
    prerequisites
  };
}

// Supporta sia l'invocazione con db esplicito sia l'uso dell'istanza singleton
function resolveDb(dbOrData) {
  if (dbOrData && typeof dbOrData.prepare === 'function') {
    return dbOrData;
  }
  return defaultDb;
}

function getStudentProfile(dbOrId, optionalId) {
  const targetDb = resolveDb(dbOrId);
  const profileId = (targetDb === dbOrId) ? optionalId : dbOrId;
  return targetDb.prepare('SELECT * FROM StudentProfile WHERE id = ?').get(profileId) || null;
}

function upsertStudentProfile(dbOrProfile, optionalProfile) {
  const targetDb = resolveDb(dbOrProfile);
  const profile = (targetDb === dbOrProfile) ? optionalProfile : dbOrProfile;
  const targetId = profile.id || profile.profileId;

  targetDb.prepare(`
    INSERT INTO StudentProfile (id, course_id, course_name, cohort_year, current_course_year, channel, surname_initial)
    VALUES (@id, @courseId, @courseName, @cohortYear, @currentCourseYear, @channel, @surnameInitial)
    ON CONFLICT(id) DO UPDATE SET
      course_id = COALESCE(excluded.course_id, StudentProfile.course_id),
      course_name = COALESCE(excluded.course_name, StudentProfile.course_name),
      cohort_year = COALESCE(excluded.cohort_year, StudentProfile.cohort_year),
      current_course_year = COALESCE(excluded.current_course_year, StudentProfile.current_course_year),
      channel = COALESCE(excluded.channel, StudentProfile.channel),
      surname_initial = COALESCE(excluded.surname_initial, StudentProfile.surname_initial),
      updated_at = CURRENT_TIMESTAMP
  `).run({
    id: targetId,
    courseId: profile.courseId || profile.anagrafica?.codiceCorso || null,
    courseName: profile.courseName || profile.anagrafica?.corsoDiLaurea || null,
    cohortYear: profile.cohortYear || profile.anagrafica?.annoImmatricolazione || null,
    currentCourseYear: profile.currentCourseYear || profile.anagrafica?.annoCorso || null,
    channel: profile.channel || null,
    surnameInitial: profile.surnameInitial || null
  });

  return getStudentProfile(targetDb, targetId);
}

function updateStudentProfile(dbOrId, profileIdOrUpdates, optionalUpdates) {
  const targetDb = resolveDb(dbOrId);
  const profileId = (targetDb === dbOrId) ? profileIdOrUpdates : dbOrId;
  const updates = (targetDb === dbOrId) ? optionalUpdates : profileIdOrUpdates;

  const columns = {
    courseId: 'course_id',
    courseName: 'course_name',
    cohortYear: 'cohort_year',
    currentCourseYear: 'current_course_year',
    channel: 'channel',
    surnameInitial: 'surname_initial'
  };
  const entries = Object.entries(columns).filter(([key]) => Object.hasOwn(updates || {}, key));
  if (entries.length === 0) return getStudentProfile(targetDb, profileId);

  const assignments = entries.map(([, column]) => `${column} = @${column}`).join(', ');
  const values = Object.fromEntries(entries.map(([key, column]) => [column, updates[key] ?? null]));
  
  targetDb.prepare(`UPDATE StudentProfile SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`)
    .run({ ...values, id: profileId });

  return getStudentProfile(targetDb, profileId);
}

function saveStudyPlan(dbOrPlan, planOrCourses, optionalCourses) {
  const targetDb = resolveDb(dbOrPlan);
  const plan = (targetDb === dbOrPlan) ? planOrCourses : dbOrPlan;
  const courses = (targetDb === dbOrPlan) ? optionalCourses : planOrCourses;

  const save = targetDb.transaction(() => {
    targetDb.prepare(`
      INSERT INTO StudyPlans (course_id, cohort_year, course_name, version, source_name, source_url)
      VALUES (@courseId, @cohortYear, @courseName, @version, @sourceName, @sourceUrl)
      ON CONFLICT(course_id, cohort_year, version) DO UPDATE SET
        course_name = excluded.course_name,
        source_name = excluded.source_name,
        source_url = excluded.source_url,
        imported_at = CURRENT_TIMESTAMP
    `).run({
      courseId: plan.courseId,
      cohortYear: plan.cohortYear,
      courseName: plan.courseName,
      version: String(plan.version || '1'),
      sourceName: plan.sourceName || null,
      sourceUrl: plan.sourceUrl || null
    });

    const storedPlan = targetDb.prepare(`
      SELECT * FROM StudyPlans
      WHERE course_id = ? AND cohort_year = ? AND version = ?
    `).get(plan.courseId, plan.cohortYear, String(plan.version || '1'));

    targetDb.prepare('DELETE FROM PlanCourses WHERE plan_id = ?').run(storedPlan.id);
    const insertCourse = targetDb.prepare(`
      INSERT INTO PlanCourses (
        plan_id, course_code, course_name, normalized_name, cfu, study_year, semester,
        course_type, elective_group, elective_required_cfu, prerequisites_json
      ) VALUES (
        @planId, @courseCode, @courseName, @normalizedName, @cfu, @studyYear, @semester,
        @courseType, @electiveGroup, @electiveRequiredCfu, @prerequisitesJson
      )
    `);

    for (const course of (courses || [])) {
      insertCourse.run({
        planId: storedPlan.id,
        courseCode: course.courseCode || null,
        courseName: course.courseName,
        normalizedName: normalizeName(course.courseName),
        cfu: course.cfu,
        studyYear: course.studyYear ?? null,
        semester: course.semester ?? null,
        courseType: course.courseType || 'mandatory',
        electiveGroup: course.electiveGroup || null,
        electiveRequiredCfu: course.electiveRequiredCfu ?? null,
        prerequisitesJson: JSON.stringify(course.prerequisites || [])
      });
    }

    return storedPlan;
  });

  return save();
}

function getStudyPlan(dbOrCourse, courseOrCohort, optionalCohort) {
  const targetDb = resolveDb(dbOrCourse);
  const courseIdOrName = (targetDb === dbOrCourse) ? courseOrCohort : dbOrCourse;
  const cohortYear = (targetDb === dbOrCourse) ? optionalCohort : courseOrCohort;

  if (!courseIdOrName || !cohortYear) return null;

  let plan = targetDb.prepare(`
    SELECT * FROM StudyPlans
    WHERE course_id = ? AND cohort_year = ?
    ORDER BY imported_at DESC, id DESC
    LIMIT 1
  `).get(courseIdOrName, cohortYear);

  if (plan) return plan;

  const searchNormalized = normalizeName(courseIdOrName);
  return targetDb.prepare(`
    SELECT * FROM StudyPlans
    WHERE LOWER(REPLACE(course_name, ' ', '')) LIKE '%' || REPLACE(?, ' ', '') || '%'
      AND cohort_year = ?
    ORDER BY imported_at DESC, id DESC
    LIMIT 1
  `).get(searchNormalized, cohortYear) || null;
}

function getPlanCourses(dbOrPlanId, optionalPlanId) {
  const targetDb = resolveDb(dbOrPlanId);
  const planId = (targetDb === dbOrPlanId) ? optionalPlanId : dbOrPlanId;

  return targetDb.prepare(`
    SELECT * FROM PlanCourses WHERE plan_id = ?
    ORDER BY study_year IS NULL, study_year, semester IS NULL, semester, course_name
  `).all(planId).map(parsePlanCourse);
}

function getSelectedElectiveIds(dbOrProfileId, optionalProfileId) {
  const targetDb = resolveDb(dbOrProfileId);
  const profileId = (targetDb === dbOrProfileId) ? optionalProfileId : dbOrProfileId;

  return targetDb.prepare('SELECT plan_course_id FROM SelectedElectives WHERE profile_id = ?')
    .all(profileId).map(row => row.plan_course_id);
}

function replaceSelectedElectives(dbOrProfileId, profileIdOrPlanId, planIdOrCourseIds, optionalCourseIds) {
  const targetDb = resolveDb(dbOrProfileId);
  const profileId = (targetDb === dbOrProfileId) ? profileIdOrPlanId : dbOrProfileId;
  const planId = (targetDb === dbOrProfileId) ? planIdOrCourseIds : profileIdOrPlanId;
  const courseIds = (targetDb === dbOrProfileId) ? optionalCourseIds : planIdOrCourseIds;

  const uniqueIds = [...new Set(courseIds || [])];
  if (uniqueIds.length > 0) {
    const placeholders = uniqueIds.map(() => '?').join(', ');
    const valid = targetDb.prepare(`
      SELECT COUNT(*) AS count FROM PlanCourses
      WHERE plan_id = ? AND course_type = 'elective' AND id IN (${placeholders})
    `).get(planId, ...uniqueIds).count;

    if (valid !== uniqueIds.length) {
      const error = new Error('Una o più scelte non appartengono al piano o non sono esami a scelta.');
      error.status = 400;
      throw error;
    }
  }

  const replace = targetDb.transaction(() => {
    targetDb.prepare('DELETE FROM SelectedElectives WHERE profile_id = ?').run(profileId);
    const insert = targetDb.prepare('INSERT INTO SelectedElectives (profile_id, plan_course_id) VALUES (?, ?)');
    for (const courseId of uniqueIds) insert.run(profileId, courseId);
  });

  replace();
  return uniqueIds;
}

function clearSelectedElectives(dbOrProfileId, optionalProfileId) {
  const targetDb = resolveDb(dbOrProfileId);
  const profileId = (targetDb === dbOrProfileId) ? optionalProfileId : dbOrProfileId;
  targetDb.prepare('DELETE FROM SelectedElectives WHERE profile_id = ?').run(profileId);
}

module.exports = {
  normalizeName,
  getStudentProfile,
  upsertStudentProfile,
  updateStudentProfile,
  saveStudyPlan,
  getStudyPlan,
  getPlanCourses,
  getSelectedElectiveIds,
  replaceSelectedElectives,
  clearSelectedElectives
};