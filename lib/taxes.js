/**
 * Modulo per il parsing e la normalizzazione delle tasse e dei versamenti Segrepass
 */

function normalizeLabel(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function readField(record, patterns) {
  const entry = Object.entries(record || {}).find(([key, value]) =>
    patterns.some(pattern => pattern.test(normalizeLabel(key))) && value !== null && value !== undefined && String(value).trim()
  );
  return entry ? String(entry[1]).trim() : '';
}

function parseAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  let str = String(value || '').trim();
  if (!str) return 0;

  // Pulizia simbolo euro e spazi
  str = str.replace(/€/g, '').replace(/\s+/g, '').trim();
  const raw = str.replace(/[^\d,.-]/g, '');
  if (!raw) return 0;

  const commaIndex = raw.lastIndexOf(',');
  const dotIndex = raw.lastIndexOf('.');
  const decimalSeparator = commaIndex > dotIndex ? ',' : dotIndex > commaIndex ? '.' : null;

  const normalized = decimalSeparator
    ? raw.replace(decimalSeparator === ',' ? /\./g : /,/g, '').replace(decimalSeparator, '.')
    : raw;

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function parseDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const italian = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (!italian) return null;
  return `${italian[3]}-${italian[2].padStart(2, '0')}-${italian[1].padStart(2, '0')}`;
}

function normalizePaidPayments(records = []) {
  return records.map(record => ({
    description: readField(record, [/descrizione/, /causale/, /versamento/]) || 'Versamento',
    academicYear: readField(record, [/anno accademico/, /anno iscrizione/]) || null,
    amount: parseAmount(readField(record, [/importo/, /totale/])),
    paidAt: parseDate(readField(record, [/^data$/, /data pagamento/, /data versamento/])),
    iuv: readField(record, [/\biuv\b/, /\biud\b/, /identificativo univoco/]) || null,
    paymentCode: readField(record, [/codice/]) || null,
    status: 'paid'
  })).filter(payment => payment.amount > 0 || payment.description !== 'Versamento');
}

function normalizePendingPayments(records = [], now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return records.map(record => {
    const dueDate = parseDate(readField(record, [/data scadenza/, /scadenza/, /entro il/]));
    const due = dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : null;
    const explicitStatus = readField(record, [/stato/, /status/]);
    const status = explicitStatus || (due && due < today ? 'scaduto' : 'in_attesa');

    return {
      description: readField(record, [/descrizione/, /causale/, /versamento/]) || 'Pagamento universitario',
      academicYear: readField(record, [/anno accademico/, /anno iscrizione/]) || null,
      amount: parseAmount(readField(record, [/importo/, /totale/])),
      dueDate,
      status,
      iuv: readField(record, [/\biuv\b/, /\biud\b/, /identificativo univoco/]) || null,
      paymentCode: readField(record, [/codice/]) || null,
      paymentLink: readField(record, [/iscrizioni/, /link pagopa/, /url pagamento/]) || null
    };
  }).filter(payment => payment.amount > 0 || payment.dueDate || payment.paymentCode);
}

function buildTaxesSummary({ paid = [], pending = [] } = {}) {
  const deadlines = pending.map(payment => payment.dueDate).filter(Boolean).sort();
  return {
    summary: {
      totalPaid: Number(paid.reduce((total, payment) => total + (Number(payment.amount) || 0), 0).toFixed(2)),
      totalPending: Number(pending.reduce((total, payment) => total + (Number(payment.amount) || 0), 0).toFixed(2)),
      nextDeadline: deadlines[0] || null
    },
    paid,
    pending
  };
}

function findPaymentTables(tables = []) {
  const paidRecords = [];
  const pendingRecords = [];

  for (const table of tables) {
    const headers = table.headers.map(normalizeLabel);
    const hasAmount = headers.some(header => /importo|totale/.test(header));
    if (!hasAmount) continue;

    const hasDeadline = headers.some(header => /data scadenza|scadenza/.test(header));
    const hasPaidDate = headers.some(header => /^data$/.test(header) || /data pagamento|data versamento/.test(header));
    const hasOrigin = headers.some(header => /origine/.test(header));

    if (hasDeadline) {
      pendingRecords.push(...table.records);
    } else if (hasPaidDate || hasOrigin) {
      paidRecords.push(...table.records);
    }
  }

  return buildTaxesSummary({
    paid: normalizePaidPayments(paidRecords),
    pending: normalizePendingPayments(pendingRecords)
  });
}

module.exports = { parseAmount, parseDate, normalizePaidPayments, normalizePendingPayments, buildTaxesSummary, findPaymentTables };