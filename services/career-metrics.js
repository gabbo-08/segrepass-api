// Trasforma le righe della tabella "Esami Sostenuti" di Segrepass in oggetti Esame
// (stesso formato di api.ts) e calcola CFU, medie e base di laurea.

const normalizeKey = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const cleanText = value => String(value ?? '').replace(/\s+/g, ' ').trim();

/**
 * Primo valore non vuoto la cui intestazione corrisponde a uno dei pattern (in ordine di priorita')
 */
function pickField(record, patterns, exclude = null) {
  const entries = Object.entries(record);
  for (const pattern of patterns) {
    for (const [key, value] of entries) {
      const normalized = normalizeKey(key);
      if (exclude && exclude.test(normalized)) continue;
      if (pattern.test(normalized) && cleanText(value)) return cleanText(value);
    }
  }
  return null;
}

/**
 * "28", "30 e lode", "30L", "28/30" -> voto; "IDONEO" -> giudizio
 */
function parseGrade(raw) {
  const text = cleanText(raw).toUpperCase();
  if (!text) return { voto: null, lode: false, giudizio: null };
  const digits = text.match(/(\d{2})/);
  const voto = digits ? Number(digits[1]) : null;
  if (voto !== null && voto >= 18 && voto <= 30) {
    return { voto, lode: voto === 30 && /LODE|30\s*L\b/.test(text), giudizio: null };
  }
  return { voto: null, lode: false, giudizio: cleanText(raw) };
}

const PASSED_JUDGMENT = /idone|approvat|superat|positiv|conseguit|riconosciut|convalid/i;

/**
 * Righe del libretto -> Esame[] (solo esami superati)
 */
function normalizeEsami(records = []) {
  const hasGradeColumn = records.some(record =>
    Object.keys(record).some(key => /voto|valutazione|esito|giudizio/.test(normalizeKey(key)))
  );

  const exams = [];
  for (const record of records) {
    const name = pickField(
      record,
      [/insegnamento/, /denominazione/, /attivita/, /descrizione/, /materia/, /^esame/],
      /codice|^cod$/
    );
    if (!name) continue;

    const gradeRaw = pickField(record, [/^voto/, /valutazione/, /esito/, /giudizio/]);
    const { voto, lode, giudizio } = parseGrade(gradeRaw);
    // Senza colonna dei voti nella tabella, tutte le righe sono considerate superate
    const passed = !hasGradeColumn || voto !== null || (giudizio && PASSED_JUDGMENT.test(giudizio));
    if (!passed) continue;

    const cfuRaw = pickField(record, [/cfu/, /crediti/, /peso/]);
    const cfu = cfuRaw ? Number((cfuRaw.replace(',', '.').match(/\d+(?:\.\d+)?/) || ['0'])[0]) : 0;

    exams.push({
      materia: name,
      insegnamento: name,
      cfu: Number.isFinite(cfu) ? cfu : 0,
      voto,
      giudizio: voto === null ? giudizio : null,
      lode,
      data: pickField(record, [/data/, /verbalizz/, /superamento/]) || undefined
    });
  }
  return exams;
}

/**
 * Metriche nel formato atteso dal frontend (tipo Metriche di api.ts)
 */
function buildMetriche(records = [], { cfuTotali = 180 } = {}) {
  const esami = normalizeEsami(records);
  const graded = esami.filter(exam => exam.voto !== null);

  const cfuAcquisiti = esami.reduce((sum, exam) => sum + exam.cfu, 0);
  const gradedCfu = graded.reduce((sum, exam) => sum + exam.cfu, 0);

  const mediaAritmetica = graded.length
    ? graded.reduce((sum, exam) => sum + exam.voto, 0) / graded.length
    : null;
  const mediaPonderata = gradedCfu > 0
    ? graded.reduce((sum, exam) => sum + exam.voto * exam.cfu, 0) / gradedCfu
    : null;

  const format = value => (value === null ? null : value.toFixed(2));
  return {
    esami,
    cfuAcquisiti,
    cfuTotali,
    avanzamentoCFU: Math.min(100, Math.round((cfuAcquisiti / cfuTotali) * 100)),
    mediaAritmetica: format(mediaAritmetica),
    mediaPonderata: format(mediaPonderata),
    baseLaurea: mediaPonderata === null ? null : format((mediaPonderata * 110) / 30)
  };
}

module.exports = { buildMetriche, normalizeEsami, parseGrade };
