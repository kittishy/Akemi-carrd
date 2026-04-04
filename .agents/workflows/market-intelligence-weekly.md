# Weekly Market Intelligence Workflow

Run this every week to keep Revier insurance and health-plan content accurate.

## Command

```powershell
powershell -ExecutionPolicy Bypass -File .agents/scripts/market_intel_weekly.ps1
```

Optional (if Firecrawl installed and authenticated):

```powershell
powershell -ExecutionPolicy Bypass -File .agents/scripts/market_intel_weekly.ps1 -UseFirecrawl
```

## Operational Checklist

1. Generate weekly sweep report.
2. Review errors or source gaps (TLS, blocked pages, redirects).
3. Validate volatile claims in guides (pricing, carencia, reajuste, elegibilidade).
4. Apply updates with source URL and checked date.
5. Commit content updates with evidence summary.

## Review Gate

Before publishing any market-sensitive content:

- At least one official source must be cited.
- Source date and retrieval date must be visible.
- Confidence must be tagged high/medium/low.
- If confidence is low, content must include uncertainty note.
