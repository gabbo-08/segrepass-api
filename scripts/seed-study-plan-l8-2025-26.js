const { db: defaultDb } = require('../db');
const { saveStudyPlan } = require('../db/repository');

const SOURCE_URL = 'https://ingegneria-informatica.dieti.unina.it/images/files/GuideL-LM/Guida_LT_IngInf_2025-26_ITA_05122025.pdf';
const VERSION = '2025-26';

const COURSES = [
  { courseName: 'Analisi matematica I', cfu: 9, studyYear: 1, semester: 1, prerequisites: [] },
  { courseName: 'Geometria e algebra', cfu: 6, studyYear: 1, semester: 1, prerequisites: [] },
  { courseName: 'Fondamenti di informatica', cfu: 12, studyYear: 1, semester: 1, prerequisites: [] },
  { courseName: 'Architettura dei Calcolatori', cfu: 6, studyYear: 1, semester: 2, prerequisites: [] },
  { courseName: 'Fisica generale I', cfu: 6, studyYear: 1, semester: 2, prerequisites: [] },
  { courseName: 'Analisi matematica II', cfu: 9, studyYear: 1, semester: 2, prerequisites: ['Analisi matematica I'] },
  { courseName: 'Lingua inglese', cfu: 3, studyYear: 1, semester: 2, prerequisites: [], courseType: 'other' },

  { courseName: 'Fisica generale II', cfu: 6, studyYear: 2, semester: 1, prerequisites: ['Fisica generale I'] },
  { courseName: 'Programmazione', cfu: 11, studyYear: 2, semester: 1, prerequisites: [] },
  { courseName: 'Teoria dei segnali', cfu: 6, studyYear: 2, semester: 1, prerequisites: ['Analisi matematica I'] },
  { courseName: 'Elettrotecnica', cfu: 9, studyYear: 2, semester: 2, prerequisites: ['Analisi matematica II'] },
  { courseName: 'Fondamenti di sistemi dinamici', cfu: 9, studyYear: 2, semester: 2, prerequisites: ['Fisica generale II'] },
  { courseName: 'Basi di dati', cfu: 6, studyYear: 2, semester: 2, prerequisites: [] },
  { courseName: 'Sistemi a microprocessore', cfu: 6, studyYear: 2, semester: 2, prerequisites: [] },
  { courseName: 'Fenomeni aleatori', cfu: 4, studyYear: 2, semester: 2, prerequisites: ['Analisi matematica I'] },

  { courseName: 'Elettronica I', cfu: 9, studyYear: 3, semester: 1, prerequisites: ['Elettrotecnica'] },
  { courseName: 'Reti di calcolatori', cfu: 9, studyYear: 3, semester: 1, prerequisites: ['Fondamenti di informatica'] },
  { courseName: 'Controlli automatici', cfu: 6, studyYear: 3, semester: 1, prerequisites: ['Fondamenti di sistemi dinamici'] },
  { courseName: 'Ingegneria del software', cfu: 9, studyYear: 3, semester: 2, prerequisites: ['Programmazione'] },
  { courseName: 'Sistemi operativi', cfu: 9, studyYear: 3, semester: 2, prerequisites: ['Programmazione', 'Sistemi a microprocessore'] },
  { courseName: 'Misure Elettriche ed Elettroniche', cfu: 6, studyYear: 3, semester: 2, prerequisites: [] },
  { courseName: 'Ulteriori conoscenze: laboratori', cfu: 3, studyYear: 3, semester: 2, prerequisites: [], courseType: 'other' },
  { courseName: 'Prova finale', cfu: 3, studyYear: 3, semester: null, prerequisites: [], courseType: 'other' },

  { courseName: 'Intelligenza Artificiale', cfu: 9, studyYear: 3, semester: 2, prerequisites: ['Programmazione'], courseType: 'elective' },
  { courseName: 'Sistemi multimediali', cfu: 9, studyYear: 3, semester: 2, prerequisites: ['Basi di dati'], courseType: 'elective' },
  { courseName: 'Automazione Industriale', cfu: 9, studyYear: 3, semester: 2, prerequisites: ['Fondamenti di sistemi dinamici'], courseType: 'elective' },
  { courseName: 'Advanced Computer Programming', cfu: 9, studyYear: 3, semester: 1, prerequisites: ['Programmazione'], courseType: 'elective' }
].map(course => ({
  ...course,
  electiveGroup: course.courseType === 'elective' ? 'autonomous-18-cfu' : null,
  electiveRequiredCfu: course.courseType === 'elective' ? 18 : null
}));

function seedL8Plan(database = defaultDb) {
  const aliases = [
    { courseId: 'DE3', courseName: 'Ingegneria Informatica L-8' },
    { courseId: 'N46', courseName: 'Ingegneria Informatica L-8' }
  ];

  return aliases.map(alias => saveStudyPlan(database, {
    ...alias,
    cohortYear: 2025,
    version: VERSION,
    sourceName: 'Guida dello Studente Laurea Triennale N46, a.a. 2025/2026',
    sourceUrl: SOURCE_URL
  }, COURSES));
}

if (require.main === module) {
  const plans = seedL8Plan();
  console.log(`Importati ${plans.length} alias del piano L-8 2025/2026 (${COURSES.length} righe per alias).`);
}

module.exports = { seedL8Plan, COURSES, SOURCE_URL, VERSION };