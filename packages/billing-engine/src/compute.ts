import type {
  BillableLine,
  ComputedCreditNote,
  ComputedInvoice,
  ComputedInvoiceLine,
  InvoiceTaxSnapshot,
  InvoiceTotals,
} from './types.ts';

/**
 * Rounds to the paisa, the same precision `numeric(14,2)` holds in Postgres --
 * done here, before the DB ever sees the number, so a value computed in JS
 * and one computed by re-summing the stored rows always agree.
 */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * One contract_line billed. Discount and GST apply in that order: qty*price,
 * minus discount, then GST on what's left -- GST charged on top of a
 * discount already given would overstate the tax.
 *
 * CGST/SGST split is computed as gstAmount/2 and gstAmount-cgst (not
 * gstAmount/2 twice), so the two halves always sum back to the exact GST
 * amount even when that amount has an odd paisa.
 */
export function computeInvoiceLine(line: BillableLine, isInterstate: boolean): ComputedInvoiceLine {
  const gross = line.quantity * line.unitPrice;
  const discountAmount = round2(gross * (line.discountPct / 100));
  const taxableAmount = round2(gross - discountAmount);
  const gstAmount = round2(taxableAmount * (line.gstRate / 100));

  const cgstAmount = isInterstate ? 0 : round2(gstAmount / 2);
  const sgstAmount = isInterstate ? 0 : round2(gstAmount - cgstAmount);
  const igstAmount = isInterstate ? gstAmount : 0;

  return {
    sourceLineId: line.id,
    description: line.description,
    hsnSacCode: line.hsnSacCode,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountAmount,
    taxableAmount,
    gstRate: line.gstRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    lineTotal: round2(taxableAmount + gstAmount),
    serviceId: line.serviceId,
  };
}

/**
 * `isInterstate` is one flag for the whole invoice (supplier state vs. the
 * client's place of supply), not per line -- matching invoices.is_interstate,
 * which is generated once at the header, and the invoices_tax_split_ck
 * constraint every line here has to satisfy by construction.
 *
 * The grand total is rounded to the nearest rupee, standard practice on an
 * Indian GST invoice; the difference is `roundOff`, kept signed so a
 * caller can print "round off: -0.40" rather than silently absorbing it.
 */
export function computeInvoice(lines: BillableLine[], isInterstate: boolean): ComputedInvoice {
  const computedLines = lines.map((line) => computeInvoiceLine(line, isInterstate));

  const sum = (pick: (l: ComputedInvoiceLine) => number) =>
    round2(computedLines.reduce((total, l) => total + pick(l), 0));

  const taxableAmount = sum((l) => l.taxableAmount);
  const discountAmount = sum((l) => l.discountAmount);
  const cgstAmount = sum((l) => l.cgstAmount);
  const sgstAmount = sum((l) => l.sgstAmount);
  const igstAmount = sum((l) => l.igstAmount);
  const totalTax = round2(cgstAmount + sgstAmount + igstAmount);

  const rawTotal = taxableAmount + totalTax;
  const totalAmount = Math.round(rawTotal);
  const roundOff = round2(totalAmount - rawTotal);

  const totals: InvoiceTotals = {
    taxableAmount,
    discountAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTax,
    roundOff,
    totalAmount,
  };

  return { lines: computedLines, totals };
}

/**
 * A credit note scales an already-issued invoice's tax breakdown down to the
 * portion being credited, rather than re-deriving GST from scratch. That
 * matters because an invoice can mix line items at different GST rates --
 * scaling every tax bucket by the same ratio credits back exactly what was
 * actually charged, without needing to reopen which lines it came from.
 *
 * `creditTaxableAmount` is assumed already validated by the caller as
 * `<=` whatever of the invoice remains uncredited; this function only does
 * the arithmetic.
 */
export function computeCreditNote(invoice: InvoiceTaxSnapshot, creditTaxableAmount: number): ComputedCreditNote {
  const ratio = invoice.taxableAmount > 0 ? creditTaxableAmount / invoice.taxableAmount : 0;
  const taxableAmount = round2(creditTaxableAmount);
  const cgstAmount = round2(invoice.cgstAmount * ratio);
  const sgstAmount = round2(invoice.sgstAmount * ratio);
  const igstAmount = round2(invoice.igstAmount * ratio);

  return {
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount: round2(taxableAmount + cgstAmount + sgstAmount + igstAmount),
  };
}
