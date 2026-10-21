const { queueScrapingTask } = require('./pool');
const { scrapeEsamiSostenuti } = require('./esami');
const { scrapeCalendarioAppelli } = require('./prenotazioni');
const { scrapeTasse } = require('./tasse');

async function enableFastMode(page) {
  try {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.isInterceptResolutionHandled()) return;
      if (['image', 'font', 'media'].includes(req.resourceType())) {
        req.abort().catch(() => {});
      } else {
        req.continue().catch(() => {});
      }
    });
  } catch {}
}

async function typeFast(page, selector, value) {
  await page.waitForSelector(selector, { timeout: 4000 });
  await page.evaluate((sel, val) => {
    const el = document.querySelector(sel);
    if (el) {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, selector, value);
}

async function getDatiCarriera({ codiceFiscale, password } = {}) {
  if (!codiceFiscale || !password) throw new Error('Inserisci codice fiscale e password Segrepass.');

  return await queueScrapingTask({ codiceFiscale, password }, async (page, data) => {
    await enableFastMode(page);
    const context = page.browserContext();

    console.log('[scraper] 1. Login Segrepass...');
    await page.goto('https://www.segrepass1.unina.it/Welcome.do', { waitUntil: 'domcontentloaded', timeout: 15000 });

    await typeFast(page, 'input[name="codice_fiscale"]', data.codiceFiscale.trim());
    await typeFast(page, 'input[name="password"]', data.password);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
      page.click('#cfSubmit')
    ]);

    await page.goto('https://www.segrepass1.unina.it/dispatch.do?dove=LinkEsis', { waitUntil: 'domcontentloaded', timeout: 15000 });
    const esisUrl = page.url();

    console.log('[scraper] 2. Estrazione modulare parallela in corso...');

    const [tabellaEsami, taxes, appelliCalendario] = await Promise.all([
      scrapeEsamiSostenuti(context, esisUrl),
      scrapeTasse(context, esisUrl),
      scrapeCalendarioAppelli(context, esisUrl)
    ]);

    return {
      anagrafica: {
        codiceCorso: 'DE3',
        corsoDiLaurea: 'INGEGNERIA INFORMATICA',
        annoImmatricolazione: 2025,
        annoCorso: 2
      },
      tabellaEsami,
      taxes,
      pianoDiStudiRaw: [],
      prenotazioniRaw: appelliCalendario
    };
  });
}

module.exports = { getDatiCarriera };