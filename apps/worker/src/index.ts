import { CONFIG } from './config.ts';
import { browserPool } from './browser.ts';
import { runAudit } from './audit.ts';
import { db, loadSourceOfTruth, markFailed, markRunning, saveResults } from './store.ts';

type QueueMessage = {
  msg_id: number;
  read_ct: number;
  message: { audit_id: string; tenant_id: string; location_id: string; sot_id: string };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let shuttingDown = false;

async function claim(): Promise<QueueMessage | null> {
  const { data, error } = await db.rpc('nap_queue_read', {
    p_vt: CONFIG.visibilityTimeoutSec,
    p_qty: 1,
  });
  if (error) throw new Error(`Queue read failed: ${error.message}`);
  // `message` comes back as Json — deliberately wider than the job shape — so
  // the narrowing goes through unknown. The shape is guaranteed by
  // enqueue_nap_audit, which is the only writer to this queue.
  return (data as unknown as QueueMessage[] | null)?.[0] ?? null;
}

async function handle(job: QueueMessage): Promise<void> {
  const { audit_id, tenant_id, sot_id } = job.message;
  const started = Date.now();
  console.log(`[audit ${audit_id.slice(0, 8)}] claimed (attempt ${job.read_ct})`);

  try {
    await markRunning(audit_id);
    const source = await loadSourceOfTruth(sot_id);
    const { results, summary } = await runAudit(source);
    await saveResults(audit_id, tenant_id, results, summary);

    await db.rpc('nap_queue_delete', { p_msg_id: job.msg_id });
    console.log(
      `[audit ${audit_id.slice(0, 8)}] done in ${Date.now() - started}ms — ` +
        `score ${summary.auditScore ?? 'n/a'}, coverage ${summary.coveragePct}%, ` +
        `${summary.directoriesErrored} errored`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[audit ${audit_id.slice(0, 8)}] failed (attempt ${job.read_ct}): ${message}`);

    // Give up only after maxAttempts. Below that the message is simply left
    // alone: its visibility timeout expires and another worker picks it up.
    // No status juggling, so a crash mid-job cannot strand it the way the
    // retired worker's PROCESSING state did.
    if (job.read_ct >= CONFIG.maxAttempts) {
      await markFailed(audit_id, message);
      await db.rpc('nap_queue_archive', { p_msg_id: job.msg_id });
      console.error(`[audit ${audit_id.slice(0, 8)}] archived to dead letter after ${job.read_ct} attempts`);
    }
  }
}

async function main(): Promise<void> {
  console.log(
    `NAP audit worker starting — concurrency ${CONFIG.concurrency}, ` +
      `visibility ${CONFIG.visibilityTimeoutSec}s, ` +
      (CONFIG.playwrightWsEndpoint ? 'remote browser' : 'local Chromium'),
  );

  while (!shuttingDown) {
    try {
      const job = await claim();
      if (!job) {
        await sleep(CONFIG.pollIntervalMs);
        continue;
      }
      await handle(job);
    } catch (err) {
      // Never let the loop die: a transient database blip should back off, not
      // take the worker down and leave the queue unattended.
      console.error('Worker loop error:', err instanceof Error ? err.message : err);
      await sleep(CONFIG.pollIntervalMs);
    }
  }
}

// Finish the job in hand before exiting, so a deploy does not orphan work.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    if (shuttingDown) process.exit(1); // second signal: leave now
    console.log(`${signal} received — finishing the current job, then exiting.`);
    shuttingDown = true;
    void browserPool.close();
  });
}

main().catch((err) => {
  console.error('Worker crashed:', err);
  process.exit(1);
});
