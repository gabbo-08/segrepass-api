const express = require('express');
const { db } = require('../db');
const { getStudentProfile, getStudyPlan, getPlanCourses, getSelectedElectiveIds } = require('../db/repository');

const router = express.Router();

router.get('/:courseId/:cohortYear', (req, res) => {
  const cohortYear = Number(req.params.cohortYear);
  if (!Number.isInteger(cohortYear) || cohortYear < 1900 || cohortYear > 2200) {
    return res.status(400).json({ error: 'cohortYear non valido.' });
  }

  const plan = getStudyPlan(db, req.params.courseId, cohortYear);
  if (!plan) {
    return res.status(404).json({ code: 'STUDY_PLAN_NOT_AVAILABLE', error: 'Manifesto non disponibile per corso e coorte.' });
  }

  const profile = getStudentProfile(db, req.user.sub);
  const selectedElectiveIds = profile?.course_id === plan.course_id && profile?.cohort_year === plan.cohort_year
    ? getSelectedElectiveIds(db, req.user.sub)
    : [];

  return res.json({ plan, courses: getPlanCourses(db, plan.id), selectedElectiveIds });
});

module.exports = router;