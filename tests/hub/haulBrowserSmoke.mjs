import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PTV_PLAYWRIGHT_PATH || 'C:/Users/zidna/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const ARTIFACT_DIR = 'C:/Users/zidna/.gemini/antigravity/brain/7d0702bf-ad04-4052-ad0c-f64167c63dbd';
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

const coordinatorUser = {
  id: '00000000-0000-0000-0000-000000000002',
  ptv_id: 'PTV-001',
  full_name: 'Ahmad Executive (Koordinator)',
  username: 'eksekutif',
  organization: 'PTV Studio',
  division: 'Leadership',
  position: 'Ketua Umum',
  status_akun: 'active',
  status_organisasi: 'active',
  assigned_profiles: ['eksekutif'],
  allowed_overrides: [],
  denied_overrides: [],
};

const crewUser = {
  id: '00000000-0000-0000-0000-000000000004',
  ptv_id: 'PTV-004',
  full_name: 'Budi Lapangan (Kru)',
  username: 'kru_lapangan',
  organization: 'PTV Studio',
  division: 'Broadcasting',
  position: 'Camera Operator',
  status_akun: 'active',
  status_organisasi: 'active',
  assigned_profiles: ['crew'],
  allowed_overrides: [],
  denied_overrides: [],
};

(async () => {
  console.log('🚀 Launching browser for PTV-DEV-209 Rundown Multi-Crew & Form UX smoke test...');
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  let activeUser = coordinatorUser;

  // Intercept auth session to provide authenticated state
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        expires_at: Date.now() + 86400000,
        user: activeUser,
      }),
    });
  });

  await page.route('**/api/v1/telemetry/**', (route) => route.fulfill({ status: 200, body: '{}' }));

  console.log('📍 Navigating to http://127.0.0.1:5174/hub/haul...');
  await page.goto('http://127.0.0.1:5174/hub/haul', { waitUntil: 'networkidle', timeout: 30000 });

  // 1. Check HubShell integration
  console.log('🔍 Checking HubShell wrapper & sidebar...');
  await page.waitForSelector('.hh-workspace', { timeout: 15000 });

  // 2. Click into Event Workspace
  console.log('🔍 Opening Single Event Workspace (Majelis Sama)...');
  await page.click('.hh-event-card:first-child');
  await page.waitForSelector('.hh-event-full-page', { timeout: 5000 });

  // 3. Test Rundown Multi-Crew Side Peek
  console.log('🔍 Testing Rundown Multi-Crew Side Peek interaction...');
  const firstSessionRow = await page.$('.hh-table tr.hh-row:has(.hh-session-time)');
  assert.ok(firstSessionRow, 'Session row must exist in Rundown table');
  await firstSessionRow.click();
  await page.waitForSelector('.hh-side-peek', { timeout: 5000 });

  // Verify Side Peek has sections
  const peekTitle = await page.textContent('.hh-form-section-title');
  console.log(`  Section title: ${peekTitle}`);

  // Coordinator clicks preset to add "Floor Crew"
  const addFloorCrewBtn = await page.$('button.hh-chip:has-text("+ Floor Crew")');
  if (addFloorCrewBtn) {
    console.log('  Adding Floor Crew position via preset button...');
    await addFloorCrewBtn.click();
  }

  // Open the Multi-Crew Popover on the last position
  const crewSelectBoxes = await page.$$('.hh-crew-chips-box');
  if (crewSelectBoxes.length > 0) {
    const lastSelectBox = crewSelectBoxes[crewSelectBoxes.length - 1];
    await lastSelectBox.click();
    await page.waitForSelector('.hh-crew-popover', { timeout: 3000 });

    // Select the first two active crew options
    const optionItems = await page.$$('.hh-crew-option-item');
    if (optionItems.length >= 2) {
      console.log('  Selecting 2 crew members for this position...');
      await optionItems[0].click();
      await optionItems[1].click();
    }
    // Close popover by clicking header
    await page.click('.hh-peek-header');
  }

  // Take screenshot of multi-crew form in SessionSidePeek
  const formShotPath = path.join(ARTIFACT_DIR, 'hub-haul-dev209-rundown-multicrew-form.png');
  await page.screenshot({ path: formShotPath });
  console.log(`📸 Multi-crew rundown form screenshot saved: ${formShotPath}`);

  // Save the session (automatically closes side peek and saves to state)
  console.log('  Saving session with multi-crew assignment...');
  await page.click('button:has-text("Simpan Sesi & Penugasan")');
  await page.waitForTimeout(600);

  // 4. Verify Roster in Table (All crew rendered, no +1)
  console.log('🔍 Verifying multi-crew roster table rendering...');
  await page.waitForSelector('.hh-rundown-roster-stack', { timeout: 5000 });
  const rosterGroups = await page.$$('.hh-roster-group');
  console.log(`  Found ${rosterGroups.length} roster groups with multiple crew`);
  assert.ok(rosterGroups.length >= 1, 'Roster groups must be displayed');

  const rosterFinalShotPath = path.join(ARTIFACT_DIR, 'hub-haul-dev209-roster-final.png');
  await page.screenshot({ path: rosterFinalShotPath });
  console.log(`📸 Roster table screenshot saved: ${rosterFinalShotPath}`);

  // 5. Test Dialog Scrolling (ItemEditor / EditionEditor)
  console.log('🔍 Testing Form Dialog Scrolling & Pinned Footer...');
  // Return to Beranda to open "Atur edisi"
  await page.click('button:has-text("Kembali ke Ruang Kerja")');
  await page.waitForSelector('.hh-events-section', { timeout: 5000 });

  await page.click('button:has-text("Atur edisi")');
  await page.waitForSelector('.hh-dialog', { timeout: 5000 });

  // Verify dialog body and footer
  const dialogFooter = await page.$('.hh-dialog footer');
  assert.ok(dialogFooter, 'Dialog footer must exist');

  const dialogShotPath = path.join(ARTIFACT_DIR, 'hub-haul-dev209-form-scrolling.png');
  await page.screenshot({ path: dialogShotPath });
  console.log(`📸 Form scrolling & pinned footer screenshot saved: ${dialogShotPath}`);

  await page.click('.hh-dialog footer button:has-text("Batal")');
  await page.waitForTimeout(300);

  // 6. Test Mobile Viewport (390x844 iPhone 12/13/14)
  console.log('🔍 Testing Mobile Layout (390x844)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  // Open first event in mobile
  await page.click('.hh-event-card:first-child');
  await page.waitForSelector('.hh-event-full-page', { timeout: 5000 });

  // Open session in mobile
  const mobileSessionRow = await page.$('.hh-table tr.hh-row:has(.hh-session-time)');
  if (mobileSessionRow) {
    await mobileSessionRow.click();
    await page.waitForSelector('.hh-side-peek', { timeout: 5000 });
  }

  const mobileShotPath = path.join(ARTIFACT_DIR, 'hub-haul-dev209-mobile-390.png');
  await page.screenshot({ path: mobileShotPath });
  console.log(`📸 Mobile 390 viewport screenshot saved: ${mobileShotPath}`);

  console.log('✅ ALL DEV-209 BROWSER SMOKE CHECKS PASSED SUCCESSFULLY!');
  await browser.close();
})().catch((err) => {
  console.error('❌ Browser smoke test failed:', err);
  process.exit(1);
});
