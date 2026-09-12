import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyseWebsite } from '../src/website.ts';

/** A clinic site doing most things right. */
const GOOD = `<!doctype html>
<html><head>
<title>Smile Dental Clinic — Koramangala, Bengaluru | Root Canal &amp; Implants</title>
<meta name="description" content="Smile Dental Clinic in Koramangala, Bengaluru offers root canal treatment, dental implants and orthodontics. Led by Dr Anita Rao, BDS, MDS. Call to book an appointment.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://smiledental.in/">
<meta property="og:title" content="Smile Dental Clinic, Koramangala">
<meta property="og:image" content="https://smiledental.in/clinic.jpg">
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
 {"@type":"Dentist","name":"Smile Dental Clinic","telephone":"+91 98450 12345",
  "sameAs":["https://www.practo.com/smile","https://g.page/smile"],
  "address":{"@type":"PostalAddress","postalCode":"560034","addressLocality":"Koramangala"}},
 {"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How much does a root canal cost?"}]}]}
</script>
</head><body>
<h1>Dental Clinic in Koramangala, Bengaluru</h1>
<p>Smile Dental Clinic has served Koramangala, Bengaluru since 2011. Our lead dentist Dr Anita Rao, BDS, MDS, treats root canals, implants and braces. Call +91 98450 12345 or visit us at 4th Block, Koramangala, Bengaluru 560034.</p>
<h2>How much does a root canal cost in Bengaluru?</h2>
<p>A single-sitting root canal at our Koramangala clinic is priced between two and eight thousand rupees depending on the tooth and whether a crown is needed. We share a written estimate before treatment begins, and we explain what each line covers so there is no surprise at the end.</p>
<h2>What should I expect after an implant?</h2>
<p>Mild swelling for two to three days is normal after an implant. We review you at one week and again at three months, and we give written aftercare instructions covering diet, brushing and when to call us.</p>
<ul><li>Root canal treatment</li><li>Dental implants</li><li>Braces and aligners</li></ul>
<img src="clinic.jpg" alt="Reception at Smile Dental Clinic Koramangala">
<img src="team.jpg" alt="Dr Anita Rao with the clinical team">
<a href="/about">About our team</a> <a href="/contact">Contact us</a>
${'word '.repeat(300)}
</body></html>`;

/** A clinic site doing almost nothing right. */
const POOR = `<html><head><meta name="robots" content="noindex"></head>
<body><h1>Welcome</h1><h1>Welcome again</h1><img src="a.jpg"><p>We are a clinic.</p></body></html>`;

test('a well-built clinic site scores strongly across all three groups', () => {
  const r = analyseWebsite(GOOD, '');
  assert.ok(r.seo >= 80, `seo was ${r.seo}`);
  assert.ok(r.geo >= 80, `geo was ${r.geo}`);
  assert.ok(r.aeo >= 80, `aeo was ${r.aeo}`);
  assert.ok(r.score >= 80, `composite was ${r.score}`);
});

test('a neglected site scores low and says why', () => {
  const r = analyseWebsite(POOR, '');
  assert.ok(r.score < 35, `score was ${r.score}`);

  const issues = r.findings.filter((f) => f.kind === 'issue');
  assert.ok(issues.some((f) => /noindex/i.test(f.ruleLabel)), 'noindex must be flagged');
  assert.ok(issues.some((f) => /meta description/i.test(f.ruleLabel)));
  assert.ok(issues.some((f) => /H1/i.test(f.ruleLabel)), 'duplicate H1 must be flagged');
  assert.ok(issues.every((f) => f.remediation), 'every issue must say what to do about it');
});

test('passed checks are reported too, so the client sees a whole checklist', () => {
  const r = analyseWebsite(GOOD, '');
  const passed = r.findings.filter((f) => f.kind === 'passed');
  assert.ok(passed.length > 10);
  assert.ok(passed.every((f) => f.severity === null && f.remediation === null));
});

test('detects the medical entity schema type and reports it as evidence', () => {
  const r = analyseWebsite(GOOD, '');
  const finding = r.findings.find((f) => /local medical entity/i.test(f.ruleLabel));
  assert.equal(finding?.kind, 'passed');
  assert.equal(finding?.snippet, 'Dentist');
});

test('nested @graph entities are found, not just top-level ones', () => {
  const r = analyseWebsite(GOOD, '');
  assert.ok(r.findings.some((f) => f.kind === 'passed' && /FAQ structured data/i.test(f.ruleLabel)));
});

test('PageSpeed signals are excluded when absent rather than counted as failures', () => {
  const withoutPsi = analyseWebsite(GOOD, '');
  assert.ok(
    !withoutPsi.findings.some((f) => /Google's own SEO audit|long to appear|shifts around/i.test(f.ruleLabel)),
    'with no PageSpeed data, its checks must not appear at all — neither passed nor failed',
  );

  // The guarantee that matters: a site we could not reach PageSpeed for is
  // never punished for it. Passing data may raise the score, since it is
  // genuine additional evidence of things being right.
  const withGoodPsi = analyseWebsite(GOOD, '', {
    performance: 95, seo: 100, accessibility: 92, lcpMs: 1800, cls: 0.02,
  });
  assert.ok(withGoodPsi.seo >= withoutPsi.seo, 'passing PageSpeed data must never lower the score');

  const withBadPsi = analyseWebsite(GOOD, '', {
    performance: 20, seo: 50, accessibility: 40, lcpMs: 6000, cls: 0.4,
  });
  assert.ok(withBadPsi.seo < withoutPsi.seo, 'a failing PSI must lower the SEO group');
  assert.ok(withBadPsi.findings.some((f) => f.kind === 'issue' && /long to appear/i.test(f.ruleLabel)));
});

test('partial PageSpeed data only applies the fields that are present', () => {
  const r = analyseWebsite(GOOD, '', {
    performance: null, seo: null, accessibility: null, lcpMs: 6000, cls: null,
  });
  assert.ok(r.findings.some((f) => /long to appear/i.test(f.ruleLabel)), 'LCP was present, so it must be judged');
  assert.ok(
    !r.findings.some((f) => /Google's own SEO audit/i.test(f.ruleLabel)),
    'a null Lighthouse SEO score must not produce a finding at all',
  );
});

test('empty and malformed input is a finding, never a crash', () => {
  for (const input of ['', '<html>', '<<<>>>', '<script type="application/ld+json">{bad json</script>']) {
    const r = analyseWebsite(input, '');
    assert.ok(r.score >= 0 && r.score <= 100, `score out of range for ${JSON.stringify(input)}`);
    assert.ok(Array.isArray(r.findings));
  }
});

test('falls back to stripping HTML when no extracted text is supplied', () => {
  const r = analyseWebsite(GOOD, '');
  assert.ok(
    r.findings.some((f) => f.kind === 'passed' && /Phone number visible/i.test(f.ruleLabel)),
    'the phone number lives in body text only, so it proves the stripped-HTML fallback ran',
  );
});
