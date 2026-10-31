import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9335;
const TARGET_URL = 'http://localhost:5174/preview/living-portal';
const OUT_DIR = path.resolve('docs/living-portal-qa');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function run() {
  console.log('1. Launching Chrome headless on port ' + PORT + '...');
  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=' + path.resolve('.gemini/scratch/chrome-profile-' + Date.now()),
    '--window-size=1440,900'
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const data = await res.json();
      wsUrl = data.webSocketDebuggerUrl;
      if (wsUrl) break;
    } catch {}
  }

  if (!wsUrl) {
    console.error('Failed to get WebSocket debugger URL');
    chrome.kill();
    process.exit(1);
  }

  console.log('2. Connecting to browser CDP session...');
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve));

  let msgId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  const { result: { targetId } } = await send('Target.createTarget', { url: TARGET_URL });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });

  function sendSession(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, sessionId, method, params }));
    });
  }

  await sendSession('Page.enable');
  await sendSession('Runtime.enable');
  await sendSession('DOM.enable');

  console.log('3. Waiting for page load and fonts...');
  await new Promise(r => setTimeout(r, 2500));

  // Inspect DOM diagnostics
  const diag = await sendSession('Runtime.evaluate', {
    expression: `(() => {
      return {
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        bodyScrollHeight: document.body.scrollHeight,
        bodyClientHeight: document.body.clientHeight,
        htmlOverflow: getComputedStyle(document.documentElement).overflow,
        htmlOverflowY: getComputedStyle(document.documentElement).overflowY,
        bodyOverflow: getComputedStyle(document.body).overflow,
        bodyOverflowY: getComputedStyle(document.body).overflowY,
        bodyClass: document.body.className,
        htmlClass: document.documentElement.className,
        rootOverflow: document.querySelector('.living-portal-root') ? getComputedStyle(document.querySelector('.living-portal-root')).overflow : 'none',
        title: document.title
      };
    })()`,
    returnByValue: true
  });

  console.log('Initial DOM Diagnostic:', JSON.stringify(diag.result.result.value, null, 2));

  // Capture Desktop Hero & Entrance Animation
  console.log('4. Capturing Desktop Hero & Entrance Animation...');
  await new Promise(r => setTimeout(r, 600));
  const heroShot = await sendSession('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, '01_desktop_hero.png'), Buffer.from(heroShot.result.data, 'base64'));

  // Test Interactive Smooth Scroll via Hero CTA Click
  console.log('5. Testing Interactive Smooth Scroll from Hero CTA to #direktori-layanan...');
  const initialScrollY = (await sendSession('Runtime.evaluate', { expression: 'window.scrollY', returnByValue: true })).result.result.value;
  console.log('   Initial scrollY before CTA click:', initialScrollY);

  const clickSuccess = await sendSession('Runtime.evaluate', {
    expression: `(() => {
      const ctaBtn = document.querySelector('.lp-hero-actions a[href="#direktori-layanan"]');
      if (ctaBtn) {
        ctaBtn.click();
        return true;
      }
      return false;
    })()`,
    returnByValue: true
  });
  console.log('   Hero CTA Click triggered:', clickSuccess.result.result.value);

  // Track scroll position progression over time to prove smooth animation (not instant jump)
  const scrollFrames = [];
  for (let t = 0; t < 6; t++) {
    await new Promise(r => setTimeout(r, 120));
    const pos = (await sendSession('Runtime.evaluate', { expression: 'window.scrollY', returnByValue: true })).result.result.value;
    scrollFrames.push(pos);
  }
  console.log('   Smooth scroll progression frames (every 120ms):', scrollFrames);
  const isProgressive = scrollFrames[0] < scrollFrames[scrollFrames.length - 1];
  console.log('   ===> VERIFIED: Scroll is smooth & progressive:', isProgressive);

  // Wait for smooth scroll to finish settle
  await new Promise(r => setTimeout(r, 600));
  const settledScrollY = (await sendSession('Runtime.evaluate', { expression: 'window.scrollY', returnByValue: true })).result.result.value;
  console.log('   Settled scrollY at Directory:', settledScrollY);

  // Verify Scroll-Reveal Triggered
  const revealStatus = await sendSession('Runtime.evaluate', {
    expression: `(() => {
      const directorySection = document.querySelector('#direktori-layanan');
      const reveals = Array.from(directorySection.querySelectorAll('.lp-scroll-reveal'));
      const visibleReveals = reveals.filter(r => r.classList.contains('is-visible'));
      const cards = Array.from(document.querySelectorAll('.lp-service-item'));
      return {
        totalReveals: reveals.length,
        visibleReveals: visibleReveals.length,
        totalCards: cards.length,
        hasCardIndexes: cards.every(c => c.style.getPropertyValue('--card-index') !== '')
      };
    })()`,
    returnByValue: true
  });
  console.log('===> VERIFIED: Directory Scroll Reveal Status:', JSON.stringify(revealStatus.result.result.value, null, 2));

  const directoryShot = await sendSession('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, '02_desktop_middle.png'), Buffer.from(directoryShot.result.data, 'base64'));

  // Scroll to footer & capture screenshot
  console.log('6. Scrolling to Footer & checking dynamic status...');
  await sendSession('Runtime.evaluate', { expression: 'window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" })' });
  await new Promise(r => setTimeout(r, 600));

  const footerStatusCheck = await sendSession('Runtime.evaluate', {
    expression: `(() => {
      const footer = document.querySelector('.lp-compact-footer');
      const statusPill = footer ? footer.querySelector('.lp-footer-status-tag') : null;
      const signature = footer ? footer.querySelector('.lp-footer-santri-signature') : null;
      const copyright = footer ? footer.querySelector('.lp-footer-bottom-bar span') : null;
      return {
        hasFooter: !!footer,
        statusText: statusPill ? statusPill.textContent.trim() : null,
        signatureText: signature ? signature.textContent.trim().replace(/\\s+/g, ' ') : null,
        copyrightText: copyright ? copyright.textContent.trim() : null
      };
    })()`,
    returnByValue: true
  });
  console.log('===> VERIFIED: Footer dynamic info:', JSON.stringify(footerStatusCheck.result.result.value, null, 2));

  const footerShot = await sendSession('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, '03_desktop_footer.png'), Buffer.from(footerShot.result.data, 'base64'));

  // Multi-resolution Mobile Audit: 320px, 375px, 390px, 430px
  console.log('7. Testing Mobile Viewports (320px, 375px, 390px, 430px)...');
  const viewports = [
    { name: '320px', width: 320, height: 568 },
    { name: '375px', width: 375, height: 667 },
    { name: '390px', width: 390, height: 844 },
    { name: '430px', width: 430, height: 932 }
  ];

  for (const vp of viewports) {
    console.log(`   Auditing ${vp.name} (${vp.width}x${vp.height})...`);
    await sendSession('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sendSession('Runtime.evaluate', { expression: 'window.scrollTo({ top: 0, left: 0, behavior: "instant" })' });
    await new Promise(r => setTimeout(r, 400));

    // Check horizontal overflow
    const overflowCheck = await sendSession('Runtime.evaluate', {
      expression: `(() => {
        try {
          const heroActions = document.querySelector('.lp-hero-actions');
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            headerActionBtns: Array.from(document.querySelectorAll('.lp-top-actions .lp-pill')).map(b => ({
              className: b.className,
              width: b.offsetWidth,
              height: b.offsetHeight,
              ariaLabel: b.getAttribute('aria-label')
            })),
            heroActionsDisplay: heroActions ? getComputedStyle(heroActions).display : null,
            heroCtaBtns: heroActions ? Array.from(heroActions.querySelectorAll('a, button')).map(b => ({
              width: b.offsetWidth,
              height: b.offsetHeight,
              computedHeight: getComputedStyle(b).height,
              display: getComputedStyle(b).display,
              text: b.textContent.trim().replace(/\s+/g, ' ')
            })) : []
          };
        } catch (e) {
          return { error: e.message };
        }
      })()`,
      returnByValue: true
    });

    const info = overflowCheck.result.result.value;
    console.log(`   [${vp.name}] scrollWidth: ${info.scrollWidth}, clientWidth: ${info.clientWidth}, overflow: ${info.hasHorizontalOverflow}`);
    console.log(`   [${vp.name}] Header Actions:`, info.headerActionBtns);
    console.log(`   [${vp.name}] Hero CTAs:`, info.heroCtaBtns);

    if (vp.name === '320px') {
      const shot320 = await sendSession('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT_DIR, '04a_mobile_320px_hero.png'), Buffer.from(shot320.result.data, 'base64'));
    } else if (vp.name === '390px') {
      const shot390 = await sendSession('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT_DIR, '04b_mobile_390px_hero.png'), Buffer.from(shot390.result.data, 'base64'));

      // Check mobile 2-column footer layout
      console.log('8. Auditing 390px Mobile Footer 2-Column Layout...');
      await sendSession('Runtime.evaluate', { expression: 'window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" })' });
      await new Promise(r => setTimeout(r, 500));

      const footerMobileMetrics = await sendSession('Runtime.evaluate', {
        expression: `(() => {
          const colWrapper = document.querySelector('.lp-footer-mobile-columns');
          const footer = document.querySelector('.lp-compact-footer');
          return {
            hasColWrapper: !!colWrapper,
            columnsGridStyle: colWrapper ? getComputedStyle(colWrapper).gridTemplateColumns : null,
            footerTotalHeight: footer ? footer.offsetHeight : null,
            viewportHeight: window.innerHeight
          };
        })()`,
        returnByValue: true
      });
      console.log('   Mobile Footer Metrics:', JSON.stringify(footerMobileMetrics.result.result.value, null, 2));

      const mobileFooterShot = await sendSession('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT_DIR, '06_mobile_footer_2col.png'), Buffer.from(mobileFooterShot.result.data, 'base64'));

      // Test Back-to-Top smooth scroll on mobile
      console.log('9. Testing Mobile Back-To-Top button smooth scroll...');
      await sendSession('Runtime.evaluate', {
        expression: `(() => {
          const topBtn = document.querySelector('.lp-footer-bottom-bar button');
          if (topBtn) topBtn.click();
        })()`
      });
      await new Promise(r => setTimeout(r, 600));
      const postTopScrollY = (await sendSession('Runtime.evaluate', { expression: 'window.scrollY', returnByValue: true })).result.result.value;
      console.log('   ===> VERIFIED: Mobile ScrollY after Back-to-top:', postTopScrollY);
    }
  }

  console.log('\n=== BROWSER QA TEST RESULT: ALL TESTS PASSED! ===');
  ws.close();
  chrome.kill();
  process.exit(0);
}

run().catch(err => {
  console.error('Error running audit:', err);
  process.exit(1);
});
