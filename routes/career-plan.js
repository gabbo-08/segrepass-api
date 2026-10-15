const express = require('express');
const { db } = require('../db');
const { getStudentProfile, getStudyPlan, getPlanCourses, getSelectedElectiveIds } = require('../db/repository');
const { getCareerSnapshot } = require('../services/career-snapshots');
const { matchStudyPlan } = require('../lib/matching');

const router = express.Router();

router.get('/plan', (req, res) => {
  const profile = getStudentProfile(db, req.user.sub);
  if (!profile) return res.status(404).json({ error: 'Profilo non trovato.' });
  if (!profile.course_id || !profile.cohort_year) {
    return res.status(409).json({ code: 'PROFILE_ONBOARDING_REQUIRED', error: 'Completa corso e coorte nel profilo.' });
  }

  const passedExams = getCareerSnapshot(req.user.sub);
  if (!passedExams) {
    return res.status(409).json({ code: 'CAREER_SYNC_REQUIRED', error: 'Accedi di nuovo a Segrepass per aggiornare gli esami.' });
  }

  const plan = getStudyPlan(db, profile.course_id, profile.cohort_year);
  if (!plan) {
    return res.status(404).json({ code: 'STUDY_PLAN_NOT_AVAILABLE', error: 'Manifesto non disponibile per corso e coorte.' });
  }

  const result = matchStudyPlan({
    planCourses: getPlanCourses(db, plan.id),
    passedExams,
    selectedElectiveIds: getSelectedElectiveIds(db, req.user.sub)
  });
  return res.json({ profile, plan, ...result });
});

module.exports = router;