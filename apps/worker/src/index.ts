import { CONFIG } from './config.ts';
import { browserPool } from './browser.ts';
import { runAudit } from './audit.ts';
import { runVisibilityAudit } from './visibility.ts';
import { planScan, runMapScan, selectProvider } from './mapRank.ts';
import {
  db,
  finaliseMapScan,
  loadCompletedPoints,
  loadScanTarget,
  loadSourceOfTruth,
  markFailed,
  markMapScanFailed,
  markMapScanRunning,
  markRunning,
  markVisibilityFailed,
  markVisibilityRunning,
  saveResults,
  saveScanPoint,
  saveVisibilityResults,
} from './store.ts';

type Job<M> = { msg_id: number; read_ct: number; message: M };

type NapMessage = { audit_id: string; tenant_id: string; location_id: string; sot_id: string };
type VisibilityMessage = {
  audit_id: string;
  tenant_id: string;
  location_id: string;
  website_url: string | null;
};
type MapMessage = {
  scan_id: string;
  tenant_id: string;
  location_id: string;
  keyword: string;
};

/**
 * One worker process, three queues.
 *
 * Separate queues rather than a job-type column on one, because the three have
 * genuinely different shapes: a NAP audit crawls five directories on a shared
 * browser, a visibility audit reads one page and waits on Lighthouse, and a map
 * scan makes 81 paced, cost-bearing lookups over several minutes. A slow one of
 * any kind must not sit in front of the others, and they need different
 * visibility timeouts.
 */
interface Pipeline<M> {
  label: string;
  claim(): Promise<Job<M> | null>;
  run(job: Job<M>): Promise<string>;
  complete(job: Job<M>): Promise<void>;
  giveUp(job: Job<M>, message: string): Promise<void>;
  auditId(job: Job<M>): string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let shuttingDown = false;

const napPipeline: Pipeline<NapMessage> = {
  label: 'nap',
  async claim() {
    const { data, error } = await db.rpc('nap_queue_read', {
      p_vt: CONFIG.visibilityTimeoutSec,
      p_qty: 1,
    });
    if (error) throw new Error(`Queue read failed: ${error.message}`);
    // `message` comes back as Json — deliberately wider than the job shape — so
    // the narrowing goes through unknown. The shape is guaranteed by
    // enqueue_nap_audit, which is the only writer to this queue.
    return (data as unknown as Job<NapMessage>[] | null)?.[0] ?? null;
  },
  auditId: (job) => job.message.audit_id,
  async run(job) {
    const { audit_id, tenant_id, sot_id } = job.message;
    await markRunning(audit_id);
    const source = await loadSourceOfTruth(sot_id);
    const { results, summary, compliance } = await runAudit(source);
    await saveResults(audit_id, tenant_id, results, summary, compliance);
    return (
      `score ${summary.auditScore ?? 'n/a'}, coverage ${summary.coveragePct}%, ` +
      `${summary.directoriesErrored} errored` +
      (compliance ? `, compliance ${compliance.score} (${compliance.isCompliant ? 'ok' : 'flagged'})` : '')
    );
  },
  async complete(job) {
    await db.rpc('nap_queue_delete', { p_msg_id: job.msg_id });
  },
  async giveUp(job, message) {
    await markFailed(job.message.audit_id, message);
    await db.rpc('nap_queue_archive', { p_msg_id: job.msg_id });
  },
};

const visibilityPipeline: Pipeline<VisibilityMessage> = {
  label: 'visibility',
  async claim() {
    const { data, error } = await db.rpc('visibility_queue_read', {
      p_vt: CONFIG.visibilityTimeoutSec,
      p_qty: 1,
    });
    if (error) throw new Error(`Queue read failed: ${error.message}`);
    return (data as unknown as Job<VisibilityMessage>[] | null)?.[0] ?? null;
  },
  auditId: (job) => job.message.audit_id,
  async run(job) {
    const { audit_id, tenant_id, location_id, website_url } = job.message;
    await markVisibilityRunning(audit_id);
    const result = await runVisibilityAudit(location_id, website_url);
    await saveVisibilityResults(audit_id, tenant_id, result);
    const measured = result.composite.pillars.filter((p) => p.measured).length;
    return `score ${result.composite.score ?? 'n/a'}, coverage ${result.composite.coveragePct}% (${measured}/6 pillars)`;
  },
  async complete(job) {
    await db.rpc('visibility_queue_delete', { p_msg_id: job.msg_id });
  },
  async giveUp(job, message) {
    await markVisibilityFailed(job.message.audit_id, message);
    await db.rpc('visibility_queue_archive', { p_msg_id: job.msg_id });
  },
};

const mapPipeline: Pipeline<MapMessage> = {
  label: 'map',
  async claim() {
    const { data, error } = await db.rpc('map_queue_read', {
      p_vt: CONFIG.mapVisibilityTimeoutSec,
      p_qty: 1,
    });
    if (error) throw new Error(`Queue read failed: ${error.message}`);
    return (data as unknown as Job<MapMessage>[] | null)?.[0] ?? null;
  },
  auditId: (job) => job.message.scan_id,
  async run(job) {
    const target = await loadScanTarget(job.message.scan_id);
    const provider = selectProvider(target);
    const plan = planScan(target, provider);
    await markMapScanRunning(target.scanId, provider.code, plan.zoom, plan.fingerprint);

    // A redelivered job resumes from what the last attempt finished. Without
    // this, every retry rescans all 81 points and bills for them again.
    const done = await loadCompletedPoints(target.scanId);

    const run = await runMapScan(target, provider, done, async (result) => {
      await saveScanPoint(target.scanId, target.tenantId, result);
      // Extend the lease as we go. A paced grid outruns any fixed visibility
      // timeout, and a lapsed one means a second worker starts the same scan.
      await db.rpc('map_queue_heartbeat', {
        p_msg_id: job.msg_id,
        p_vt: CONFIG.mapVisibilityTimeoutSec,
      });
    });

    await finaliseMapScan(run, target);

    const m = run.metrics;
    const resumed = done.size > 0 ? `, resumed ${done.size}` : '';
    return (
      `"${target.keyword}" via ${run.providerCode} — score ${m.score ?? 'n/a'}, ` +
      `SoLV ${m.solv}%, ARP ${m.arp ?? 'nowhere'}, ` +
      `coverage ${m.coveragePct}% (${m.pointsScanned}/${m.pointsRequested}${resumed})`
    );
  },
  async complete(job) {
    await db.rpc('map_queue_delete', { p_msg_id: job.msg_id });
  },
  async giveUp(job, message) {
    await markMapScanFailed(job.message.scan_id, message);
    await db.rpc('map_queue_archive', { p_msg_id: job.msg_id });
  },
};

async function handle<M>(pipeline: Pipeline<M>, job: Job<M>): Promise<void> {
  const id = pipeline.auditId(job).slice(0, 8);
  const tag = `[${pipeline.label} ${id}]`;
  const started = Date.now();
  console.log(`${tag} claimed (attempt ${job.read_ct})`);

  try {
    const summary = await pipeline.run(job);
    await pipeline.complete(job);
    console.log(`${tag} done in ${Date.now() - started}ms — ${summary}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${tag} failed (attempt ${job.read_ct}): ${message}`);

    // Give up only after maxAttempts. Below that the message is simply left
    // alone: its visibility timeout expires and another worker picks it up.
    // No status juggling, so a crash mid-job cannot strand it the way the
    // retired worker's PROCESSING state did.
    if (job.read_ct >= CONFIG.maxAttempts) {
      await pipeline.giveUp(job, message);
      console.error(`${tag} archived to dead letter after ${job.read_ct} attempts`);
    }
  }
}

/** Take one job from whichever queues have work, so none can starve. */
async function claimAny(): Promise<boolean> {
  let worked = false;

  const napJob = await napPipeline.claim();
  if (napJob) {
    await handle(napPipeline, napJob);
    worked = true;
  }

  const visibilityJob = await visibilityPipeline.claim();
  if (visibilityJob) {
    await handle(visibilityPipeline, visibilityJob);
    worked = true;
  }

  const mapJob = await mapPipeline.claim();
  if (mapJob) {
    await handle(mapPipeline, mapJob);
    worked = true;
  }

  return worked;
}

async function main(): Promise<void> {
  console.log(
    `AgastyaOne audit worker starting — queues: nap, visibility, map — ` +
      `concurrency ${CONFIG.concurrency}, visibility ${CONFIG.visibilityTimeoutSec}s, ` +
      (CONFIG.playwrightWsEndpoint ? 'remote browser' : 'local Chromium'),
  );

  while (!shuttingDown) {
    try {
      if (!(await claimAny())) await sleep(CONFIG.pollIntervalMs);
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
