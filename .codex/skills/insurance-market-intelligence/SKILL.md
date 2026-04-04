---
name: insurance-market-intelligence
description: Market intelligence workflow for Brazilian health plans and insurance products, including trusted-source monitoring and crawl strategy.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(firecrawl *)
  - Bash(npx firecrawl *)
---

# Insurance Market Intelligence

## Purpose

Provide up-to-date, evidence-backed intelligence for the Revier ecosystem in health plans and insurance verticals.

## Product Domains

- Health plans
- Dental plans
- Life insurance
- Auto insurance
- Home insurance
- Business insurance
- Travel insurance
- Pet insurance
- Private pension
- Consortium

## Source Priority

Use sources in this order:

1. Regulatory and official entities
2. Insurer official pages and releases
3. Distributor/broker official materials
4. Reputable sector media
5. Community/blog sources (only as secondary signal)

See full source map in `trusted-sources.md`.

## Update Policy

Treat information as stale when:

- Regulatory content is older than 180 days for policy-sensitive topics
- Pricing/commercial information is older than 60 days
- Campaign or offer data is older than 30 days

## Research Modes

### Mode A - Quick Verification

Use when validating one claim or one page.

- Run targeted search
- Scrape top official sources
- Return confidence and deltas

### Mode B - Weekly Sweep

Use for recurring market monitoring.

- Search each priority domain
- Compare with prior known data
- List changes by product and urgency

### Mode C - Deep Crawl

Use when large update is required.

- Crawl high-priority source sections
- Extract new rules, pricing mentions, eligibility criteria, deadlines
- Build structured changelog for implementation

## Firecrawl Command Patterns

```bash
firecrawl search "ANS plano de saude reajuste 2026" --scrape --limit 5
firecrawl scrape "https://www.gov.br/ans/pt-br"
firecrawl map "https://www.gov.br/ans/pt-br" --search "reajuste"
firecrawl crawl "https://www.gov.br/ans/pt-br" --limit 50
```

## Evidence Rules

For each volatile statement, include:

- Source URL
- Publication/update date
- Retrieval date
- Short quote or extracted evidence

If confidence is not high, explicitly say uncertainty remains.

## Output Template

```markdown
## Market Intelligence Update

### Summary
- [Main change]

### Impact on Revier
- [What to update in project]

### Recommended Actions
1. [Action]
2. [Action]

### Sources
- [URL] - published: [date] - checked: [date]

### Confidence
- [high/medium/low]
```

## Guardrails

- Do not provide legal advice.
- Do not claim exact pricing without timestamped source.
- Do not overwrite local truth without citing external evidence.
- Prefer conservative statements when data conflicts.
