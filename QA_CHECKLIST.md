# QA Checklist (No Visual Redesign)

## Quick smoke

- Run `npm install`
- Run `npx playwright install chromium`
- Run `npm run qa:smoke`

## Manual checks (5-10 min)

- Viewports: `390x844`, `600x900`, `767x1024`, `768x1024`, `1366x768`
- Confirm no horizontal scroll appears in any viewport
- Open and close Message/About panels multiple times
- Confirm `Escape` closes an open panel
- Click the pet and confirm bubble appears
- Leave tab hidden for at least 30 seconds, return, and confirm page is responsive
- Verify console has no uncaught runtime errors

## Release gate

- All smoke tests pass
- No visible style changes except bug fixes
- Mobile and desktop checks pass on one real browser each
