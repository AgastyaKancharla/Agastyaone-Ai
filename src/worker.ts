import { getSupabaseClient } from './db/supabase';
import { CitationAuditAgent } from './index';
import { SourceOfTruthNAP } from './types/nap';
import { CONFIG } from './config/env';

async function startWorker() {
  console.log(`\n======================================================`);
  console.log(`☁️ Starting Citation Audit Agent Cloud Worker`);
  console.log(`📡 Cloud Mode: ${CONFIG.IS_CLOUD_MODE ? 'ENABLED (CDP / Browserless)' : 'LOCAL FALLBACK'}`);
  console.log(`======================================================\n`);

  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn(`⚠️ Supabase credentials missing in env. Worker running in dry-run mode.`);
    return;
  }

  const agent = new CitationAuditAgent();

  while (true) {
    try {
      // 1. Poll for PENDING audit jobs in Supabase audit_jobs table
      const { data: jobs, error } = await supabase
        .from('audit_jobs')
        .select('*')
        .eq('status', 'PENDING')
        .limit(1);

      if (error) {
        console.error('Error fetching jobs from Supabase:', error.message);
      } else if (jobs && jobs.length > 0) {
        const job = jobs[0];
        console.log(`⚙️ Processing Job ID: ${job.id} for Clinic: ${job.business_name}`);

        // Update status to PROCESSING
        await supabase
          .from('audit_jobs')
          .update({ status: 'PROCESSING', started_at: new Date().toISOString() })
          .eq('id', job.id);

        const sourceNAP: SourceOfTruthNAP = {
          businessName: job.business_name,
          address: job.address,
          city: job.city || 'Bengaluru',
          pincode: job.pincode,
          phone: job.phone,
          category: job.category || 'Dental Clinic',
          website: job.website
        };

        // 2. Execute Audit
        const report = await agent.runAudit(sourceNAP);

        // 3. Store Results in Supabase
        await supabase.from('audit_results').insert({
          job_id: job.id,
          business_name: job.business_name,
          score: report.auditScore,
          report_json: report,
          completed_at: new Date().toISOString()
        });

        // 4. Mark Job as COMPLETED
        await supabase
          .from('audit_jobs')
          .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
          .eq('id', job.id);

        console.log(`✅ Job ID ${job.id} COMPLETED. Score: ${report.auditScore}%\n`);
      }
    } catch (err: any) {
      console.error('Worker loop exception:', err.message);
    }

    // Wait before next poll iteration
    await new Promise((resolve) => setTimeout(resolve, CONFIG.POLL_INTERVAL_MS));
  }
}

if (require.main === module) {
  startWorker();
}
