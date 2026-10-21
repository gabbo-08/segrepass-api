const { normalizeName } = require('../db/repository');

// Solo DE3 e' verificato (compare cosi' sul portale Docenti: "DE3 INGEGNERIA INFORMATICA").
// Per gli altri corsi si usa il codice letto da Segrepass oppure il nome normalizzato:
// i codici DE1, DE2, DE4 e DE5 della versione precedente erano inventati e sono stati tolti.
const COURSE_CODE_MAP = {
  'INGEGNERIA INFORMATICA': 'DE3'
};

// ATTENZIONE: solo "A-D" e' confermato dal tuo profilo. Gli altri intervalli sono un'ipotesi:
// confrontali con i canali che mostra EasyAcademy per il tuo corso.
const DEFAULT_CANALI = [
  { da: 'A', a: 'D', canale: 'A-D' },
  { da: 'E', a: 'O', canale: 'E-O' },
  { da: 'P', a: 'Z', canale: 'P-Z' }
];

const MAX_COURSE_YEARS = 3;

/**
 * Anno di inizio dell'anno accademico in corso (l'anno accademico parte a settembre)
 */
function currentAcademicStart(now = new Date()) {
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Anno di corso dalla coorte, tenendo conto che l'anno accademico parte a settembre
 * (con il calcolo sull'anno solare, a gennaio un iscritto del 2025 risultava gia' al 2° anno)
 */
function calculateCourseYear(cohortYear, maxYears = MAX_COURSE_YEARS, now = new Date()) {
  if (!cohortYear) return 1;
  const year = currentAcademicStart(now) - Number(cohortYear) + 1;
  return Math.min(Math.max(year, 1), maxYears);
}

/**
 * Canale dall'iniziale del cognome; null se il cognome non c'e' (nessun valore di ripiego)
 */
function determinaCanale(cognome, regole = DEFAULT_CANALI) {
  const initial = String(cognome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .charAt(0)
    .toUpperCase();
  if (!initial) return null;
  const rule = regole.find(item => initial >= item.da && initial <= item.a);
  return rule ? rule.canale : null;
}

/**
 * Una coorte e' plausibile se non e' nel futuro e non e' di oltre 8 anni fa
 */
function sanitizeCohort(value, now = new Date()) {
  const year = Number(value);
  if (!Number.isInteger(year)) return null;
  const start = currentAcademicStart(now);
  return year >= start - 8 && year <= start ? year : null;
}

/**
 * Stima della coorte dal primo anno accademico che compare nei versamenti
 * (es. "2025/2026"): la prima tassa si paga all'immatricolazione.
 */
function inferCohortFromTaxes(taxes, now = new Date()) {
  const items = [...(taxes?.paid || []), ...(taxes?.pending || [])];
  const years = [];
  for (const item of items) {
    const text = typeof item === 'string' ? item : JSON.stringify(item);
    for (const match of text.matchAll(/(20\d{2})\s*\/\s*(?:20)?\d{2}/g)) {
      years.push(Number(match[1]));
    }
  }
  const valid = years.map(year => sanitizeCohort(year, now)).filter(Boolean);
  return valid.length ? Math.min(...valid) : null;
}

function cohortFromCourseYear(courseYear, now = new Date()) {
  const year = Number(courseYear);
  if (!Number.isInteger(year) || year < 1 || year > MAX_COURSE_YEARS) return null;
  return sanitizeCohort(currentAcademicStart(now) - year + 1, now);
}

/**
 * Maiuscolo, senza accenti, solo lettere e cifre separate da uno spazio
 */
function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * Tra i piani del database (listPlans(cohortYear) -> [{ course_id, course_code, course_name }]) cerca
 * quello del corso. Corrispondenza esatta di nome o codice prima; se resta un solo candidato lo usa,
 * se sono piu' d'uno non indovina (es. triennale e magistrale con nomi simili).
 */
function findPlanByName(courseName, codes, cohortYear, listPlans, findPlan) {
  const target = normalizeText(courseName);
  if (!target || typeof listPlans !== 'function') return null;
  const wantedCodes = new Set(codes.map(normalizeText).filter(Boolean));

  const plans = listPlans(cohortYear) || [];
  const exact = [];
  const partial = [];
  for (const plan of plans) {
    const name = normalizeText(plan.course_name);
    const planCodes = [plan.course_code, plan.course_id].map(normalizeText).filter(Boolean);
    if (name === target || planCodes.some(code => wantedCodes.has(code))) exact.push(plan);
    else if (name.length >= 8 && (name.includes(target) || target.includes(name))) partial.push(plan);
  }
  const pool = exact.length ? exact : partial;
  if (pool.length !== 1) return null;
  const chosen = String(pool[0].course_id);
  return findPlan(chosen, cohortYear) ? chosen : null;
}

/**
 * Costruisce il profilo dai dati letti su Segrepass.
 *  - nessun valore inventato: se un dato non si ricava resta null (e la UI lo chiede una volta sola);
 *  - coorte: dato esplicito di Segrepass > profilo gia' salvato > stima dai versamenti > anno di corso;
 *  - corso: si prova ogni candidato (codice, nome) contro i manifesti presenti nel database con
 *    findPlan(courseId, cohortYear); se nessuno coincide si cerca per nome tra i piani (listPlans),
 *    cosi' "scritto diversamente" non rompe piu' la ricerca e un id sbagliato salvato si corregge da solo;
 *  - canale: se il profilo ne ha gia' uno (anche impostato a mano) resta quello.
 *
 * existing: profilo gia' salvato (colonne snake_case); findPlan: (courseId, cohortYear) => piano | null
 */
function buildStudentProfile(anagrafica = {}, { taxes = null, existing = null, findPlan = null, listPlans = null, now = new Date() } = {}) {
  // Maiuscolo e spazi singoli: "Ingegneria  Informatica" e "INGEGNERIA INFORMATICA" sono lo stesso corso
  const courseName = (anagrafica.corsoDiLaurea ? String(anagrafica.corsoDiLaurea).replace(/\s+/g, ' ').trim().toUpperCase() : null)
    || existing?.course_name
    || null;

  const cohortYear = sanitizeCohort(anagrafica.annoImmatricolazione, now)
    ?? sanitizeCohort(existing?.cohort_year, now)
    ?? inferCohortFromTaxes(taxes, now)
    ?? cohortFromCourseYear(anagrafica.annoCorso, now);

  const normalized = courseName && typeof normalizeName === 'function' ? normalizeName(courseName) : courseName;
  const candidates = [...new Set(
    [
      anagrafica.codiceCorso,
      existing?.course_id,
      courseName && COURSE_CODE_MAP[courseName],
      normalized,
      courseName
    ]
      .filter(Boolean)
      .flatMap(value => [String(value).trim(), String(value).trim().toUpperCase()])
  )];

  let courseId = null;
  if (typeof findPlan === 'function' && cohortYear) {
    for (const candidate of candidates) {
      const plan = findPlan(candidate, cohortYear);
      if (plan) {
        courseId = String(plan.course_id ?? candidate);
        break;
      }
    }
  }
  // Nessun candidato coincide con un manifesto: si cerca per nome tra i piani presenti nel database
  if (!courseId && typeof findPlan === 'function' && cohortYear && courseName) {
    courseId = findPlanByName(courseName, [anagrafica.codiceCorso, existing?.course_id].filter(Boolean), cohortYear, listPlans, findPlan);
  }
  courseId = courseId ?? existing?.course_id ?? candidates[0] ?? null;

  const surname = anagrafica.cognome ? String(anagrafica.cognome).trim().toUpperCase() : '';
  const surnameInitial = surname.charAt(0) || existing?.surname_initial || null;
  const channel = existing?.channel || determinaCanale(surname || existing?.surname_initial);

  const currentCourseYear = cohortYear
    ? calculateCourseYear(cohortYear, MAX_COURSE_YEARS, now)
    : (existing?.current_course_year ?? null);

  return { courseId, courseName, cohortYear, currentCourseYear, channel, surnameInitial };
}

/**
 * Compatibilita' con il vecchio nome: stesso risultato, ma senza valori inventati
 */
function extractStudentProfile(anagrafica = {}, options = {}) {
  return buildStudentProfile(anagrafica, options);
}

module.exports = {
  calculateCourseYear,
  determinaCanale,
  extractStudentProfile,
  buildStudentProfile,
  inferCohortFromTaxes,
  findPlanByName
};