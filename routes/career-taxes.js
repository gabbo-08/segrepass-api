const express = require('express');
const { getTaxesSnapshot } = require('../services/career-snapshots');
const { buildTaxesSummary } = require('../lib/taxes');

const router = express.Router();

router.get('/taxes', (req, res) => {
  const taxes = getTaxesSnapshot(req.user.sub);
  if (!taxes) {
    return res.status(409).json({ code: 'CAREER_SYNC_REQUIRED', error: 'Accedi di nuovo a Segrepass per aggiornare la situazione tasse.' });
  }
  if (!taxes.available) {
    return res.status(503).json({ code: taxes.reason || 'TAXES_DATA_NOT_AVAILABLE', error: 'Situazione tasse non disponibile in questa sessione Segrepass.' });
  }

  return res.json(buildTaxesSummary(taxes));
});

module.exports = router;