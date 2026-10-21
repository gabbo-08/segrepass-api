const { db } = require('../db');

/**
  * Middleware di autenticazione basato su Token di Sessione / Bearer Token.
  */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7).trim() 
    : req.headers['x-session-token'] || req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Accesso negato: Token di sessione mancante.' });
  }

  try {
    // Verifica presenza ed esalazione della sessione nel DB
    const session = db.prepare(`
      SELECT profile_id, expires_at 
      FROM UserSessions 
      WHERE token = ?
    `).get(token);

    if (!session) {
      return res.status(401).json({ error: 'Sessione non valida o scaduta.' });
    }

    if (new Date(session.expires_at) < new Date()) {
      // Invalida la sessione scaduta dal DB
      db.prepare('DELETE FROM UserSessions WHERE token = ?').run(token);
      return res.status(401).json({ error: 'Sessione scaduta. Effettua nuovamente il login.' });
    }

    // Inietta i dati dell'utente validato nella request per i controller successivi
    req.user = {
      profileId: session.profile_id,
      token
    };

    next();
  } catch (err) {
    console.error('[Auth Middleware Error]:', err.message);
    return res.status(500).json({ error: 'Errore interno durante la verifica dell\'autenticazione.' });
  }
}

module.exports = { authMiddleware };