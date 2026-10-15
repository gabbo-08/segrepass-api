function normalizeLabel(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractYear(value) {
  const match = String(value || '').match(/(?:19|20|21)\d{2}/);
  return match ? Number(match[0]) : null;
}

function extractCourseYear(value) {
  const match = String(value || '').match(/\b(\d{1,2})\s*(?:°|º| anno)?\b/i);
  return match ? Number(match[1]) : null;
}

function extractStudentProfile(data = {}) {
  const profile = { ...(data.profile || data.profilo || {}) };
  const pairs = [];

  for (const table of data.tabelleRiepilogo || []) {
    for (const record of table.records || []) {
      const entries = Object.entries(record);
      for (const [label, value] of entries) pairs.push([label, value]);
      if (entries.every(([key]) => /^col_\d+$/.test(key))) {
        const values = entries.map(([, value]) => value);
        for (let index = 0; index + 1 < values.length; index += 2) {
          pairs.push([values[index], values[index + 1]]);
        }
      }
    }
  }

  for (const [rawLabel, rawValue] of pairs) {
    const label = normalizeLabel(rawLabel);
    const value = String(rawValue || '').trim();
    if (!value) continue;

    if (!profile.courseId && /codice (del )?(corso|studio|cds)|course id/.test(label)) {
      profile.courseId = value;
    }
    if (!profile.courseName && !/(codice|code)/.test(label) &&
      /(nome|denominazione|corso di studio)/.test(label) && /corso|studio|cds/.test(label)) {
      profile.courseName = value;
    }
    if (!profile.cohortYear && /(immatricol|anno di accesso)/.test(label)) {
      profile.cohortYear = extractYear(value);
    }
    if (!profile.currentCourseYear && /(anno di corso|annualita di corso)/.test(label)) {
      profile.currentCourseYear = extractCourseYear(value);
    }
  }

  if (!profile.courseId && profile.courseName) {
    profile.courseId = profile.courseName.match(/\[([A-Z0-9_-]+)\]/i)?.[1] || null;
  }

  return {
    courseId: profile.courseId || null,
    courseName: profile.courseName || null,
    cohortYear: Number.isInteger(profile.cohortYear) ? profile.cohortYear : null,
    currentCourseYear: Number.isInteger(profile.currentCourseYear) ? profile.currentCourseYear : null
  };
}

module.exports = { extractStudentProfile, normalizeLabel, extractYear, extractCourseYear };