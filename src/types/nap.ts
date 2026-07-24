export interface SourceOfTruthNAP {
  businessName?: string;
  address?: string;
  phone?: string;
  secondaryPhone?: string;
  city?: string;
  state?: string;
  pincode?: string;
  website?: string;
  category?: string;
  workingHours?: string;
}

export interface ScrapedListing {
  directoryId: string;
  directoryName: string;
  listingUrl?: string;
  foundName?: string;
  foundAddress?: string;
  foundPhone?: string;
  foundWebsite?: string;
  foundCategory?: string;
  rating?: string;
  reviewCount?: string;
  isClaimed?: boolean;
  rawData?: Record<string, any>;
}

export type MatchStatus = 'EXACT' | 'DRIFT' | 'MISMATCH' | 'MISSING';

export interface FieldDiff {
  fieldName: 'businessName' | 'address' | 'phone' | 'website';
  sourceValue: string;
  foundValue: string;
  matchStatus: MatchStatus;
  similarityScore: number; // 0 to 100
  notes: string;
}

export type DirectoryAuditStatus =
  | 'CONSISTENT'
  | 'DRIFT'
  | 'INCONSISTENT'
  | 'NOT_FOUND'
  | 'ERROR';

export interface DirectoryAuditResult {
  directoryId: string;
  directoryName: string;
  status: DirectoryAuditStatus;
  listingUrl?: string;
  diffs: FieldDiff[];
  overallConfidence: number;
  errorMessage?: string;
}

export interface NAPAuditReport {
  businessInfo: SourceOfTruthNAP;
  auditTimestamp: string;
  totalDirectoriesChecked: number;
  foundCount: number;
  missingCount: number;
  consistentCount: number;
  inconsistentCount: number;
  auditScore: number; // Percentage consistency score
  results: DirectoryAuditResult[];
}
