const express = require('express');
const { db } = require('../db');
const { getStudentProfile } = require('../db/repository');
const { getTimetable } = require('../services/easyacademy-provider');

const router = express.Router();

router.get('/', async (req, res, next) => {
  const profile = getStudentProfile(db, req.user.sub);
  if (!profile) return res.status(404).json({ error: 'Profilo non trovato.' });

  const studyYear = req.query.studyYear === undefined ? profile.current_course_year : Number(req.query.studyYear);
  const semester = req.query.semester === undefined ? null : Number(req.query.semester);
  const channel = req.query.channel === undefined ? profile.channel : String(req.query.channel).trim();
  const academicYear = req.query.academicYear === undefined ? null : String(req.query.academicYear).trim();

  if (!Number.isInteger(studyYear) || studyYear < 1 || studyYear > 20) {
    return res.status(400).json({ error: 'studyYear non valido.' });
  }
  if (semester !== null && ![1, 2].includes(semester)) {
    return res.status(400).json({ error: 'semester deve essere 1 o 2.' });
  }
  if (!channel) return res.status(409).json({ code: 'PROFILE_ONBOARDING_REQUIRED', error: 'Imposta il canale nel profilo.' });
  if (academicYear && !/^\d{4}(?:\/\d{2,4})?$/.test(academicYear)) {
    return res.status(400).json({ error: 'academicYear non valido.' });
  }

  try {
    const timetable = await getTimetable({
      courseId: profile.course_id,
      courseName: profile.course_name,
      academicYear,
      studyYear,
      semester,
      channel,
      surnameInitial: profile.surname_initial
    });
    return res.json({ filters: { academicYear, studyYear, semester, channel }, timetable });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ code: error.code, error: error.message });
    return next(error);
  }
});

module.exports = router;