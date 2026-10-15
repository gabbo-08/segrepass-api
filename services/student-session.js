const { createHmac } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { getDatiCarriera } = require('../scraper/segrepass');
const { getDocentiData } = require('../scraper/docenti');
const { calcolaMetriche } = require('../lib/metriche');
const { upsertStudentProfile } = require('../db/repository');
const { extractStudentProfile } = require('./profile-extractor');
const { saveCareerSnapshot } = require('./career-snapshots');

function profileIdFromCode(codiceFiscale, secret = process.env.PROFILE_ID_SECRET || process.env.JWT_SECRET) {
  if (!secret) throw new Error('JWT_SECRET deve essere configurato.');
  return createHmac('sha256', secret)
    .update(String(codiceFiscale).trim().toUpperCase())
    .digest('hex');
}

function hasProfileSetup(profile) {
  return Boolean(profile?.course_id && profile?.course_name && profile?.cohort_year && profile?.current_course_year && profile?.channel);
}

async function createStudentSession({ codiceFiscale, password }, dependencies = {}) {
  if (typeof codiceFiscale !== 'string' || !codiceFiscale.trim() || typeof password !== 'string' || !password) {
    const error = new Error('Inserisci codice fiscale e password Segrepass.');
    error.status = 400;
    throw error;
  }

  const secret = dependencies.jwtSecret || process.env.JWT_SECRET;
  if (!secret) {
    const error = new Error('JWT_SECRET deve essere configurato.');
    error.status = 500;
    throw error;
  }

  const scraper = dependencies.getDatiCarriera || getDatiCarriera;
  const docentiScraper = dependencies.getDocentiData || getDocentiData;
  const database = dependencies.database || require('../db').db;
  const [careerResult, docentiResult] = await Promise.allSettled([
    scraper({ codiceFiscale, password }),
    docentiScraper()
  ]);
  if (careerResult.status === 'rejected') throw careerResult.reason;
  const data = careerResult.value;
  const docenti = docentiResult.status === 'fulfilled'
    ? docentiResult.value
    : { available: false, reason: docentiResult.reason?.code || 'DOCENTI_SCRAPE_FAILED', subscriptions: [], bookedExams: [] };
  const metriche = calcolaMetriche(data.tabellaEsami?.records || []);
  const profileId = profileIdFromCode(codiceFiscale, dependencies.profileSecret || secret);
  const detectedProfile = extractStudentProfile(data);
  const profile = upsertStudentProfile(database, { id: profileId, ...detectedProfile });

  const taxes = data.taxes || { available: false, reason: 'TAXES_DATA_NOT_AVAILABLE', paid: [], pending: [] };
  saveCareerSnapshot(profileId, metriche.esami, { taxes, docenti });
  const token = jwt.sign({ sub: profileId }, secret, { expiresIn: '8h' });

  return {
    token,
    expiresIn: '8h',
    profile,
    onboardingRequired: !hasProfileSetup(profile),
    metriche,
    taxesAvailable: taxes.available === true,
    docentiAvailable: docenti.available === true,
    docentiReason: docenti.available === true ? null : docenti.reason || 'DOCENTI_SCRAPE_FAILED'
  };
}

module.exports = { createStudentSession, profileIdFromCode, hasProfileSetup };