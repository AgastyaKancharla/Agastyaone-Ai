/** A contract_lines row, as far as GST computation cares. */
export interface BillableLine {
  id: string;
  description: string;
  hsnSacCode: string | null;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  gstRate: number;
  serviceId: string | null;
}

export interface ComputedInvoiceLine {
  sourceLineId: string;
  description: string;
  hsnSacCode: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxableAmount: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
  serviceId: string | null;
}

export interface InvoiceTotals {
  taxableAmount: number;
  discountAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  roundOff: number;
  totalAmount: number;
}

export interface ComputedInvoice {
  lines: ComputedInvoiceLine[];
  totals: InvoiceTotals;
}
