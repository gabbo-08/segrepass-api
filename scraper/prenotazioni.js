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

async function scrapeCalendarioAppelli(context, esisUrl) {
  const appelli = [];
  const page = await context.newPage();
  await enableFastMode(page);

  try {
    await page.goto(esisUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    
    // Clicca su Calendario Appelli
    let clicked = false;
    for (const frame of page.frames()) {
      clicked = await frame.evaluate(() => {
        const link = Array.from(document.querySelectorAll('a')).find(a => a.href.includes('calendarioAppelli') || (a.innerText || '').toLowerCase().includes('calendario appelli'));
        if (link) { link.click(); return true; }
        return false;
      });
      if (clicked) {
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 6000 }).catch(() => {});
        break;
      }
    }

    if (!clicked) return appelli;
    await new Promise(r => setTimeout(r, 1000));

    let mainFrame = page.mainFrame();
    for (const frame of page.frames()) {
      const hasTable = await frame.$('table');
      if (hasTable) {
        const count = await frame.$$eval('table tr', rows => rows.length);
        if (count > 2) { mainFrame = frame; break; }
      }
    }

    const examList = await mainFrame.evaluate(() => {
      const c = s => (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      const rows = Array.from(document.querySelectorAll('table tr'));
      const items = [];
      for (const tr of rows) {
        const cells = tr.querySelectorAll('td');
        if (cells.length >= 2) {
          const link = cells[0].querySelector('a');
          const code = c(cells[0].innerText);
          const name = c(cells[1].innerText);
          const year = cells[2] ? c(cells[2].innerText) : '';
          if (link && code && name) {
            items.push({ code, name, year, href: link.href || link.getAttribute('href') });
          }
        }
      }
      return items;
    });

    const queue = [...examList];
    const CONCURRENCY = 4;

    const worker = async () => {
      const wPage = await context.newPage();
      await enableFastMode(wPage);
      while (queue.length > 0) {
        const exam = queue.shift();
        if (!exam) break;
        try {
          await wPage.goto(exam.href, { waitUntil: 'domcontentloaded', timeout: 5000 });
          const result = await wPage.evaluate((examData) => {
            const c = s => (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            const text = c(document.body ? document.body.innerText : '');

            if (/non ci sono appelli/i.test(text)) return null;

            let docente = '';
            let cattedra = '';
            const trs = Array.from(document.querySelectorAll('table tr'));
            for (const tr of trs) {
              const tds = Array.from(tr.querySelectorAll('td')).map(td => c(td.innerText));
              if (tds.length >= 4 && !tds[0].includes('A.A.')) {
                cattedra = tds[2] || '';
                docente = tds[3] || '';
              }
            }

            const matchDocente = text.match(/Docente\s+([A-Z\s\.\'-]+?)\s+Appello del/i);
            if (matchDocente) docente = c(matchDocente[1]);

            const matchDate = text.match(/Appello del:\s*(\d{2}\/\d{2}\/\d{4})/i);
            const dataAppello = matchDate ? matchDate[1] : null;
            const matchAula = text.match(/Aula\s*([^\n\r]+)/i);
            const matchOra = text.match(/Ora Appello\s*(\d{1,2}:\d{2})/i);

            return {
              id: `appello_${examData.code}`,
              codice: examData.code,
              materia: c(examData.name),
              anno: c(examData.year),
              docente: c(docente) || 'Non specificato',
              cattedra,
              dataAppello,
              ora: matchOra ? matchOra[1] : null,
              aula: matchAula ? c(matchAula[1]) : null
            };
          }, exam);

          if (result) appelli.push(result);
        } catch {}
      }
      await wPage.close().catch(() => {});
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  } catch {} finally {
    await page.close().catch(() => {});
  }
  return appelli;
}

module.exports = { scrapeCalendarioAppelli };
