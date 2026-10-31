const { chromium } = require(process.env.PTV_PLAYWRIGHT_PATH || 'C:/Users/zidna/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.route('**/api/**', route => route.abort());
    await page.route('**/__dev192_cache_test', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto('http://127.0.0.1:5174/__dev192_cache_test');
    const results = await page.evaluate(async () => {
      const ReactModule = await import('/node_modules/.vite/deps/react.js');
      const React = ReactModule.default || ReactModule;
      const domModule = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { createRoot } = domModule.default || domModule;
      const { useInstantData } = await import('/src/shared/hooks/useInstantData.ts');
      const { ptvCache } = await import('/src/core/cache/ptvCache.ts');
      const root = createRoot(document.getElementById('root'));
      const wait = () => new Promise(resolve => setTimeout(resolve, 35));
      let current, props, fetches = 0;
      const results = [];
      function Harness() { current = useInstantData(props); return React.createElement('span', null, JSON.stringify(current.data)); }
      const render = async (next) => { props = next; root.render(React.createElement(React.StrictMode, null, React.createElement(Harness))); await wait(); };
      const check = (name, pass) => { results.push({ name, pass }); if (!pass) throw new Error(name); };
      ptvCache.setActiveUser('synthetic-a');
      await render({ key: 'test-list', initialData: [], fetcher: async () => { fetches++; return ['a']; }, onSuccess: () => {} });
      check('StrictMode completes fetch', current.data[0] === 'a' && !current.isLoading);
      const baseline = fetches;
      await render({ ...props, onSuccess: () => {} });
      check('callback identity does not restart fetch', fetches === baseline);
      let resolveOld;
      props = { ...props, fetcher: () => new Promise(resolve => { resolveOld = resolve; }) };
      await render(props);
      const pending = current.refetch(); await wait();
      current.mutate(['saved']); resolveOld(['stale']); await pending; await wait();
      check('late read cannot overwrite saved mutation', current.data[0] === 'saved');
      props = { ...props, fetcher: async () => { fetches++; return ['fresh']; } };
      await render(props);
      const beforeInvalidation = fetches;
      ptvCache.invalidate('test-list'); await wait();
      check('one invalidation causes one fetch', fetches === beforeInvalidation + 1 && current.data[0] === 'fresh');
      props = { ...props, fetcher: () => new Promise(resolve => { resolveOld = resolve; }) };
      await render(props);
      const oldAccountRead = current.refetch(); await wait();
      props = { ...props, fetcher: async () => ['b'] };
      ptvCache.setActiveUser('synthetic-b'); await wait();
      resolveOld(['private-a']); await oldAccountRead; await wait();
      check('account switch rejects old response', current.data[0] === 'b' && ptvCache.get('test-list').data[0] === 'b');
      await render({ ...props, key: 'different-list', fetcher: async () => ['different'] });
      check('key switch hydrates correct data', current.data[0] === 'different');
      const beforeDisabled = fetches;
      await render({ ...props, enabled: false, fetcher: async () => { fetches++; return ['forbidden']; } });
      check('disabled hook neither exposes cache nor fetches', fetches === beforeDisabled && !current.isLoading && current.data.length === 0);
      ptvCache.setActiveUser(null); await wait();
      check('logout removes previous persistent partition', localStorage.getItem('ptv_cache_v1_synthetic-b') === null);
      root.unmount();
      return results;
    });
    assert(results.every(result => result.pass));
    console.log(JSON.stringify({ passed: results.length, results }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });

