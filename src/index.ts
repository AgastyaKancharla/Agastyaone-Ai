import { SourceOfTruthNAP, DirectoryAuditResult, NAPAuditReport } from './types/nap';
import { getAllDirectoryProviders } from './directories';
import { NAPDiffEngine } from './engine/diffEngine';
import { NAPReporter } from './reports/reporter';

export class CitationAuditAgent {
  async runAudit(source: SourceOfTruthNAP): Promise<NAPAuditReport> {
    console.log(`\n======================================================`);
    console.log(`🏥 Starting Local Citation & NAP Audit for: ${source.businessName}`);
    console.log(`📍 City: ${source.city} | Category: ${source.category}`);
    console.log(`======================================================\n`);

    const providers = getAllDirectoryProviders();
    const results: DirectoryAuditResult[] = [];

    for (const provider of providers) {
      console.log(`🔍 Auditing directory: ${provider.directoryName}...`);
      try {
        const scraped = await provider.searchAndScrape(source);
        const auditResult = NAPDiffEngine.compare(
          provider.directoryId,
          provider.directoryName,
          source,
          scraped
        );
        results.push(auditResult);
        console.log(`   └─ Status: ${auditResult.status} (Confidence: ${auditResult.overallConfidence}%)\n`);
      } catch (err: any) {
        console.error(`   └─ Failed to audit ${provider.directoryName}:`, err.message);
        results.push({
          directoryId: provider.directoryId,
          directoryName: provider.directoryName,
          status: 'ERROR',
          diffs: [],
          overallConfidence: 0,
          errorMessage: err.message
        });
      }
    }

    // Compute summary metrics
    const totalChecked = results.length;
    const foundCount = results.filter(r => r.status !== 'NOT_FOUND' && r.status !== 'ERROR').length;
    const missingCount = results.filter(r => r.status === 'NOT_FOUND').length;
    const consistentCount = results.filter(r => r.status === 'CONSISTENT').length;
    const inconsistentCount = results.filter(r => r.status === 'INCONSISTENT' || r.status === 'DRIFT').length;

    const totalConfidence = results.reduce((acc, curr) => acc + curr.overallConfidence, 0);
    const auditScore = Math.round(totalConfidence / (totalChecked || 1));

    const report: NAPAuditReport = {
      businessInfo: source,
      auditTimestamp: new Date().toISOString(),
      totalDirectoriesChecked: totalChecked,
      foundCount,
      missingCount,
      consistentCount,
      inconsistentCount,
      auditScore,
      results
    };

    return report;
  }
}

// Default CLI demo execution
if (require.main === module) {
  const sampleClinic: SourceOfTruthNAP = {
    businessName: 'Nissa Dental Clinic & Implant Center',
    address: 'No. 45, 100 Feet Road, 4th Block, Koramangala',
    city: 'Bengaluru',
    pincode: '560034',
    phone: '08098765432',
    category: 'Dental Clinic',
    website: 'https://nissadental.com'
  };

  const agent = new CitationAuditAgent();
  agent.runAudit(sampleClinic).then((report) => {
    const markdown = NAPReporter.generateMarkdownReport(report);
    console.log(markdown);
  });
}
