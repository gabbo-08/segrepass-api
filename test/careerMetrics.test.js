const {
  calcolaMetriche,
  simulaBaseLaurea,
  normalizzaEsame
} = require('../lib/careerMetrics'); // <-- Corretto il percorso in ../lib/

describe('Modulo careerMetrics', () => {
  describe('normalizzaEsame', () => {
    test('mappa correttamente un record grezzo con sinonimi di chiavi', () => {
      const rawRow = {
        'Codice Insegnamento': 'A123',
        'Denominazione Attività': 'Ingeneria del Software',
        'Valutazione/Voto': '30 e Lode',
        'Crediti CFU': '9',
        'Data Verbalizzazione': '12/02/2025'
      };

      const exam = normalizzaEsame(rawRow);

      expect(exam.codice).toBe('A123');
      expect(exam.materia).toBe('Ingeneria del Software');
      expect(exam.voto).toBe(30);
      expect(exam.lode).toBe(true);
      expect(exam.cfu).toBe(9);
      expect(exam.data).toBe('12/02/2025');
    });

    test('gestisce idoneità e giudizi non numerici', () => {
      const rawRow = {
        'Insegnamento': 'Tirocinio',
        'Esito': 'IDONEO',
        'CFU': '3'
      };

      const exam = normalizzaEsame(rawRow);

      expect(exam.voto).toBeNull();
      expect(exam.giudizio).toBe('IDONEO');
      expect(exam.cfu).toBe(3);
    });
  });

  describe('calcolaMetriche', () => {
    test('restituisce valori di default in caso di array vuoto', () => {
      const metrics = calcolaMetriche([]);

      expect(metrics.cfuAcquisiti).toBe(0);
      expect(metrics.mediaAritmetica).toBe('--');
      expect(metrics.mediaPonderata).toBe('--');
      expect(metrics.baseLaurea).toBe('--');
    });

    test('calcola media aritmetica, ponderata e base di laurea con esami validi', () => {
      const records = [
        { 'Insegnamento': 'Esame A', 'Voto': '24', 'CFU': '6' },
        { 'Insegnamento': 'Esame B', 'Voto': '30', 'CFU': '12' },
        { 'Insegnamento': 'Inglese', 'Voto': 'IDONEO', 'CFU': '3' } // Non incide sulla media
      ];

      const metrics = calcolaMetriche(records, 180);

      expect(metrics.cfuAcquisiti).toBe(21);
      // Media aritmetica: (24 + 30) / 2 = 27
      expect(metrics.mediaAritmetica).toBe(27);
      // Media ponderata: (24*6 + 30*12) / (6 + 12) = (144 + 360) / 18 = 504 / 18 = 28
      expect(metrics.mediaPonderata).toBe(28);
      // Base laurea: (28 / 30) * 110 = 102.67
      expect(metrics.baseLaurea).toBe(102.67);
      expect(metrics.avanzamentoCFU).toBe(12); // Math.round((21 / 180) * 100)
    });
  });

  describe('simulaBaseLaurea', () => {
    test('simula la proiezione aggiungendo esami ipotetici futuri', () => {
      const esamiAttuali = [{ voto: 24, cfu: 6 }];
      const esamiFuturi = [{ voto: 30, cfu: 6 }];

      // Nuova media ponderata = (24*6 + 30*6) / 12 = 27 -> Base laurea: (27 / 30) * 110 = 99
      const projection = simulaBaseLaurea(esamiAttuali, esamiFuturi);
      expect(projection).toBe(99);
    });

    test('restituisce 0 se non ci sono esami con voto numerico', () => {
      expect(simulaBaseLaurea([], [])).toBe(0);
    });
  });
});