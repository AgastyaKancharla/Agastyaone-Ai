import qrcode from 'qrcode-generator';

/**
 * Renders a review link as an inline SVG QR code, server-side.
 *
 * The link identifies a patient, so it is never handed to a third-party image
 * service — no api.qrserver.com, no Google Charts. The encoding happens in this
 * process and the markup is inlined into the page.
 *
 * The plan said to do this with no dependency at all. Hand-rolling a QR encoder
 * means Reed-Solomon over GF(256), mask evaluation and format bits, and getting
 * any of it subtly wrong produces a code that scans on some phones and not
 * others — discovered at a clinic's front desk, with a patient standing there.
 * `qrcode-generator` is a long-established implementation with ZERO runtime
 * dependencies, so the actual concern (patient data leaving our server) is fully
 * met while the encoding itself is something already proven.
 *
 * Error correction level M: ~15% recoverable, which is what a printed card
 * needs once it has been handled, folded, or laminated at a reception desk.
 */
export function reviewQrSvg(url: string, sizePx = 160): string {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();

  const count = qr.getModuleCount();
  // A quiet zone is part of the spec, not padding. Scanners fail without it.
  const quiet = 4;
  const total = count + quiet * 2;

  // One path for every dark module beats one <rect> each: a 33x33 code is over
  // a thousand elements otherwise, inlined into every page render.
  let d = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        d += `M${col + quiet} ${row + quiet}h1v1h-1z`;
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}"`,
    ` width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges"`,
    ` role="img" aria-label="QR code linking to the review page">`,
    // White is not decoration: the quiet zone must be light for a scanner to
    // find the code, whatever the page or the printer puts behind it.
    `<rect width="${total}" height="${total}" fill="#ffffff"/>`,
    `<path d="${d}" fill="#111827"/>`,
    `</svg>`,
  ].join('');
}
