const crypto = require('crypto');
const { getDatiCarriera } = require('../scraper/segrepass');
const { getDocentiData } = require('../scraper/docenti');
const { buildStudentProfile } = require('./profile-extractor');
const snapshots = require('./career-snapshots');
const dbModule = require('../db');
const { upsertStudentProfile } = require('../db/repository');

// Garantisce che db faccia riferimento all'istanza attiva di Database
const db = dbModule.db || dbModule;

const SESSION_DAYS = 30;

const EMPTY_DOCENTI = Object.freeze({
  subscriptions: [],
  bookedExams: [],
  announcements: []
});

function loadDocentiInBackground(profileId, credentials = {}) {
  snapshots.markDocentiLoading(profileId);

  getDocentiData({
    username: credentials.username || profileId,
    password: credentials.password
  })
    .then(data => snapshots.setDocentiSnapshot(profileId, data))
    .catch(error => {
      console.warn(`[docenti] Acquisizione per ${profileId} non riuscita: ${error.message}`);
      snapshots.setDocentiSnapshot(profileId, {
        available: false,
        reason: error.code || 'DOCENTI_SCRAPE_FAILED',
        ...EMPTY_DOCENTI
      });
    })
    .finally(() => snapshots.clearDocentiLoading(profileId));
}

function listPlansForCohort(cohortYear) {
  for (const columns of ['course_id, course_code, course_name', 'course_id, course_name']) {
    try {
      return db.prepare(`SELECT ${columns} FROM StudyPlans WHERE cohort_year = ?`).all(cohortYear);
    } catch {}
  }
  return [];
}

async function createStudentSession({ codiceFiscale, password } = {}) {
  if (!codiceFiscale || !password) {
    throw new Error('Inserisci codice fiscale e password.');
  }

  const cfClean = String(codiceFiscale).trim().toUpperCase();

  // 1. Scraping sincrono da Segrepass
  const datiCarriera = await getDatiCarriera({ codiceFiscale: cfClean, password });
  const profile = buildStudentProfile(datiCarriera);
  const profileId = profile.codiceFiscale || cfClean;

  // 2. Salvataggio o aggiornamento del profilo nel DB
  upsertStudentProfile({
    profileId,
    codiceFiscale: cfClean,
    anagrafica: profile.anagrafica,
    carriera: profile.carriera,
    esamiSostenuti: profile.esamiSostenuti,
    tasse: profile.tasse
  });

  // 3. Generazione Token di Sessione
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO UserSessions (token, profile_id, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(token) DO UPDATE SET expires_at = excluded.expires_at
  `).run(sessionToken, profileId, expiresAt);

  // 4. Caricamento asincrono portale Docenti
  loadDocentiInBackground(profileId, { username: cfClean, password });

  return {
    token: sessionToken,
    expiresAt,
    profileId,
    profile
  };
}

module.exports = {
  createStudentSession,
  loadDocentiInBackground,
  listPlansForCohort
};