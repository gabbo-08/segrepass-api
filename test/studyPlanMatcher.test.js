const {
  matchStudyPlan,
  normalizeCourseName,
  nameSimilarity,
  DEFAULT_THRESHOLD
} = require('../lib/studyPlanMatcher'); // <-- Corretto il percorso in ../lib/

describe('Modulo studyPlanMatcher', () => {
  describe('normalizeCourseName', () => {
    test('converte in minuscolo e rimuove accenti', () => {
      expect(normalizeCourseName('CÀLCOLO DÌFFERENZIALE')).toBe('calcolo differenziale');
    });

    test('normalizza i numeri romani in cifre arabe', () => {
      expect(normalizeCourseName('Analisi Matematica III')).toBe('analisi matematica 3');
      expect(normalizeCourseName('Fisica Generale II')).toBe('fisica generale 2');
      expect(normalizeCourseName('Istituzioni di Diritto I')).toBe('istituzioni di diritto 1');
    });

    test('rimuove caratteri speciali inutili', () => {
      expect(normalizeCourseName('Programmazione & Algoritmi (A-K)')).toBe('programmazione algoritmi a k');
    });
  });

  describe('nameSimilarity', () => {
    test('restituisce 1 per stringhe identiche', () => {
      expect(nameSimilarity('Fisica 1', 'Fisica 1')).toBe(1);
    });

    test('restituisce un valore elevato per nomi simili con variazioni minori', () => {
      const sim = nameSimilarity('SISTEMI OPERATIVI', 'Sistemi Operativi e Reti');
      expect(sim).toBeGreaterThan(0.5);
    });

    test('restituisce 0 per stringhe totalmente differenti o vuote', () => {
      expect(nameSimilarity('Chimica', 'Diritto Privato')).toBeLessThan(DEFAULT_THRESHOLD);
      expect(nameSimilarity('', null)).toBe(0);
    });
  });

  describe('matchStudyPlan', () => {
    const planCourses = [
      { id: 1, courseCode: 'DE1001', courseName: 'Analisi Matematica I', cfu: 9, courseType: 'mandatory' },
      { id: 2, courseCode: 'DE1002', courseName: 'Fisica I', cfu: 9, courseType: 'mandatory' },
      { id: 3, id: 3, courseCode: 'DE1003', courseName: 'Reti di Calcolatori', cfu: 6, courseType: 'elective', electiveGroup: 'grp1', electiveRequiredCfu: 6 }
    ];

    test('associa correttamente un esame superato tramite codice corso', () => {
      const passedExams = [
        { codice: 'DE1001', materia: 'Analisi Matematica I', cfu: 9, voto: 28 }
      ];

      const result = matchStudyPlan({ planCourses, passedExams });
      const matched = result.courses.find(c => c.id === 1);

      expect(matched.status).toBe('passed');
      expect(matched.matchMethod).toBe('course_code');
      expect(result.summary.passedCourses).toBe(1);
    });

    test('associa tramite fuzzy name quando il codice manca', () => {
      const passedExams = [
        { materia: 'ANALISI MATEMATICA 1', cfu: 9, voto: 30 }
      ];

      const result = matchStudyPlan({ planCourses, passedExams });
      const matched = result.courses.find(c => c.id === 1);

      expect(matched.status).toBe('passed');
      expect(matched.matchMethod).toBe('fuzzy_name');
    });

    test('segnala "needs_review" se i CFU non corrispondono', () => {
      const passedExams = [
        { codice: 'DE1001', materia: 'Analisi Matematica I', cfu: 6, voto: 25 } // 6 CFU invece di 9
      ];

      const result = matchStudyPlan({ planCourses, passedExams });
      const matched = result.courses.find(c => c.id === 1);

      expect(matched.status).toBe('needs_review');
      expect(result.summary.reviewCourses).toBe(1);
    });

    test('calcola correttamente il riepilogo degli esami a scelta (electiveGroups)', () => {
      const passedExams = [
        { codice: 'DE1003', materia: 'Reti di Calcolatori', cfu: 6, voto: 30 }
      ];

      const result = matchStudyPlan({ planCourses, passedExams, selectedElectiveIds: [3] });
      const group = result.electiveGroups.find(g => g.id === 'grp1');

      expect(group.passedCfu).toBe(6);
      expect(group.remainingCfu).toBe(0);
    });
  });
});