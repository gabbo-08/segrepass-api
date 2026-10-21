const express = require('express');
const { createStudentSession } = require('../services/student-session');

const router = express.Router();

router.post('/', async (req, res) => {
  const { codiceFiscale, password } = req.body || {};

  if (!codiceFiscale || !password) {
    return res.status(400).json({ error: 'Credenziali di sessione incomplete.' });
  }

  try {
    const session = await createStudentSession({
      codiceFiscale: String(codiceFiscale).trim(),
      password: String(password)
    });
    return res.json(session);
  } catch (error) {
    console.error('[Session Error]:', error.message || 'Errore di sessione');
    const status = error.status || (error.message === 'Credenziali Segrepass non valide.' ? 401 : 502);
    return res.status(status).json({ error: error.message || 'Impossibile aprire la sessione Segrepass.' });
  }
});

module.exports = router;