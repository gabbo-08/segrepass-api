const { acquireBrowserContext } = require('./pool');
const { findPaymentTables } = require('../lib/taxes');

async function typeInFirst(page, selectors, value, opts = {}) {
  for (const sel of selectors) {
    try {
      await page.waitForSelector(sel, { timeout: 3000 });
      await page.type(sel, value, opts);
      return sel;
    } catch {}
  }
  throw new Error(`Nessun campo trovato: ${selectors.join(', ')}`);
}

async function extractAllTables(targetPage) {
  const results = [];

  for (const frame of targetPage.frames()) {
    try {
      const tables = await frame.evaluate(() => {
        return Array.from(document.querySelectorAll('table')).map(t => {
          const rows = Array.from(t.querySelectorAll('tr')).map(tr => ({
            cells: Array.from(tr.querySelectorAll('th, td')).map(td => (td.innerText || '').trim()),
            headerCount: tr.querySelectorAll('th').length
          }));
          if (rows.length < 2) return null;

          const headerCandidates = rows.slice(0, -1)
            .map((row, index) => ({ ...row, index }))
            .filter(row => row.index < 4 && (row.headerCount > 0 || row.cells.filter(Boolean).length > 1));
          const headerRow = headerCandidates.sort((a, b) =>
            b.headerCount - a.headerCount || b.cells.filter(Boolean).length - a.cells.filter(Boolean).length
          )[0];
          if (!headerRow) return null;

          const headers = headerRow.cells;
          const records = rows.slice(headerRow.index + 1)
            .map(row => row.cells)
            .filter(row => row.some(c => c !== ''))
            .map(row => Object.fromEntries(headers.map((h, i) => [h || `col_${i}`, row[i] ?? ''])));

          return { headers, records, rowCount: records.length };
        }).filter(Boolean);
      });

      if (tables && tables.length > 0) {
        results.push(...tables);
      }
    } catch (e) {}
  }
  return results;
}

async function clickMenuAction(targetPage, action, textFallback) {
  for (const frame of targetPage.frames()) {
    try {
      const href = await frame.evaluate(({ actionName, fallback }) => {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const target = links.find(link => link.href.includes(`azione=${actionName}`)) ||
          links.find(link => (link.innerText || '').trim().toLowerCase() === fallback.toLowerCase());
        return target?.getAttribute('href') || null;
      }, { actionName: action, fallback: textFallback });
      if (!href) continue;

      const navigation = targetPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 12000 }).catch(() => null);
      const clicked = await frame.evaluate(targetHref => {
        const target = Array.from(document.querySelectorAll('a[href]')).find(link => link.getAttribute('href') === targetHref);
        if (!target) return false;
        target.click();
        return true;
      }, href);
      if (!clicked) continue;
      await Promise.race([navigation, new Promise(resolve => setTimeout(resolve, 5000))]);
      return true;
    } catch {}
  }
  return false;
}

async function extractTablesForAction(targetPage, action, label) {
  const clicked = await clickMenuAction(targetPage, action, label);
  if (!clicked) return { available: false, tables: [] };
  return { available: true, tables: await extractAllTables(targetPage) };
}

function selezionaTabellaEsami(tables = []) {
  const candidates = tables.map(table => {
    const headers = table.headers.map(header => String(header)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
    const hasSubject = headers.some(header => /insegnamento|denominazione|attivita|descrizione|materia|esame/.test(header));
    const hasGrade = headers.some(header => /voto|valutazione|giudizio|esito|lode/.test(header));
    const hasCredits = headers.some(header => /cfu|crediti|peso/.test(header));
    const hasDate = headers.some(header => /data|verbalizz|superamento/.test(header));
    const hasCode = headers.some(header => /codice/.test(header));

    if (!(hasSubject && (hasGrade || hasCredits)) && !(hasGrade && hasCredits)) return null;

    return {
      table,
      score: (hasSubject ? 5 : 0) + (hasGrade ? 4 : 0) + (hasCredits ? 3 : 0) +
        (hasDate ? 1 : 0) + (hasCode ? 1 : 0)
    };
  }).filter(Boolean);

  candidates.sort((a, b) => b.score - a.score || b.table.rowCount - a.table.rowCount);
  return candidates[0]?.table || null;
}

async function getDatiCarriera({ codiceFiscale, password } = {}) {
  if (!codiceFiscale || !password) {
    throw new Error('Inserisci codice fiscale e password Segrepass.');
  }

  const browserContext = await acquireBrowserContext();
  const { context } = browserContext;

  let esisPage = null;

  try {
    const page = await context.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    console.log('[scraper] 1. Login su Segrepass...');
    await page.goto('https://www.segrepass1.unina.it/Welcome.do', { waitUntil: 'networkidle2', timeout: 30000 });

    await typeInFirst(page, ['input[name="codice_fiscale"]', 'input#codice_fiscale', 'input[name="username"]'], codiceFiscale.trim(), { delay: 20 });
    await typeInFirst(page, ['input[name="password"]', 'input#password'], password, { delay: 20 });

    const [loginResponse] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
      page.click('#cfSubmit')
    ]);
    if (loginResponse && loginResponse.status() >= 400) {
      throw new Error(`Login Segrepass fallito (HTTP ${loginResponse.status()}).`);
    }
    if (await page.$('input[name="codice_fiscale"]')) {
      throw new Error('Credenziali Segrepass non valide.');
    }

    console.log('[scraper] 2. Accesso a Segreteria OnLine...');
    await page.goto('https://www.segrepass1.unina.it/dispatch.do?dove=LinkEsis', { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));

    // Individuazione della scheda/finestra attiva
    const pages = await context.pages();
    esisPage = pages.find(p => p.url().includes('esis') || p.url().includes('identificazione.do') || p.url().includes('dispatch.do')) || page;
    await esisPage.bringToFront();

    console.log('[scraper] 3. Ricerca link Esami / Dati Carriera...');
    const clicked = await clickMenuAction(esisPage, 'esamiSostenuti', 'Esami Sostenuti');
    if (!clicked) throw new Error('Link "Esami Sostenuti" non trovato nel menu Segrepass.');

    // Attesa per caricamento dei dati nel frame principale
    await new Promise(r => setTimeout(r, 3500));

    console.log('[scraper] 4. Estrazione tabelle in corso...');
    const allTables = await extractAllTables(esisPage);
    console.log(`[scraper] Tabelle estratte: ${allTables.length}`);

    const tabellaEsami = selezionaTabellaEsami(allTables) || { headers: [], records: [], rowCount: 0 };
    if (tabellaEsami.rowCount === 0) {
      console.warn('[scraper] Nessuna tabella esami riconosciuta. Intestazioni trovate:',
        allTables.map(table => table.headers));
    }

    console.log(`[scraper] Righe esami trovate: ${tabellaEsami.records ? tabellaEsami.records.length : 0}`);
    if (tabellaEsami.records && tabellaEsami.records.length > 0) {
      console.log('[scraper] Intestazioni esami:', tabellaEsami.headers);
    }

    const tabelleRiepilogo = allTables.filter(t => t !== tabellaEsami);

    console.log('[scraper] 5. Lettura versamenti effettuati e in debito...');
    const paidTables = await extractTablesForAction(esisPage, 'versamenti', 'Versamenti Effettuati');
    const pendingTables = await extractTablesForAction(esisPage, 'debiti', 'Versamenti in Debito');
    const taxes = findPaymentTables([
      ...paidTables.tables,
      ...pendingTables.tables
    ]);
    taxes.available = paidTables.available || pendingTables.available;

    if (!taxes.available) {
      taxes.reason = 'Voci pagamenti non disponibili nel menu ESIS.';
    }
    console.log(`[scraper] Versamenti letti: pagati ${taxes.paid.length}, da pagare ${taxes.pending.length}`);

    return { tabellaEsami, tabelleRiepilogo, taxes };

  } finally {
    await browserContext.close();
  }
}

module.exports = { getDatiCarriera, selezionaTabellaEsami, clickMenuAction, extractTablesForAction };