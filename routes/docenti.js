const express = require('express');
const router = express.Router();
const { getDocentiData } = require('../scraper/docenti');

router.get('/', async (req, res, next) => {
  try {
    const userCredentials = {
      username: req.user?.username || req.user?.codiceFiscale,
      password: req.user?.password
    };

    const data = await getDocentiData(userCredentials);
    res.json(data);
  } catch (err) {
    console.error('[Docenti Route Error]:', err);
    res.status(500).json({ 
      error: err.message || 'Errore durante il recupero dei dati dal portale Docenti.' 
    });
  }
});

module.exports = router;