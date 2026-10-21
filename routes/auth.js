const express = require('express');
const { createStudentSession } = require('../services/student-session');
const router = express.Router();

router.post('/login', async (req, res) => {
  const { codiceFiscale, password } = req.body || {};

  // Validazione preventiva senza impegnare risorse o avviare sessioni
  if (!codiceFiscale || !password) {
    return res.status(400).json({ error: 'Codice Fiscale e password sono obbligatori.' });
  }

  try {
    const session = await createStudentSession({
      codiceFiscale: String(codiceFiscale).trim(),
      password: String(password)
    });
    return res.json(session);
  } catch (err) {
    console.error('[Auth Error]:', err.message || 'Errore di autenticazione');
    const status = err.status || (err.message === 'Credenziali Segrepass non valide.' ? 401 : 502);
    return res.status(status).json({ error: err.message || 'Impossibile completare l\'autenticazione.' });
  }
});

module.exports = router;