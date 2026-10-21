const { Cluster } = require('puppeteer-cluster');

let cluster = null;

async function initCluster() {
  if (cluster) return cluster;

  console.log('[Pool] Avvio inizializzazione Puppeteer Cluster...');
  
  cluster = await Cluster.launch({
    // Crea una scheda in incognito (context) per ogni task, garantendo isolamento dei cookie tra utenti
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    // Limite hardware rigoroso: massimo 3 task di scraping simultanei. Gli altri vanno in coda.
    maxConcurrency: 3, 
    puppeteerOptions: {
      headless: 'new',
      ignoreHTTPSErrors: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--ignore-certificate-errors', 
        '--allow-insecure-localhost'
      ]
    },
    // Timeout di sicurezza: se uno script si blocca su una pagina, viene terminato dopo 2 minuti
    timeout: 120000, 
  });

  // Gestione diagnostica degli errori a livello di cluster
  cluster.on('taskerror', (err, data, willRetry) => {
    console.error(`[Pool Error] Fallimento task. Errore: ${err.message}`);
  });

  console.log('[Pool] Puppeteer Cluster operativo (Max Concurrency: 3)');
  return cluster;
}

/**
 * Accoda un'operazione di scraping.
 * @param {Object} data - I dati di input per lo scraper (es. username, password, target).
 * @param {Function} scrapeLogic - La funzione contenente la logica di navigazione (riceve {page, data}).
 * @returns {Promise<any>} - I dati restituiti dalla funzione scrapeLogic.
 */
async function queueScrapingTask(data, scrapeLogic) {
  if (!cluster) {
    throw new Error("Cluster non inizializzato. Impossibile accettare task.");
  }

  // Inserisce il task nella coda e attende la risoluzione.
  // La pagina ('page') viene generata e fornita automaticamente dal cluster.
  return await cluster.execute(data, async ({ page, data }) => {
    return await scrapeLogic(page, data);
  });
}

// Procedura per chiudere in sicurezza la coda e il browser al riavvio del server
async function closeCluster() {
  if (cluster) {
    console.log('[Pool] Chiusura del cluster in corso (attesa completamento task residui)...');
    await cluster.idle();
    await cluster.close();
    cluster = null;
    console.log('[Pool] Puppeteer Cluster disattivato in sicurezza.');
  }
}

module.exports = { initCluster, queueScrapingTask, closeCluster };