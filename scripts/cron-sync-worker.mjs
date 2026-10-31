import { executeLetterSync } from './sync-legacy-letters.mjs';

// ============================================================================
// PTVPRO — BACKGROUND PERIODIC SYNC WORKER (SERVER-SIDE)
// Safe | Resilient | Strict Read-Only on Legacy | Zero Browser Dependency
// ============================================================================

async function runWorkerIteration() {
  const isLive = process.argv.includes('--live') || process.argv.includes('--execute');
  const hasConfirm = process.argv.includes('--confirm-staging');
  const isOnce = process.argv.includes('--once');
  const intervalMinutes = parseInt(
    process.env.SYNC_INTERVAL_MINUTES ||
    (process.argv.find((a) => a.startsWith('--interval='))?.split('=')[1] ?? '15'),
    10
  );

  console.log(`[${new Date().toISOString()}] Memulai iterasi sinkronisasi Surat & Arsip Legacy...`);
  console.log(`Mode Operasi: INCREMENTAL SYNC | State: ${isLive ? 'LIVE' : 'DRY-RUN'}`);

  try {
    const res = await executeLetterSync({
      mode: 'incremental',
      isDryRun: !isLive,
      sourceMode: 'cloud',
      requireOperatorConfirmation: hasConfirm,
    });

    console.log(`[${new Date().toISOString()}] Iterasi selesai sukses.`);
    console.log(` - Total Legacy Ditelusuri : ${res.counts.legacy_total}`);
    console.log(` - Dokumen Siap / Tersinkron : ${res.counts.synced_ready}`);
    console.log(` - Konflik Karantina        : ${res.counts.conflicts_quarantined}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Kesalahan iterasi worker:`, err.message);
  }

  if (!isOnce) {
    const delayMs = Math.max(1, intervalMinutes) * 60 * 1000;
    console.log(`Menunggu ${intervalMinutes} menit untuk iterasi berikutnya...\n`);
    setTimeout(runWorkerIteration, delayMs);
  }
}

if (process.argv[1] && process.argv[1].endsWith('cron-sync-worker.mjs')) {
  console.log('='.repeat(75));
  console.log('PTVPRO — BACKGROUND PERIODIC SYNC WORKER INITIATED');
  console.log('='.repeat(75));
  runWorkerIteration().catch(console.error);
}
