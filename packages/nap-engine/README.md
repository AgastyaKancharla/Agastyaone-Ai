# @agastyaone/nap-engine

Pure logic for auditing a business's Name / Address / Phone consistency across
Indian directories. No Playwright, no Supabase, no I/O — so it is fast to test
and the scraping layer can change without touching the scoring.

## Why this was rebuilt rather than ported

The retired audit tool produced numbers that were quietly wrong rather than
obviously broken, which is worse. Each is now a test:

| Defect | Consequence | Fixed by |
| --- | --- | --- |
| No identity verification — the first search hit was diffed as gospel | A competitor's listing reported to a client as their own NAP error | `selectMatch()`: a candidate must clear a confidence threshold **and** beat the runner-up by a margin, or the result is `ambiguous` and held for review |
| `listingUrl` held the *search* URL, and was also used as the "found" test | Every result read as found | Explicit `found` flag; `listingUrl` is the listing's own URL |
| `MISSING` and `MISMATCH` collapsed for phone | "Add your number" and "someone published the wrong number" looked identical | Separate statuses, separate verdicts, separate advice |
| `auditScore` averaged errored directories in as zero | A blocked scraper dropped a perfect client to 60% | Score covers checked directories only; coverage reported separately |
| Counters double-counted drift and let errors fall through | The report's numbers did not add up | Invariant, asserted in tests: the five status counts sum to `directoriesChecked` |
| `rd → road` ordered before `main rd → main road` | The second rule was unreachable | Multi-word rules ordered first |
| Every `no` rewritten to `number` | "Nova No Frills Plaza" mangled | Only rewritten when a digit follows |

## Identity vs consistency

The two questions are deliberately separate:

- **Identity** (`matcher.ts`) — *is this listing this business?* Name and address
  establish it; a matching phone confirms it; a conflicting phone dents
  confidence without vetoing the match. An earlier version weighted phone at
  half of identity, which meant any listing publishing the *wrong* number scored
  too low to match — silently dropping the most valuable finding an audit
  produces.
- **Consistency** (`diff.ts`) — *do its details agree?* Only asked once identity
  is settled. An `ambiguous` result carries no field diffs at all, because
  showing detail for a listing we cannot attribute is how someone else's address
  ends up in a client's report.

## Test

```bash
npm test --workspace @agastyaone/nap-engine
```

17 assertions, no dependencies — Node's built-in test runner with type
stripping.
