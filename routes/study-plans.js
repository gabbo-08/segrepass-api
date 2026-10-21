const express = require('express');
const { db } = require('../db');
const {
  getStudentProfile,
  getStudyPlan,
  getPlanCourses,
  getSelectedElectiveIds
} = require('../db/repository');

const router = express.Router();

router.get('/:courseId/:cohortYear', (req, res) => {
  const { courseId, cohortYear: rawCohort } = req.params;
  const cohortYear = Number(rawCohort);

  if (!Number.isInteger(cohortYear) || cohortYear < 1900 || cohortYear > 2200) {
    return res.status(400).json({ error: 'cohortYear non valido.' });
  }

  if (!courseId || typeof courseId !== 'string') {
    return res.status(400).json({ error: 'courseId non valido.' });
  }

  const plan = getStudyPlan(db, courseId.trim(), cohortYear);
  if (!plan) {
    return res.status(404).json({
      code: 'STUDY_PLAN_NOT_AVAILABLE',
      error: 'Manifesto non disponibile per corso e coorte.'
    });
  }

  const profile = getStudentProfile(db, req.user.sub);
  
  // Verifica se il piano richiesto appartiene alla carriera attiva dell'utente
  const isCurrentPlan =
    (profile?.course_id === plan.course_id || profile?.course_id === plan.course_code) &&
    profile?.cohort_year === plan.cohort_year;

  const selectedElectiveIds = isCurrentPlan
    ? getSelectedElectiveIds(db, req.user.sub)
    : [];

  return res.json({
    plan,
    courses: getPlanCourses(db, plan.id),
    selectedElectiveIds
  });
});

module.exports = router;