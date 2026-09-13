import { computeBacklinksScore, type BacklinksProvider, type BacklinksSummary } from '@agastyaone/backlinks-engine';
import { dataForSeoBacklinksClient } from '@agastyaone/dataforseo-client';
import { createFixtureBacklinksProvider } from './collectors/fixture-backlinks.ts';

export interface BacklinksCheckTarget {
  checkId: string;
  tenantId: string;
  locationId: string;
  domain: string;
}

/** Buy nothing, build our own — same seam as map-rank and AI visibility. */
export function selectProvider(): BacklinksProvider {
  const real = dataForSeoBacklinksClient();
  return real.configured ? real : createFixtureBacklinksProvider();
}

export interface BacklinksCheckOutcome {
  status: 'completed' | 'blocked' | 'error';
  providerCode: string;
  summary: BacklinksSummary | null;
  score: number | null;
  costMicros: number;
  errorMessage: string | null;
}

export async function runBacklinksCheck(target: BacklinksCheckTarget): Promise<BacklinksCheckOutcome> {
  const provider = selectProvider();
  const outcome = await provider.collect(target.domain);

  if (outcome.status !== 'ok') {
    return {
      status: outcome.status,
      providerCode: provider.code,
      summary: null,
      score: null,
      costMicros: 0,
      errorMessage: outcome.reason,
    };
  }

  return {
    status: 'completed',
    providerCode: provider.code,
    summary: outcome.summary,
    score: computeBacklinksScore(outcome.summary).score,
    costMicros: provider.costMicrosPerCheck,
    errorMessage: null,
  };
}
