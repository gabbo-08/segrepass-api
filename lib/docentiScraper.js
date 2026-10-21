const axios = require('axios');
const { getBrowser, acquireBrowserContext } = require('./pool');

const DOCENTI_LOGIN_URL = 'https://www.docenti.unina.it/login';
const DOCENTI_ORIGIN = new URL(DOCENTI_LOGIN_URL).origin;
const DOCENTI_SCRAPE_TIMEOUT_MS = 90 * 1000;
const MAX_DOCENTI_PAGES = 10;
const PAGE_NAVIGATION_TIMEOUT_MS = 15 * 1000;
const VISIBLE_PASSWORD_SELECTOR = 'input[placeholder="Password"]';

function normalizeLabel(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function readField(record, patterns) {
  const entries = Object.entries(record);
  for (const pattern of patterns) {
    const found = entries.find(([key, value]) =>
      pattern.test(normalizeLabel(key)) && value !== null && value !== undefined && String(value).trim()
    );
    if (found) return String(found[1]).trim();
  }
  return null;
}

function normalizeDocentiTables(tables = []) {
  const subscriptions = [];
  const bookedExams = [];

  for (const table of tables) {
    const headers = (table.headers || []).map(normalizeLabel);
    const hasCourse = headers.some(header => /corso|insegnamento|attivita didattica|esame/.test(header));
    const hasTeacher = headers.some(header => /docente|professore|professor|titolare/.test(header));
    const hasExamDate = headers.some(header => /appello|data esame|data prova|data prenotazione/.test(header));
    const hasBooking = headers.some(header => /prenot|appello|esito/.test(header));

    for (const record of table.records || []) {
      if (hasExamDate || hasBooking) {
        bookedExams.push({
          courseName: readField(record, [/^insegnamento\b/, /attivita didattica/, /^corso(?! di laurea)/, /^esame\b/]),
          courseCode: readField(record, [/codice/, /^cod$/]),
          academicYear: readField(record, [/anno accademico/]),
          examDate: readField(record, [/appello/, /data esame/, /data prova/, /data prenotazione/]),
          status: readField(record, [/stato prenotazione/, /stato appello/, /^esito\b/, /^stato\b/, /prenot/]) || 'prenotato',
          location: readField(record, [/aula/, /sede/])
        });
      } else if (hasCourse && hasTeacher) {
        subscriptions.push({
          courseName: readField(record, [/^insegnamento\b/, /attivita didattica/, /^corso(?! di laurea)/, /^esame\b/]),
          courseCode: readField(record, [/codice/, /^cod$/]),
          academicYear: readField(record, [/anno accademico/]),
          professor: readField(record, [/docente/, /professore/, /professor/, /titolare/]),
          section: readField(record, [/canale/, /gruppo/, /turno/])
        });
      }
    }
  }

  return { subscriptions, bookedExams };
}

async function extractTables(page) {
  const tables = [];
  for (const frame of page.frames()) {
    try {
      const extracted = await frame.evaluate(() => Array.from(document.querySelectorAll('table')).map(table => {
        const rows = Array.from(table.querySelectorAll('tr')).map(row => ({
          cells: Array.from(row.querySelectorAll('th,td')).map(cell => (cell.innerText || '').trim()),
          headerCount: row.querySelectorAll('th').length
        }));
        if (rows.length < 2) return null;
        const header = rows.slice(0, 3).find(row => row.headerCount > 0) || rows[0];
        const headerIndex = rows.indexOf(header);
        const records = rows.slice(headerIndex + 1).map(row => row.cells)
          .filter(row => row.some(Boolean))
          .map(row => Object.fromEntries(header.cells.map((name, index) => [name || `col_${index}`, row[index] || ''])));
        return records.length ? { headers: header.cells, records } : null;
      }).filter(Boolean));
      tables.push(...extracted);
    } catch {}
  }
  return tables;
}

function timeoutFor(deadline, maximum) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    const error = new Error('Tempo massimo di acquisizione Docenti superato.');
    error.code = 'DOCENTI_TIMEOUT';
    throw error;
  }
  return Math.min(remaining, maximum);
}

function normalizeDocentiUrl(href) {
  try {
    const url = new URL(href);
    if (url.origin !== DOCENTI_ORIGIN) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

async function getRelevantLinks(page) {
  return page.$$eval('a[href]', anchors => anchors.map(anchor => ({
    href: anchor.href,
    text: (anchor.innerText || '').trim()
  })).filter(link => /corso|insegnament|didattic|prenot|appell|esame/i.test(`${link.text} ${link.href}`)));
}

async function collectDocentiTables(page, dependencies = {}) {
  const extractPageTables = dependencies.extractTables || extractTables;
  const getLinks = dependencies.getLinks || getRelevantLinks;
  const deadline = dependencies.deadline || Date.now() + DOCENTI_SCRAPE_TIMEOUT_MS;
  const tables = [...await extractPageTables(page)];
  const firstUrl = normalizeDocentiUrl(page.url());
  const discovered = new Set(firstUrl ? [firstUrl] : []);
  const queue = [];
  let pagesVisited = 1;

  function enqueue(links) {
    for (const link of links) {
      const href = normalizeDocentiUrl(link.href);
      if (!href || discovered.has(href)) continue;
      discovered.add(href);
      queue.push(href);
    }
  }

  enqueue(await getLinks(page));
  while (queue.length && pagesVisited < MAX_DOCENTI_PAGES) {
    const href = queue.shift();
    try {
      await page.goto(href, {
        waitUntil: 'networkidle2',
        timeout: timeoutFor(deadline, PAGE_NAVIGATION_TIMEOUT_MS)
      });
    } catch (error) {
      console.warn(`[docenti] Impossibile caricare una pagina pertinente (${href}): ${error.message}`);
      continue;
    }

    pagesVisited += 1;
    if (await page.$(VISIBLE_PASSWORD_SELECTOR)) {
      const error = new Error('Sessione Docenti Unina scaduta durante la navigazione.');
      error.code = 'DOCENTI_AUTH_FAILED';
      throw error;
    }

    tables.push(...await extractPageTables(page));
    enqueue(await getLinks(page));
  }

  return tables;
}

// Funzione principale che accetta credenziali dinamiche per ogni utente
async function getDocentiData(credentials = {}, dependencies = {}) {
  const username = credentials.username || process.env.DOCENTI_USERNAME;
  const password = credentials.password || process.env.DOCENTI_PASSWORD;
  
  if (!username || !password) {
    return { available: false, reason: 'DOCENTI_CREDENTIALS_REQUIRED', subscriptions: [], bookedExams: [], announcements: [] };
  }

  const deadline = Date.now() + DOCENTI_SCRAPE_TIMEOUT_MS;
  let browserContext;
  
  try {
    const acquireContext = dependencies.acquireBrowserContext || acquireBrowserContext;
    browserContext = await acquireContext(dependencies.getBrowser || getBrowser);
    const { context } = browserContext;
    const page = await context.newPage();

    const avvisiPromise = axios.get('https://www.docenti.unina.it/unina-api/v1/avvisi/ultimo-mese', {
      timeout: 6000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }).then(res => res.data).catch(() => []);

    await page.goto(DOCENTI_LOGIN_URL, {
      waitUntil: 'networkidle2',
      timeout: timeoutFor(deadline, 30000)
    });
    
    const studenteTab = await page.evaluateHandle(() => Array.from(document.querySelectorAll('*')).find(e => e.children.length === 0 && (e.textContent || '').trim().toLowerCase() === 'studente'));
    if (studenteTab.asElement()) await studenteTab.asElement().click();
    await new Promise(r => setTimeout(r, 800));
    
    await page.waitForSelector('input[placeholder="Username"]', {
      visible: true,
      timeout: timeoutFor(deadline, 10000)
    });
    
    await page.type('input[placeholder="Username"]', username, { delay: 15 });
    await page.type(VISIBLE_PASSWORD_SELECTOR, password, { delay: 15 });

    const navigation = page.waitForNavigation({
      waitUntil: 'domcontentloaded',
      timeout: timeoutFor(deadline, 20000)
    }).catch(() => null);
    
    const loginFormHidden = page.waitForFunction(() => {
      const field = document.querySelector('input[placeholder="Password"]');
      return !field || field.getClientRects().length === 0;
    }, { timeout: timeoutFor(deadline, 20000) }).catch(() => null);

    const [loginResponse] = await Promise.all([
      Promise.race([navigation, loginFormHidden]),
      page.keyboard.press('Enter')
    ]);

    if (loginResponse && loginResponse.status() >= 400) {
      const error = new Error(`Login Docenti Unina fallito (HTTP ${loginResponse.status()}).`);
      error.code = 'DOCENTI_AUTH_FAILED';
      throw error;
    }
    
    if (await page.$(VISIBLE_PASSWORD_SELECTOR)) {
      const error = new Error('Credenziali Docenti Unina non valide.');
      error.code = 'DOCENTI_AUTH_FAILED';
      throw error;
    }

    const [tables, announcementsData] = await Promise.all([
      collectDocentiTables(page, dependencies),
      avvisiPromise
    ]);

    const parsedTables = normalizeDocentiTables(tables);
    const available = parsedTables.subscriptions.length > 0 || parsedTables.bookedExams.length > 0 || announcementsData.length > 0;

    return {
      available,
      reason: available ? null : 'DOCENTI_DATA_NOT_FOUND',
      retrievedAt: new Date().toISOString(),
      announcements: announcementsData,
      ...parsedTables
    };

  } finally {
    await browserContext?.close();
  }
}

module.exports = {
  getDocentiData,
  normalizeDocentiTables,
  extractTables,
  collectDocentiTables,
  DOCENTI_LOGIN_URL,
  MAX_DOCENTI_PAGES
};