const test = require('node:test');
const assert = require('node:assert/strict');
const { acquireBrowserContext } = require('../scraper/pool');

test('releases a shared browser context once even if cleanup is repeated', async () => {
  let closeCount = 0;
  const context = { close: async () => { closeCount += 1; } };
  const browser = { createBrowserContext: async () => context };

  const lease = await acquireBrowserContext(async () => browser);
  assert.equal(lease.context, context);

  await lease.close();
  await lease.close();
  assert.equal(closeCount, 1);
});

test('releases the pool activity reservation if context creation fails', async () => {
  const error = new Error('create context failed');
  const browser = { createBrowserContext: async () => { throw error; } };

  await assert.rejects(acquireBrowserContext(async () => browser), error);
});
