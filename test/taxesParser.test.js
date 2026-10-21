const {
  parseAmount,
  parseDate,
  normalizePaidPayments,
  normalizePendingPayments,
  findPaymentTables
} = require('../lib/taxesParser'); // <-- Corretto il percorso in ../lib/

describe('Modulo taxesParser', () => {
  describe('parseAmount', () => {
    test('converte importi in formato europeo (1.250,50 €) in float', () => {
      expect(parseAmount('1.250,50 €')).toBe(1250.5);
      expect(parseAmount('€ 156,00')).toBe(156);
      expect(parseAmount('140,00')).toBe(140);
    });

    test('gestisce numeri e formati standard con punto decimale', () => {
      expect(parseAmount('156.50')).toBe(156.5);
      expect(parseAmount(200)).toBe(200);
    });

    test('restituisce 0 per valori invalidi o vuoti', () => {
      expect(parseAmount('')).toBe(0);
      expect(parseAmount('N.D.')).toBe(0);
      expect(parseAmount(null)).toBe(0);
    });
  });

  describe('parseDate', () => {
    test('converte date italiane (GG/MM/AAAA e GG.MM.AAAA) in ISO YYYY-MM-DD', () => {
      expect(parseDate('15/10/2025')).toBe('2025-10-15');
      expect(parseDate('05.01.2026')).toBe('2026-01-05');
    });

    test('mantiene inalterate le date già in formato ISO', () => {
      expect(parseDate('2025-10-15')).toBe('2025-10-15');
    });

    test('restituisce null per valori non data', () => {
      expect(parseDate('non-una-data')).toBeNull();
      expect(parseDate(null)).toBeNull();
    });
  });

  describe('normalizePendingPayments', () => {
    test('identifica correttamente lo stato "scaduto" vs "in_attesa"', () => {
      const now = new Date('2026-03-01T00:00:00.000Z');
      const records = [
        { 'Causale': 'Rata Scaduta', 'Data Scadenza': '15/01/2026', 'Importo': '150,00' },
        { 'Causale': 'Rata Futura', 'Data Scadenza': '15/05/2026', 'Importo': '200,00' }
      ];

      const pending = normalizePendingPayments(records, now);

      expect(pending[0].status).toBe('scaduto');
      expect(pending[1].status).toBe('in_attesa');
    });
  });

  describe('findPaymentTables', () => {
    test('smista ed elabora correttamente le tabelle dei pagamenti effettuati e in debito', () => {
      const mockTables = [
        {
          headers: ['Causale Versamento', 'Data Pagamento', 'Importo Euro'],
          records: [
            { 'Causale Versamento': 'I Rata A.A. 2024/2025', 'Data Pagamento': '10/10/2024', 'Importo Euro': '156,00' }
          ]
        },
        {
          headers: ['Causale', 'Data Scadenza', 'Importo da Pagare'],
          records: [
            { 'Causale': 'II Rata A.A. 2024/2025', 'Data Scadenza': '30/04/2026', 'Importo da Pagare': '300,00' }
          ]
        }
      ];

      const result = findPaymentTables(mockTables);

      expect(result.summary.totalPaid).toBe(156);
      expect(result.summary.totalPending).toBe(300);
      expect(result.summary.nextDeadline).toBe('2026-04-30');
      expect(result.paid.length).toBe(1);
      expect(result.pending.length).toBe(1);
    });
  });
});