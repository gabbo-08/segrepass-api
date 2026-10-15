const express = require('express');
const { createStudentSession } = require('../services/student-session');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const session = await createStudentSession(req.body || {});
    return res.json(session);
  } catch (error) {
    const status = error.status || (error.message === 'Credenziali Segrepass non valide.' ? 401 : 502);
    return res.status(status).json({ error: error.message || 'Impossibile aprire la sessione Segrepass.' });
  }
});

module.exports = router;