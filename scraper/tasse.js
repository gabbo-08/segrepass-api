const { findPaymentTables } = require('../lib/taxes');

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

async function extractTables(targetPage) {
  const results = [];
  for (const frame of targetPage.frames()) {
    try {
      const tables = await frame.evaluate(() => {
        const c = s => (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        return Array.from(document.querySelectorAll('table')).map(t => {
          const rows = Array.from(t.querySelectorAll('tr')).map(tr => ({
            cells: Array.from(tr.querySelectorAll('th, td')).map(td => c(td.innerText)),
          }));
          if (rows.length < 2) return null;
          const headers = rows[0].cells;
          const records = rows.slice(1)
            .map(row => row.cells)
            .filter(row => row.some(cell => cell !== ''))
            .map(row => Object.fromEntries(headers.map((h, i) => [h || `col_${i}`, row[i] ?? ''])));
          return { headers, records, rowCount: records.length };
        }).filter(Boolean);
      });
      if (tables && tables.length > 0) results.push(...tables);
    } catch {}
  }
  return results;
}

async function scrapeTasse(context, esisUrl) {
  const page = await context.newPage();
  await enableFastMode(page);
  try {
    await page.goto(esisUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    // Cerca versamenti
    for (const frame of page.frames()) {
      const clicked = await frame.evaluate(() => {
        const link = Array.from(document.querySelectorAll('a')).find(a => a.href.includes('versamenti') || (a.innerText || '').toLowerCase().includes('versamenti'));
        if (link) { link.click(); return true; }
        return false;
      });
      if (clicked) {
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 6000 }).catch(() => {});
        break;
      }
    }
    const tables = await extractTables(page);
    return findPaymentTables(tables);
  } catch {
    return { paid: [], pending: [], totalPaid: 0, totalPending: 0 };
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { scrapeTasse };
