const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeDocentiTables,
  getDocentiData,
  collectDocentiTables
} = require('../scraper/docenti');

function useDocentiCredentials(t) {
  const previousUsername = process.env.DOCENTI_USERNAME;
  const previousPassword = process.env.DOCENTI_PASSWORD;
  process.env.DOCENTI_USERNAME = 'test-user';
  process.env.DOCENTI_PASSWORD = 'test-password';
  t.after(() => {
    if (previousUsername === undefined) delete process.env.DOCENTI_USERNAME;
    else process.env.DOCENTI_USERNAME = previousUsername;
    if (previousPassword === undefined) delete process.env.DOCENTI_PASSWORD;
    else process.env.DOCENTI_PASSWORD = previousPassword;
  });
}

test('separates subscribed courses from booked exam calls', () => {
  const result = normalizeDocentiTables([
    {
      headers: ['Codice', 'Insegnamento', 'Docente', 'Anno Accademico'],
      records: [{ Codice: 'INF1', Insegnamento: 'Reti di calcolatori', Docente: 'Docente A', 'Anno Accademico': '2026/2027' }]
    },
    {
      headers: ['Esame', 'Data Appello', 'Stato', 'Aula'],
      records: [{ Esame: 'Reti di calcolatori', 'Data Appello': '10/01/2027', Stato: 'Prenotato', Aula: 'T1' }]
    }
  ]);

  assert.equal(result.subscriptions.length, 1);
  assert.equal(result.subscriptions[0].professor, 'Docente A');
  assert.equal(result.bookedExams.length, 1);
  assert.equal(result.bookedExams[0].examDate, '10/01/2027');
});

test('prioritizes subject fields and does not treat course status as an exam booking', () => {
  const result = normalizeDocentiTables([{
    headers: ['Corso di laurea', 'Insegnamento', 'Docente', 'Stato corso'],
    records: [{
      'Corso di laurea': 'Ingegneria Informatica',
      Insegnamento: 'Reti di calcolatori',
      Docente: 'Docente A',
      'Stato corso': 'Attivo'
    }]
  }]);

  assert.equal(result.subscriptions.length, 1);
  assert.equal(result.subscriptions[0].courseName, 'Reti di calcolatori');
  assert.equal(result.bookedExams.length, 0);
});

test('collects tables from every relevant same-origin page', async () => {
  let currentUrl = 'https://www.docenti.unina.it/home';
  const page = {
    url: () => currentUrl,
    goto: async href => { currentUrl = href; },
    $: async () => null
  };
  const tablesByUrl = {
    'https://www.docenti.unina.it/home': [{ headers: ['Insegnamento'], records: [{ Insegnamento: 'Analisi I' }] }],
    'https://www.docenti.unina.it/prenotazioni': [{ headers: ['Esame'], records: [{ Esame: 'Analisi I' }] }]
  };
  const linksByUrl = {
    'https://www.docenti.unina.it/home': [
      { href: 'https://www.docenti.unina.it/prenotazioni', text: 'Prenotazioni' },
      { href: 'https://other.example/private', text: 'Esami' }
    ],
    'https://www.docenti.unina.it/prenotazioni': []
  };

  const tables = await collectDocentiTables(page, {
    extractTables: async target => tablesByUrl[target.url()] || [],
    getLinks: async target => linksByUrl[target.url()] || []
  });

  assert.equal(tables.length, 2);
  assert.equal(currentUrl, 'https://www.docenti.unina.it/prenotazioni');
});

test('reports missing Docenti credentials without launching a browser', async t => {
  const previousUsername = process.env.DOCENTI_USERNAME;
  const previousPassword = process.env.DOCENTI_PASSWORD;
  delete process.env.DOCENTI_USERNAME;
  delete process.env.DOCENTI_PASSWORD;
  t.after(() => {
    if (previousUsername !== undefined) process.env.DOCENTI_USERNAME = previousUsername;
    if (previousPassword !== undefined) process.env.DOCENTI_PASSWORD = previousPassword;
  });

  const result = await getDocentiData({
    acquireBrowserContext: async () => { throw new Error('browser should not start without Docenti credentials'); }
  });
  assert.equal(result.available, false);
  assert.equal(result.reason, 'DOCENTI_CREDENTIALS_REQUIRED');
  assert.deepEqual(result.subscriptions, []);
});

test('returns unavailable when an authenticated scrape finds no useful records', async t => {
  useDocentiCredentials(t);
  const closed = { value: false };
  const page = {
    goto: async () => {},
    evaluate: async () => {},
    waitForSelector: async () => {},
    type: async () => {},
    waitForNavigation: async () => null,
    waitForFunction: async () => null,
    click: async () => {},
    $: async () => null,
    url: () => 'https://www.docenti.unina.it/home'
  };

  const result = await getDocentiData({
    acquireBrowserContext: async () => ({ context: { newPage: async () => page }, close: async () => { closed.value = true; } }),
    extractTables: async () => [],
    getLinks: async () => []
  });

  assert.equal(result.available, false);
  assert.equal(result.reason, 'DOCENTI_DATA_NOT_FOUND');
  assert.equal(closed.value, true);
});

test('closes the browser context when page initialization fails', async t => {
  useDocentiCredentials(t);
  let closed = false;

  await assert.rejects(getDocentiData({
    acquireBrowserContext: async () => ({
      context: { newPage: async () => { throw new Error('newPage failed'); } },
      close: async () => { closed = true; }
    })
  }), /newPage failed/);

  assert.equal(closed, true);
});
