const express = require('express');
const { getDocentiSnapshot } = require('../services/career-snapshots');

const router = express.Router();

function getDocentiData(req, res) {
  const data = getDocentiSnapshot(req.user.sub);
  if (!data) {
    res.status(409).json({ code: 'CAREER_SYNC_REQUIRED', error: 'Accedi di nuovo per caricare i dati Docenti.' });
    return null;
  }
  if (!data.available) {
    const code = data.reason || 'DOCENTI_CREDENTIALS_REQUIRED';
    const messages = {
      DOCENTI_CREDENTIALS_REQUIRED: 'Accesso Docenti non configurato sul server.',
      DOCENTI_AUTH_FAILED: 'Autenticazione al portale Docenti non riuscita.',
      DOCENTI_DATA_NOT_FOUND: 'Nessun dato Docenti è stato trovato.',
      DOCENTI_SCRAPE_FAILED: 'Impossibile acquisire i dati dal portale Docenti.',
      DOCENTI_TIMEOUT: 'Il portale Docenti ha impiegato troppo tempo a rispondere.'
    };
    res.status(424).json({ code, error: messages[code] || 'Dati Docenti non disponibili.' });
    return null;
  }
  return data;
}

router.get('/subscriptions', (req, res) => {
  const data = getDocentiData(req, res);
  if (!data) return;
  return res.json({ subscriptions: data.subscriptions, retrievedAt: data.retrievedAt });
});

router.get('/booked-exams', (req, res) => {
  const data = getDocentiData(req, res);
  if (!data) return;
  return res.json({ bookedExams: data.bookedExams, retrievedAt: data.retrievedAt });
});

module.exports = router;