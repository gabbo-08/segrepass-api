const express = require('express');
const { createStudentSession } = require('../services/student-session');
const router  = express.Router();
router.post('/login', async (req, res) => {
  try {
    return res.json(await createStudentSession(req.body || {}));
  } catch (err) {
    const status = err.status || (err.message === 'Credenziali Segrepass non valide.' ? 401 : 502);
    return res.status(status).json({ error: err.message || 'Impossibile leggere i dati Segrepass.' });
  }
});
module.exports = router;
