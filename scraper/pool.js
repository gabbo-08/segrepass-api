const puppeteer = require('puppeteer');

let _browser = null;
let _launchPromise = null;
let _browserClosePromise = null;
let _lastActivity = Date.now();
let _activeContexts = 0;
const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minuti di inattività

async function getBrowser() {
  if (_browserClosePromise) await _browserClosePromise;
  _lastActivity = Date.now();
  if (!_browser || !_browser.connected) {
    if (!_launchPromise) {
      console.log('[pool] Avvio Chromium...');
      _launchPromise = puppeteer.launch({
        headless: true,
        ignoreHTTPSErrors: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      }).then(browser => {
        _browser = browser;
        return browser;
      }).finally(() => { _launchPromise = null; });
    }
    return _launchPromise;
  }
  return _browser;
}

async function acquireBrowserContext(browserGetter = getBrowser) {
  const browser = await browserGetter();
  _activeContexts += 1;
  _lastActivity = Date.now();
  let context;
  try {
    context = await browser.createBrowserContext();
  } catch (error) {
    _activeContexts -= 1;
    _lastActivity = Date.now();
    throw error;
  }

  let released = false;
  return {
    browser,
    context,
    close: async () => {
      if (released) return;
      released = true;
      try {
        await context.close();
      } catch {}
      finally {
        _activeContexts = Math.max(0, _activeContexts - 1);
        _lastActivity = Date.now();
      }
    }
  };
}

async function closeBrowser() {
  if (_activeContexts > 0 || _browserClosePromise) return _browserClosePromise;
  const browser = _browser;
  _browser = null;
  if (browser && browser.connected) {
    console.log('[pool] Chiusura Chromium per inattività...');
    _browserClosePromise = browser.close().catch(() => {}).finally(() => {
      _browserClosePromise = null;
    });
    await _browserClosePromise;
  }
}

// Timer di pulizia per liberare RAM senza interrompere scrape attivi.
const interval = setInterval(async () => {
  if (_browser && _browser.connected && _activeContexts === 0 && Date.now() - _lastActivity > IDLE_TIMEOUT_MS) {
    await closeBrowser();
  }
}, 30000);

if (interval.unref) interval.unref();

module.exports = { getBrowser, acquireBrowserContext, closeBrowser };
