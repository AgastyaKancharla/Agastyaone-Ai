import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeInvoice, computeInvoiceLine } from '../src/compute.ts';
import type { BillableLine } from '../src/types.ts';

function line(overrides: Partial<BillableLine> = {}): BillableLine {
  return {
    id: 'line-1',
    description: 'SEO retainer',
    hsnSacCode: '998365',
    quantity: 1,
    unitPrice: 10000,
    discountPct: 0,
    gstRate: 18,
    serviceId: 'svc-1',
    ...overrides,
  };
}

test('intrastate: GST splits evenly into CGST + SGST, IGST is zero', () => {
  const r = computeInvoiceLine(line(), false);
  assert.equal(r.taxableAmount, 10000);
  assert.equal(r.cgstAmount, 900);
  assert.equal(r.sgstAmount, 900);
  assert.equal(r.igstAmount, 0);
  assert.equal(r.lineTotal, 11800);
});

test('interstate: the full GST amount is IGST, CGST and SGST are zero', () => {
  const r = computeInvoiceLine(line(), true);
  assert.equal(r.igstAmount, 1800);
  assert.equal(r.cgstAmount, 0);
  assert.equal(r.sgstAmount, 0);
  assert.equal(r.lineTotal, 11800);
});

test('discount is applied before GST, never after', () => {
  const r = computeInvoiceLine(line({ discountPct: 10 }), false);
  assert.equal(r.discountAmount, 1000);
  assert.equal(r.taxableAmount, 9000);
  // GST on the discounted 9000, not the gross 10000.
  assert.equal(r.cgstAmount, 810);
  assert.equal(r.sgstAmount, 810);
});

test('an odd-paisa GST amount still splits so CGST + SGST reconstructs it exactly', () => {
  // 33.44 at 9% = 3.0096 -> rounds to 3.01, an odd number of paise: no exact
  // half exists, so this is the case that would silently drop a paisa if
  // both halves were computed as gstAmount/2 instead of gst - cgst.
  const r = computeInvoiceLine(line({ quantity: 1, unitPrice: 33.44, discountPct: 0, gstRate: 9 }), false);
  assert.equal(r.cgstAmount + r.sgstAmount, 3.01);
});

test('quantity multiplies through before discount and GST', () => {
  const r = computeInvoiceLine(line({ quantity: 3, unitPrice: 500 }), false);
  assert.equal(r.taxableAmount, 1500);
  assert.equal(r.lineTotal, 1770);
});

test('multiple lines sum into invoice-level totals', () => {
  const { totals } = computeInvoice(
    [line({ id: 'a', unitPrice: 10000 }), line({ id: 'b', unitPrice: 5000, gstRate: 12 })],
    false,
  );
  assert.equal(totals.taxableAmount, 15000);
  assert.equal(totals.cgstAmount, 900 + 300);
  assert.equal(totals.sgstAmount, 900 + 300);
  assert.equal(totals.igstAmount, 0);
});

test('the grand total rounds to the nearest rupee and roundOff carries the signed difference', () => {
  // 100 at 18% = 118.00 exactly -- pick a rate that leaves a fraction.
  const { totals } = computeInvoice([line({ unitPrice: 99.5, gstRate: 18 })], false);
  const raw = totals.taxableAmount + totals.totalTax;
  assert.equal(totals.totalAmount, Math.round(raw));
  assert.ok(Math.abs(totals.totalAmount - raw - totals.roundOff) < 1e-9);
});

test('an invoice with zero lines totals to zero rather than throwing', () => {
  const { lines, totals } = computeInvoice([], false);
  assert.equal(lines.length, 0);
  assert.equal(totals.taxableAmount, 0);
  assert.equal(totals.totalAmount, 0);
  assert.equal(totals.roundOff, 0);
});

test('a header-level interstate flag drives every line -- no line computes its own', () => {
  const { totals } = computeInvoice([line({ id: 'a' }), line({ id: 'b' })], true);
  assert.equal(totals.cgstAmount, 0);
  assert.equal(totals.sgstAmount, 0);
  assert.equal(totals.igstAmount, 1800 * 2);
});
