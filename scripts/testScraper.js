const { getDatiCarriera } = require('../scraper/segrepass');

async function testScraper() {
  const codiceFiscale = process.env.SEGREPASS_CF;
  const password = process.env.SEGREPASS_PASS;

  if (!codiceFiscale || !password) {
    console.error('⚠️ Inserisci Codice Fiscale e Password nelle variabili di ambiente.');
    process.exit(1);
  }

  console.log('🚀 Avvio test dello scraper Segrepass...\n');
  const startTime = Date.now();

  try {
    const data = await getDatiCarriera({ codiceFiscale, password });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Scraping completato in ${elapsed}s!\n`);
    
    console.log('📌 1. ANAGRAFICA ESTRATTA:');
    console.dir(data.anagrafica, { colors: true });

    console.log('\n📌 2. SINTESI ESAMI:');
    console.log(`Numero di esami trovati: ${data.tabellaEsami.rowCount}`);
    if (data.tabellaEsami.records && data.tabellaEsami.records.length > 0) {
      console.log('Ultimi 3 esami in libretto:');
      console.dir(data.tabellaEsami.records.slice(0, 3), { colors: true });
    }

    console.log('\n📌 3. TASSE & PAGAMENTI:');
    console.log(`- Disponibile: ${data.taxes.available}`);
    console.log(`- Versamenti Pagati: ${data.taxes.paid.length} (Totale: € ${data.taxes.summary.totalPaid})`);
    console.dir(data.taxes.paid, { colors: true });

    console.log(`- Versamenti In Debito: ${data.taxes.pending.length} (Totale: € ${data.taxes.summary.totalPending})`);
    console.dir(data.taxes.pending, { colors: true });

  } catch (error) {
    console.error('❌ Errore durante lo scraping:', error.message);
  }
}

testScraper();
