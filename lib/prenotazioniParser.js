function stripHtml(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanProfessorName(raw) {
  if (!raw) return 'Non specificato';
  let cleaned = stripHtml(raw)
    .replace(/^(prof\.?|dott\.?|ing\.?|presidente|commissione|docente[:\s]*)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Non specificato';
}

function parseItalianDate(dateStr) {
  if (!dateStr) return 0;
  const match = String(dateStr).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return 0;
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime();
}

function normalizePrenotazioni(input = [], subscriptions = [], studyPlanCourses = []) {
  const itemsToProcess = [];

  if (Array.isArray(input)) {
    for (const item of input) {
      if (item && item.materia) {
        itemsToProcess.push(item);
      } else if (item && item.records) {
        for (const rec of item.records) {
          const materia = rec.insegnamento || rec.materia || rec.descrizione;
          if (materia) {
            itemsToProcess.push({
              materia,
              docente: rec.docente || rec.professore || rec.commissione || 'Non specificato',
              dataAppello: rec.data || rec.appello,
              ora: rec.ora,
              aula: rec.aula,
              note: rec.note
            });
          }
        }
      }
    }
  }

  const rawList = [];
  for (const item of itemsToProcess) {
    const materia = stripHtml(item.materia);
    if (!materia || materia.length < 2) continue;

    const docente = cleanProfessorName(item.docente);
    const dataAppello = stripHtml(item.dataAppello || item.data || 'Da definire');
    const ora = stripHtml(item.ora);
    const aula = stripHtml(item.aula);
    const note = stripHtml(item.note);

    const matchingSub = (subscriptions || []).find(sub => {
      if (!sub.professor) return false;
      const p1 = docente.toLowerCase();
      const p2 = stripHtml(sub.professor).toLowerCase();
      return p1.includes(p2) || p2.includes(p1);
    });

    rawList.push({
      id: item.id || `pren_${Math.random().toString(36).substr(2, 9)}`,
      materia,
      docente: matchingSub?.professor || docente,
      dataAppello,
      ora,
      aula,
      note,
      stato: 'in_attesa',
      isMyProfessor: Boolean(matchingSub),
      matchedCourse: matchingSub ? matchingSub.courseName : null
    });
  }

  // Deduplicazione
  const uniqueList = [];
  const seen = new Set();
  for (const item of rawList) {
    const key = `${item.materia.toLowerCase()}_${item.docente.toLowerCase()}_${item.dataAppello}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueList.push(item);
    }
  }

  // Ordinamento: Prima "Il tuo professore", poi per data appello crescente
  return uniqueList.sort((a, b) => {
    if (b.isMyProfessor !== a.isMyProfessor) {
      return Number(b.isMyProfessor) - Number(a.isMyProfessor);
    }
    return parseItalianDate(a.dataAppello) - parseItalianDate(b.dataAppello);
  });
}

module.exports = { normalizePrenotazioni, stripHtml };
