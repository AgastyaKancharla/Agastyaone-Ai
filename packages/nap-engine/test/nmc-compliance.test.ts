import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { checkNmcCompliance } from '../src/nmc-compliance.ts';

const COMPLIANT_HTML = `
  <p>Dr. Nissa Rao, BDS, MDS (Orthodontics). KMC Reg No: 123456.</p>
  <p>Read our privacy policy for how we handle your data.</p>
  <p>In case of emergency call our clinic immediately.</p>
`;

describe('checkNmcCompliance', () => {
  test('a page with no violations and every disclosure scores 100 and is compliant', () => {
    const result = checkNmcCompliance(COMPLIANT_HTML, COMPLIANT_HTML);
    assert.equal(result.score, 100);
    assert.equal(result.isCompliant, true);
    assert.equal(result.findings.filter((f) => f.kind === 'violation').length, 0);
    assert.equal(result.findings.filter((f) => f.kind === 'missing_disclosure').length, 0);
    assert.equal(result.findings.filter((f) => f.kind === 'disclosure_present').length, 4);
  });

  test('a superlative claim is flagged against the NMC Ch. 4 rule', () => {
    const html = `${COMPLIANT_HTML} <h1>Bengaluru's #1 Dentist</h1>`;
    const result = checkNmcCompliance(html, html);
    const violation = result.findings.find((f) => f.kind === 'violation');
    assert.ok(violation);
    assert.match(violation.ruleLabel, /Ch\. 4/);
    assert.equal(violation.severity, 'high');
    assert.equal(result.isCompliant, false);
    assert.equal(result.score, 80);
  });

  test('a guaranteed-cure claim is flagged against the Cl. 26 rule', () => {
    const html = `${COMPLIANT_HTML} <p>100% guaranteed painless treatment.</p>`;
    const result = checkNmcCompliance(html, html);
    const violation = result.findings.find((f) => f.kind === 'violation');
    assert.ok(violation);
    assert.match(violation.ruleLabel, /Cl\. 26/);
  });

  test('a commercial inducement is flagged against the Cl. 28 rule', () => {
    const html = `${COMPLIANT_HTML} <p>Flat 50% off this Diwali! Cashback on every visit.</p>`;
    const result = checkNmcCompliance(html, html);
    const violation = result.findings.find((f) => f.kind === 'violation');
    assert.ok(violation);
    assert.match(violation.ruleLabel, /Cl\. 28/);
  });

  test('missing exactly one disclosure still counts as compliant', () => {
    // No privacy policy mentioned anywhere, everything else present.
    const html = `
      <p>Dr. Nissa Rao, BDS, MDS. KMC Reg No: 123456.</p>
      <p>In case of emergency call our clinic immediately.</p>
    `;
    const result = checkNmcCompliance(html, html);
    assert.equal(result.findings.filter((f) => f.kind === 'missing_disclosure').length, 1);
    assert.equal(result.isCompliant, true);
  });

  test('missing two or more disclosures is not compliant, even with zero violations', () => {
    const html = '<p>Welcome to our dental clinic.</p>';
    const result = checkNmcCompliance(html, html);
    assert.equal(result.findings.filter((f) => f.kind === 'missing_disclosure').length, 4);
    assert.equal(result.isCompliant, false);
    assert.equal(result.score, 60);
  });

  test('score never drops below the floor of 10', () => {
    const html = '<h1>#1 Best Dentist. 100% Guaranteed Cure. Flat 90% off!</h1>';
    const result = checkNmcCompliance(html, html);
    assert.equal(result.score, 10);
  });

  test('a superlative next to an unrelated noun is not a medical claim', () => {
    // The rule requires the superlative to sit directly against a clinical
    // noun (dentist, clinic, ...) -- generic marketing copy must not trip it.
    const html = `${COMPLIANT_HTML} <p>Voted best biryani in Koramangala.</p>`;
    const result = checkNmcCompliance(html, html);
    assert.equal(result.findings.filter((f) => f.kind === 'violation').length, 0);
  });
});
