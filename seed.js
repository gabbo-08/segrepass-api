const { db } = require('./db/index');
const { saveStudyPlan } = require('./db/repository');

const planTest = {
  courseId: 'DE3',
  cohortYear: 2024,
  courseName: 'INGEGNERIA INFORMATICA',
  version: '1',
  sourceName: 'Manifesto Ufficiale DIETI',
  sourceUrl: 'https://www.dieti.unina.it'
};

const coursesTest = [
  { courseCode: '001', courseName: 'ANALISI MATEMATICA I', cfu: 9, studyYear: 1, semester: 1, courseType: 'mandatory' },
  { courseCode: '002', courseName: 'GEOMETRIA E ALGEBRA', cfu: 6, studyYear: 1, semester: 1, courseType: 'mandatory' },
  { courseCode: '003', courseName: 'FONDAMENTI DI INFORMATICA', cfu: 9, studyYear: 1, semester: 2, courseType: 'mandatory' }
];

saveStudyPlan(db, planTest, coursesTest);
console.log('Manifesto DE3 / 2024 caricato con successo nel DB!');